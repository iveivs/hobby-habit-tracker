import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  completeRedirectSignIn,
  hasFirebaseConfig,
  loadCloudState,
  loadLocalState,
  makeEntryKey,
  registerWithEmail,
  resetEmailPassword,
  saveCloudState,
  saveLocalState,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutOfGoogle,
  subscribeCloudState,
  watchAuth,
  type Habit,
  type Score,
  type TrackerState,
} from "./storage";

const scoreLabels: Record<Score, string> = {
  1: "слабо",
  2: "частично",
  3: "нормально",
  4: "хорошо",
  5: "отлично",
};

const scoreColors: Record<Score, string> = {
  1: "#e66767",
  2: "#f0a24a",
  3: "#e8cf52",
  4: "#70b86f",
  5: "#4b8fe2",
};

const habitColors = ["#2f80ed", "#2f9e6d", "#d46b32", "#8f5bd3", "#c44569"];
const popoverWidth = 180;
const popoverHeight = 254;
const longHabitNameLimit = 38;

type Theme = "light" | "dark";
type AuthMode = "signin" | "signup";
type ChartRange = "week" | "month" | "all";
type ChartView = "donut" | "timeline";

const chartRanges: Record<ChartRange, string> = {
  week: "Неделя",
  month: "Месяц",
  all: "Всё время",
};
const chartViews: Record<ChartView, string> = {
  donut: "Круговая",
  timeline: "По дням",
};
const appVersion = import.meta.env.VITE_APP_VERSION;
const themeStorageKey = "hobby-habit-theme";

type HabitRow = Habit & {
  depth: number;
  childCount: number;
};

type PickerState = {
  key: string;
  habitId: string;
  date: string;
  top: number;
  left: number;
};

function loadTheme(): Theme {
  const savedTheme = localStorage.getItem(themeStorageKey);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateWindow(daysBefore: number, daysAfter: number) {
  const dates: Date[] = [];
  const today = new Date();
  for (let offset = -daysBefore; offset <= daysAfter; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    dates.push(date);
  }
  return dates;
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date);
}

function formatChartDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function getStats(state: TrackerState) {
  const habits = state.habits.filter((habit) => !habit.archived);
  const scores = Object.values(state.entries).map((entry) => entry.score);
  const total = scores.length;
  const average = total
    ? (scores.reduce((sum, score) => sum + score, 0) / total).toFixed(1)
    : "0.0";
  const best = scores.filter((score) => score >= 4).length;
  return { habitCount: habits.length, total, average, best };
}

function formatSubskillCount(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} упражнение`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} упражнения`;
  }
  return `${count} упражнений`;
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) return "Не удалось выполнить вход";

  if (error.code === "auth/unauthorized-domain") {
    return "Firebase не разрешает вход с этого домена";
  }

  if (error.code === "auth/popup-blocked") {
    return "Браузер заблокировал окно входа";
  }

  if (error.code === "auth/popup-closed-by-user") {
    return "Окно входа закрылось до завершения";
  }

  if (error.code === "auth/email-already-in-use") {
    return "Такой email уже зарегистрирован";
  }

  if (error.code === "auth/invalid-email") {
    return "Проверь email";
  }

  if (error.code === "auth/weak-password") {
    return "Пароль должен быть не короче 6 символов";
  }

  if (
    error.code === "auth/invalid-credential" ||
    error.code === "auth/user-not-found" ||
    error.code === "auth/wrong-password"
  ) {
    return "Неверный email или пароль";
  }

  if (error.code === "auth/too-many-requests") {
    return "Слишком много попыток, попробуй позже";
  }

  return `Ошибка входа: ${error.code}`;
}

function getActiveHabits(habits: Habit[]) {
  return habits.filter((habit) => !habit.archived);
}

function getChildrenByParent(habits: Habit[]) {
  const activeHabits = habits.filter((habit) => !habit.archived);
  const childrenByParent = new Map<string, Habit[]>();

  activeHabits.forEach((habit) => {
    if (!habit.parentId) return;
    const siblings = childrenByParent.get(habit.parentId) ?? [];
    siblings.push(habit);
    childrenByParent.set(habit.parentId, siblings);
  });

  return childrenByParent;
}

function getVisibleHabitRows(
  habits: Habit[],
  expandedProjects: Set<string>,
): HabitRow[] {
  const activeHabits = getActiveHabits(habits);
  const childrenByParent = getChildrenByParent(habits);

  return activeHabits.flatMap((habit) => {
    if (habit.parentId) return [];

    const projectRow: HabitRow = {
      ...habit,
      depth: 0,
      childCount: childrenByParent.get(habit.id)?.length ?? 0,
    };
    const childRows = expandedProjects.has(habit.id)
      ? (childrenByParent.get(habit.id) ?? []).map((child) => ({
          ...child,
          depth: 1,
          childCount: 0,
        }))
      : [];

    return [projectRow, ...childRows];
  });
}

function getChartPoints(state: TrackerState, habitId: string, range: ChartRange) {
  const allEntries = Object.values(state.entries)
    .filter((entry) => entry.habitId === habitId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (range === "all") return allEntries;

  const days = range === "week" ? 7 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  const startKey = dateKey(startDate);

  return allEntries.filter((entry) => entry.date >= startKey);
}

function getExpandedProjectsFromState(state: TrackerState) {
  const projectIdsWithChildren = new Set(
    state.habits
      .filter((habit) => !habit.archived && habit.parentId)
      .map((habit) => habit.parentId!),
  );

  return new Set(
    (state.preferences?.expandedProjectIds ?? []).filter((projectId) =>
      projectIdsWithChildren.has(projectId),
    ),
  );
}

export function App() {
  const [state, setState] = useState<TrackerState>(() => loadLocalState());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => getExpandedProjectsFromState(state),
  );
  const [newHabit, setNewHabit] = useState("");
  const [newArea, setNewArea] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState(
    hasFirebaseConfig ? "Вход или регистрация" : "Локальное хранение",
  );
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordRepeat, setAuthPasswordRepeat] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [parentForNewSkill, setParentForNewSkill] = useState<Habit | null>(null);
  const [expandedHabit, setExpandedHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editArea, setEditArea] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [chartHabit, setChartHabit] = useState<Habit | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("week");
  const [chartView, setChartView] = useState<ChartView>("donut");

  const dates = useMemo(() => getDateWindow(5, 4), []);
  const mobileDates = useMemo(() => getDateWindow(2, 3), []);
  const todayKey = dateKey(new Date());
  const activeHabits = getActiveHabits(state.habits);
  const childrenByParent = getChildrenByParent(state.habits);
  const rootHabits = activeHabits.filter((habit) => !habit.parentId);
  const visibleHabits = getVisibleHabitRows(state.habits, expandedProjects);
  const stats = getStats(state);
  const nickname = state.profile?.nickname?.trim() || null;
  const displayName = nickname ?? userName ?? syncStatus;
  const chartPoints = chartHabit
    ? getChartPoints(state, chartHabit.id, chartRange)
    : [];
  const chartAverage = chartPoints.length
    ? (
        chartPoints.reduce((sum, entry) => sum + entry.score, 0) /
        chartPoints.length
      ).toFixed(1)
    : "0.0";
  const chartBestScore = chartPoints.length
    ? Math.max(...chartPoints.map((entry) => entry.score))
    : 0;
  const chartScoreBreakdown = ([1, 2, 3, 4, 5] as Score[]).map((score) => ({
    score,
    count: chartPoints.filter((entry) => entry.score === score).length,
  }));
  const chartTotal = chartPoints.length;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    void completeRedirectSignIn().catch((error) => {
      setSyncStatus(getAuthErrorMessage(error));
    });

    return watchAuth(async (user) => {
      setUserId(user?.uid ?? null);
      setUserName(user?.displayName ?? user?.email ?? null);
      setUserPhoto(user?.photoURL ?? null);

      if (!user) {
        setSyncStatus("Вход или регистрация");
        return;
      }

      setSyncStatus("Загружаю облачные данные");
      const cloudState = await loadCloudState(user.uid);
      if (cloudState) {
        setState(cloudState);
        setExpandedProjects(getExpandedProjectsFromState(cloudState));
        saveLocalState(cloudState);
      } else {
        await saveCloudState(user.uid, loadLocalState());
      }
      setSyncStatus("Синхронизация включена");
      setAuthMode(null);
      setAuthPassword("");
      setAuthPasswordRepeat("");
      setAuthMessage("");
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    return subscribeCloudState(userId, (cloudState) => {
      if (!cloudState) return;
      setState(cloudState);
      setExpandedProjects(getExpandedProjectsFromState(cloudState));
      saveLocalState(cloudState);
    });
  }, [userId]);

  useEffect(() => {
    if (!picker) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest(".score-popover, .score-cell")) return;
      setPicker(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPicker(null);
    }

    function closePicker() {
      setPicker(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closePicker);
    window.addEventListener("scroll", closePicker, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closePicker);
      window.removeEventListener("scroll", closePicker, true);
    };
  }, [picker]);

  useEffect(() => {
    if (!habitToDelete) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setHabitToDelete(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [habitToDelete]);

  useEffect(() => {
    if (
      !habitToEdit &&
      !expandedHabit &&
      !parentForNewSkill &&
      !authMode &&
      !profileDialogOpen &&
      !chartHabit
    ) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setHabitToEdit(null);
      setExpandedHabit(null);
      setParentForNewSkill(null);
      setAuthMode(null);
      setProfileDialogOpen(false);
      setChartHabit(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    habitToEdit,
    expandedHabit,
    parentForNewSkill,
    authMode,
    profileDialogOpen,
    chartHabit,
  ]);

  function commit(nextState: TrackerState) {
    const updatedState = { ...nextState, updatedAt: new Date().toISOString() };
    setState(updatedState);
    saveLocalState(updatedState);
    if (userId) {
      setSyncStatus("Сохраняю");
      void saveCloudState(userId, updatedState).then(() => {
        setSyncStatus("Синхронизация включена");
      });
    }
  }

  function addHabit(event: FormEvent) {
    event.preventDefault();
    const name = newHabit.trim();
    if (!name) return;

    const habit: Habit = {
      id: crypto.randomUUID(),
      name,
      area: newArea.trim() || "личное",
      color: habitColors[state.habits.length % habitColors.length],
    };

    commit({ ...state, habits: [...state.habits, habit] });
    setNewHabit("");
    setNewArea("");
  }

  function setScore(habitId: string, date: string, score: Score | null) {
    const key = makeEntryKey(habitId, date);
    const entries = { ...state.entries };
    if (score) {
      entries[key] = { habitId, date, score };
    } else {
      delete entries[key];
    }

    commit({ ...state, entries });
    setPicker(null);
  }

  function togglePicker(
    event: MouseEvent<HTMLButtonElement>,
    key: string,
    habitId: string,
    date: string,
  ) {
    if (picker?.key === key) {
      setPicker(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 10;
    const enoughSpaceBelow =
      rect.bottom + popoverHeight + viewportPadding < window.innerHeight;
    const top = enoughSpaceBelow
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - popoverHeight - 8);
    const left = Math.min(
      Math.max(viewportPadding, rect.left + rect.width / 2 - popoverWidth / 2),
      window.innerWidth - popoverWidth - viewportPadding,
    );

    setPicker({ key, habitId, date, top, left });
  }

  function deleteHabit(habitId: string) {
    const idsToDelete = new Set([
      habitId,
      ...state.habits
        .filter((habit) => habit.parentId === habitId)
        .map((habit) => habit.id),
    ]);
    const entries = Object.fromEntries(
      Object.entries(state.entries).filter(
        ([, entry]) => !idsToDelete.has(entry.habitId),
      ),
    );
    const expandedProjectIds = (state.preferences?.expandedProjectIds ?? []).filter(
      (projectId) => !idsToDelete.has(projectId),
    );

    setExpandedProjects((currentProjects) => {
      const nextProjects = new Set(currentProjects);
      idsToDelete.forEach((projectId) => nextProjects.delete(projectId));
      return nextProjects;
    });
    commit({
      ...state,
      habits: state.habits.filter((habit) => !idsToDelete.has(habit.id)),
      entries,
      preferences: {
        ...state.preferences,
        expandedProjectIds,
      },
    });
    setHabitToDelete(null);
  }

  function startAddingSubSkill(parent: Habit) {
    setNewSkillName("");
    setParentForNewSkill(parent);
  }

  function addSubSkill(event: FormEvent) {
    event.preventDefault();
    if (!parentForNewSkill) return;

    const name = newSkillName.trim();
    if (!name) return;

    const habit: Habit = {
      id: crypto.randomUUID(),
      name,
      area: "упражнение",
      color: parentForNewSkill.color,
      parentId: parentForNewSkill.id,
    };

    const parentIndex = state.habits.findIndex(
      (item) => item.id === parentForNewSkill.id,
    );
    let insertAt = parentIndex < 0 ? state.habits.length : parentIndex + 1;

    while (state.habits[insertAt]?.parentId === parentForNewSkill.id) {
      insertAt += 1;
    }

    const nextHabits = [...state.habits];
    nextHabits.splice(insertAt, 0, habit);

    commit({ ...state, habits: nextHabits });
    setParentForNewSkill(null);
  }

  function startEditingHabit(habit: Habit) {
    setEditName(habit.name);
    setEditArea(habit.area);
    setHabitToEdit(habit);
  }

  function saveHabitEdits(event: FormEvent) {
    event.preventDefault();
    if (!habitToEdit) return;

    const name = editName.trim();
    if (!name) return;

    commit({
      ...state,
      habits: state.habits.map((habit) =>
        habit.id === habitToEdit.id
          ? { ...habit, name, area: editArea.trim() || "личное" }
          : habit,
      ),
    });
    setHabitToEdit(null);
  }

  function startEditingProfile() {
    setNicknameDraft(nickname ?? "");
    setProfileDialogOpen(true);
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const nextNickname = nicknameDraft.trim();

    commit({
      ...state,
      profile: nextNickname ? { nickname: nextNickname } : {},
    });
    setProfileDialogOpen(false);
  }

  function openChart(habit: Habit) {
    setChartHabit(habit);
    setChartRange("week");
    setChartView("donut");
  }

  async function handleAuthClick() {
    try {
      if (userId) {
        await signOutOfGoogle();
        return;
      }

      setAuthMode("signin");
      setAuthMessage("");
    } catch (error) {
      setSyncStatus(getAuthErrorMessage(error));
    }
  }

  async function handleGoogleAuth() {
    setAuthBusy(true);
    setAuthMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error));
      setSyncStatus(getAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEmailAuth(event: FormEvent) {
    event.preventDefault();
    const email = authEmail.trim();
    const password = authPassword.trim();
    const passwordRepeat = authPasswordRepeat.trim();

    if (!email) {
      setAuthMessage("Укажи email");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Пароль должен быть не короче 6 символов");
      return;
    }

    if (authMode === "signup" && password !== passwordRepeat) {
      setAuthMessage("Пароли не совпадают");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");

    try {
      if (authMode === "signup") {
        const credential = await registerWithEmail(email, password);
        if (credential?.user) {
          await sendVerificationEmail(credential.user);
          setAuthMessage("Аккаунт создан. Письмо подтверждения отправлено");
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error));
      setSyncStatus(getAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordReset() {
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage("Сначала укажи email");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");

    try {
      await resetEmailPassword(email);
      setAuthMessage("Письмо для сброса пароля отправлено");
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  function toggleProject(projectId: string) {
    const nextProjects = new Set(expandedProjects);
    if (nextProjects.has(projectId)) {
      nextProjects.delete(projectId);
    } else {
      nextProjects.add(projectId);
    }

    setExpandedProjects(nextProjects);
    commit({
      ...state,
      preferences: {
        ...state.preferences,
        expandedProjectIds: [...nextProjects],
      },
    });
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Обзор трекера">
        <div>
          <p className="eyebrow">Личный трекер</p>
          <div className="title-row">
            <img
              className="brand-mark"
              src={`./brand-mark.svg?v=${appVersion}`}
              alt=""
            />
            <h1>Hab-Hob</h1>
            <span className="version-badge">v{appVersion}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={
              theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"
            }
            onClick={toggleTheme}
          >
            <span className="theme-track" aria-hidden="true">
              <span className="theme-thumb" />
              <span>☀︎</span>
              <span>☾</span>
            </span>
          </button>
          <div className="sync-card">
            {userPhoto ? (
              <img
                className="user-avatar"
                src={userPhoto}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className={`status-dot ${userId ? "online" : ""}`} />
            )}
            <div>
              <strong>{displayName}</strong>
              <span>
                {userId
                  ? nickname
                    ? "Никнейм и данные общие для всех устройств"
                    : "Данные общие для всех устройств"
                  : hasFirebaseConfig
                    ? "Email, пароль или Google для синхронизации"
                    : "Данные пока сохраняются в этом браузере"}
              </span>
            </div>
            {hasFirebaseConfig ? (
              <div className="sync-actions">
                {userId ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={startEditingProfile}
                  >
                    Профиль
                  </button>
                ) : null}
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleAuthClick}
                >
                  {userId ? "Выйти" : "Вход"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="tracker-band">
        <div className="toolbar">
          <form className="habit-form" onSubmit={addHabit}>
            <input
              aria-label="Название привычки"
              placeholder="Новый проект или привычка"
              value={newHabit}
              onChange={(event) => setNewHabit(event.target.value)}
            />
            <input
              aria-label="Категория"
              placeholder="Категория"
              value={newArea}
              onChange={(event) => setNewArea(event.target.value)}
            />
            <button type="submit">Добавить</button>
          </form>
        </div>

        <div className="table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th className="habit-heading">Проект / навык</th>
                {dates.map((date) => (
                  <th
                    key={dateKey(date)}
                    className={dateKey(date) === todayKey ? "today-column" : ""}
                  >
                    <span>{formatWeekday(date)}</span>
                    <strong>{formatDay(date)}</strong>
                  </th>
                ))}
                <th className="actions-heading"> </th>
              </tr>
            </thead>
            <tbody>
              {visibleHabits.map((habit) => (
                <tr
                  key={habit.id}
                  className={habit.depth ? "subskill-row" : "project-row"}
                >
                  <th
                    className="habit-cell"
                    style={{ "--depth": habit.depth } as CSSProperties}
                  >
                    <span
                      className="habit-mark"
                      style={{ backgroundColor: habit.color }}
                    />
                    <div className="habit-copy">
                      <div className="habit-title-row">
                        {!habit.parentId && habit.childCount ? (
                          <button
                            className="expand-button"
                            type="button"
                            aria-label={
                              expandedProjects.has(habit.id)
                                ? `Свернуть упражнения ${habit.name}`
                                : `Раскрыть упражнения ${habit.name}`
                            }
                            aria-expanded={expandedProjects.has(habit.id)}
                            onClick={() => toggleProject(habit.id)}
                          >
                            {expandedProjects.has(habit.id) ? "⌄" : "›"}
                          </button>
                        ) : null}
                        <strong className="habit-title">{habit.name}</strong>
                        {habit.name.length > longHabitNameLimit ? (
                          <button
                            className="more-name-button"
                            type="button"
                            aria-label={`Показать полное название ${habit.name}`}
                            onClick={() => setExpandedHabit(habit)}
                          >
                            ...
                          </button>
                        ) : null}
                        <button
                          className="chart-button"
                          type="button"
                          aria-label={`Открыть диаграмму ${habit.name}`}
                          onClick={() => openChart(habit)}
                        >
                          ▥
                        </button>
                        <button
                          className="edit-button"
                          type="button"
                          aria-label={`Редактировать ${habit.name}`}
                          onClick={() => startEditingHabit(habit)}
                        >
                          ✎
                        </button>
                        {!habit.parentId ? (
                          <button
                            className="add-subskill-button"
                            type="button"
                            aria-label={`Добавить упражнение в ${habit.name}`}
                            onClick={() => startAddingSubSkill(habit)}
                          >
                            +
                          </button>
                        ) : null}
                      </div>
                      <span>
                        {habit.parentId
                          ? habit.area
                          : habit.childCount
                            ? `${habit.area} · ${formatSubskillCount(
                                habit.childCount,
                              )}`
                            : habit.area}
                      </span>
                    </div>
                  </th>
                  {dates.map((date) => {
                    const day = dateKey(date);
                    const key = makeEntryKey(habit.id, day);
                    const entry = state.entries[key];

                    return (
                      <td key={key}>
                        <button
                          className="score-cell"
                          data-today={day === todayKey ? "true" : undefined}
                          style={{
                            backgroundColor: entry
                              ? scoreColors[entry.score]
                              : "transparent",
                          }}
                          type="button"
                          aria-label={`${habit.name}, ${formatDay(date)}`}
                          onClick={(event) =>
                            togglePicker(event, key, habit.id, day)
                          }
                        >
                          {entry?.score ?? ""}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <button
                      className="archive-button"
                      type="button"
                      aria-label={`Удалить ${habit.name}`}
                      onClick={() => setHabitToDelete(habit)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mobile-tracker" aria-label="Навыки по дням">
        {rootHabits.map((habit) => {
          const children = childrenByParent.get(habit.id) ?? [];
          const isExpanded = expandedProjects.has(habit.id);
          const habitsToShow = isExpanded ? [habit, ...children] : [habit];

          return (
            <article className="mobile-skill-card" key={habit.id}>
              <button
                className="mobile-skill-header"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => children.length && toggleProject(habit.id)}
              >
                <span
                  className="habit-mark"
                  style={{ backgroundColor: habit.color }}
                />
                <span className="mobile-skill-copy">
                  <strong>{habit.name}</strong>
                  <span>
                    {children.length
                      ? `${habit.area} · ${formatSubskillCount(children.length)}`
                      : habit.area}
                  </span>
                </span>
                <span className="mobile-expand-indicator" aria-hidden="true">
                  {children.length ? (isExpanded ? "⌄" : "›") : ""}
                </span>
              </button>

              <div className="mobile-skill-actions">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => openChart(habit)}
                >
                  График
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => startEditingHabit(habit)}
                >
                  Изменить
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => startAddingSubSkill(habit)}
                >
                  Упражнение
                </button>
                <button
                  className="archive-button mobile-delete-button"
                  type="button"
                  aria-label={`Удалить ${habit.name}`}
                  onClick={() => setHabitToDelete(habit)}
                >
                  ×
                </button>
              </div>

              <div className="mobile-skill-stack">
                {habitsToShow.map((rowHabit) => (
                  <div
                    className={
                      rowHabit.parentId ? "mobile-day-row child" : "mobile-day-row"
                    }
                    key={rowHabit.id}
                  >
                    {rowHabit.parentId ? (
                      <div className="mobile-child-title">
                        <span
                          className="habit-mark"
                          style={{ backgroundColor: rowHabit.color }}
                        />
                        <strong>{rowHabit.name}</strong>
                        <button
                          className="chart-button"
                          type="button"
                          aria-label={`Открыть диаграмму ${rowHabit.name}`}
                          onClick={() => openChart(rowHabit)}
                        >
                          ▥
                        </button>
                        <button
                          className="edit-button"
                          type="button"
                          aria-label={`Редактировать ${rowHabit.name}`}
                          onClick={() => startEditingHabit(rowHabit)}
                        >
                          ✎
                        </button>
                      </div>
                    ) : null}
                    <div className="mobile-days">
                      {mobileDates.map((date) => {
                        const day = dateKey(date);
                        const key = makeEntryKey(rowHabit.id, day);
                        const entry = state.entries[key];
                        return (
                          <div
                            className={
                              day === todayKey ? "mobile-day today" : "mobile-day"
                            }
                            key={key}
                          >
                            <span>
                              {formatWeekday(date)}
                              <strong>{formatDay(date)}</strong>
                            </span>
                            <button
                              className="score-cell"
                              style={{
                                backgroundColor: entry
                                  ? scoreColors[entry.score]
                                  : "transparent",
                              }}
                              type="button"
                              aria-label={`${rowHabit.name}, ${formatDay(date)}`}
                              onClick={(event) =>
                                togglePicker(event, key, rowHabit.id, day)
                              }
                            >
                              {entry?.score ?? ""}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="summary-grid" aria-label="Статистика">
        <article>
          <span>Привычек</span>
          <strong>{stats.habitCount}</strong>
        </article>
        <article>
          <span>Отметок</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>Средняя оценка</span>
          <strong>{stats.average}</strong>
        </article>
        <article>
          <span>Хороших дней</span>
          <strong>{stats.best}</strong>
        </article>
      </section>

      {picker ? (
        <div
          className="score-popover"
          role="menu"
          style={{ left: picker.left, top: picker.top }}
        >
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              style={{
                backgroundColor: scoreColors[score as Score],
              }}
              onClick={() =>
                setScore(picker.habitId, picker.date, score as Score)
              }
            >
              <strong>{score}</strong>
              <span>{scoreLabels[score as Score]}</span>
            </button>
          ))}
          <button
            className="clear-score"
            type="button"
            onClick={() => setScore(picker.habitId, picker.date, null)}
          >
            Очистить
          </button>
        </div>
      ) : null}

      {habitToDelete ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть подтверждение удаления"
            onClick={() => setHabitToDelete(null)}
          />
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-habit-title"
          >
            <h2 id="delete-habit-title">Удалить привычку?</h2>
            <p>
              Строка «{habitToDelete.name}»
              {state.habits.some((habit) => habit.parentId === habitToDelete.id)
                ? " вместе с упражнениями"
                : ""}{" "}
              и все её оценки исчезнут из таблицы. Это действие нельзя будет
              отменить.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setHabitToDelete(null)}
              >
                Отмена
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => deleteHabit(habitToDelete.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {parentForNewSkill ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть добавление упражнения"
            onClick={() => setParentForNewSkill(null)}
          />
          <form
            className="confirm-dialog edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-subskill-title"
            onSubmit={addSubSkill}
          >
            <h2 id="new-subskill-title">Добавить упражнение</h2>
            <p className="dialog-context">{parentForNewSkill.name}</p>
            <label>
              <span>Название</span>
              <input
                maxLength={120}
                placeholder="Например, игра с метрономом"
                value={newSkillName}
                onChange={(event) => setNewSkillName(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setParentForNewSkill(null)}
              >
                Отмена
              </button>
              <button className="primary-button" type="submit">
                Добавить
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {habitToEdit ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть редактирование привычки"
            onClick={() => setHabitToEdit(null)}
          />
          <form
            className="confirm-dialog edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-habit-title"
            onSubmit={saveHabitEdits}
          >
            <h2 id="edit-habit-title">Редактировать привычку</h2>
            <label>
              <span>Название</span>
              <input
                maxLength={120}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              <span>Категория</span>
              <input
                maxLength={48}
                value={editArea}
                onChange={(event) => setEditArea(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setHabitToEdit(null)}
              >
                Отмена
              </button>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {expandedHabit ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть полное название"
            onClick={() => setExpandedHabit(null)}
          />
          <div
            className="confirm-dialog full-name-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-habit-title"
          >
            <h2 id="full-habit-title">Полное название</h2>
            <p>{expandedHabit.name}</p>
            <div className="dialog-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setExpandedHabit(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {profileDialogOpen ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть профиль"
            onClick={() => setProfileDialogOpen(false)}
          />
          <form
            className="confirm-dialog edit-dialog profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            onSubmit={saveProfile}
          >
            <h2 id="profile-title">Профиль</h2>
            <p className="dialog-context">{userName ?? "Аккаунт Firebase"}</p>
            <label>
              <span>Никнейм</span>
              <input
                maxLength={40}
                placeholder="Как показывать тебя в приложении"
                value={nicknameDraft}
                onChange={(event) => setNicknameDraft(event.target.value)}
              />
            </label>
            <p className="profile-hint">
              Никнейм виден только внутри Hab-Hob. Если оставить поле пустым,
              будет показан email или имя из аккаунта.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setProfileDialogOpen(false)}
              >
                Отмена
              </button>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {chartHabit ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть диаграмму"
            onClick={() => setChartHabit(null)}
          />
          <div
            className="confirm-dialog chart-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chart-title"
          >
            <div className="chart-head">
              <div>
                <p className="eyebrow">Диаграмма привычки</p>
                <h2 id="chart-title">{chartHabit.name}</h2>
              </div>
              <button
                className="archive-button"
                type="button"
                aria-label="Закрыть диаграмму"
                onClick={() => setChartHabit(null)}
              >
                ×
              </button>
            </div>
            <div className="range-tabs" role="tablist" aria-label="Период">
              {(Object.keys(chartRanges) as ChartRange[]).map((range) => (
                <button
                  className={chartRange === range ? "active" : ""}
                  key={range}
                  type="button"
                  role="tab"
                  aria-selected={chartRange === range}
                  onClick={() => setChartRange(range)}
                >
                  {chartRanges[range]}
                </button>
              ))}
            </div>
            <div className="chart-view-tabs" role="tablist" aria-label="Вид диаграммы">
              {(Object.keys(chartViews) as ChartView[]).map((view) => (
                <button
                  className={chartView === view ? "active" : ""}
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={chartView === view}
                  onClick={() => setChartView(view)}
                >
                  {chartViews[view]}
                </button>
              ))}
            </div>
            <div className="chart-stats" aria-label="Статистика диаграммы">
              <span>
                Отметок <strong>{chartPoints.length}</strong>
              </span>
              <span>
                Средняя <strong>{chartAverage}</strong>
              </span>
              <span>
                Лучшая <strong>{chartBestScore || "-"}</strong>
              </span>
            </div>
            {chartPoints.length ? (
              chartView === "donut" ? (
                <div className="donut-chart-layout">
                  <div className="donut-chart-wrap" aria-hidden="true">
                    <svg
                      className="donut-chart"
                      viewBox="0 0 120 120"
                      role="presentation"
                    >
                      <circle
                        className="donut-chart-base"
                        cx="60"
                        cy="60"
                        r="42"
                        pathLength="100"
                      />
                      {chartScoreBreakdown.map((item, index) => {
                        if (!chartTotal || item.count === 0) return null;
                        const offset =
                          chartScoreBreakdown
                            .slice(0, index)
                            .reduce((sum, part) => sum + part.count, 0) /
                          chartTotal;
                        return (
                          <circle
                            key={item.score}
                            className="donut-chart-segment"
                            cx="60"
                            cy="60"
                            r="42"
                            pathLength="100"
                            stroke={scoreColors[item.score]}
                            strokeDasharray={`${(item.count / chartTotal) * 100} 100`}
                            strokeDashoffset={`${25 - offset * 100}`}
                          />
                        );
                      })}
                    </svg>
                    <div className="donut-chart-center">
                      <strong>{chartAverage}</strong>
                      <span>средняя</span>
                    </div>
                  </div>
                  <div className="donut-legend" aria-label="Распределение оценок">
                    {chartScoreBreakdown.map((item) => (
                      <div className="donut-legend-row" key={item.score}>
                        <span className="donut-legend-main">
                          <i style={{ backgroundColor: scoreColors[item.score] }} />
                          {item.score} - {scoreLabels[item.score]}
                        </span>
                        <strong>
                          {item.count}
                          {chartTotal
                            ? ` · ${Math.round((item.count / chartTotal) * 100)}%`
                            : ""}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="chart-scroll">
                  <div className="chart-bars">
                    {chartPoints.map((entry) => (
                      <div className="chart-bar-item" key={`${entry.date}-${entry.score}`}>
                        <div className="chart-bar-track">
                          <span
                            className="chart-bar"
                            style={{
                              height: `${entry.score * 20}%`,
                              backgroundColor: scoreColors[entry.score],
                            }}
                          />
                        </div>
                        <strong>{entry.score}</strong>
                        <span>{formatChartDate(entry.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="chart-empty">
                Пока нет оценок за выбранный период.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {authMode ? (
        <div className="dialog-backdrop">
          <button
            className="dialog-scrim"
            type="button"
            aria-label="Закрыть вход"
            onClick={() => setAuthMode(null)}
          />
          <form
            className="confirm-dialog auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onSubmit={handleEmailAuth}
          >
            <h2 id="auth-title">Синхронизация</h2>
            <p>
              Email и пароль удобнее для телефона и встроенных браузеров. Google
              можно оставить как быстрый вход на компьютере.
            </p>
            <div className="auth-tabs" role="tablist" aria-label="Режим входа">
              <button
                className={authMode === "signin" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={authMode === "signin"}
                onClick={() => {
                  setAuthMode("signin");
                  setAuthPasswordRepeat("");
                  setAuthMessage("");
                }}
              >
                Вход
              </button>
              <button
                className={authMode === "signup" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={authMode === "signup"}
                onClick={() => {
                  setAuthMode("signup");
                  setAuthMessage("");
                }}
              >
                Регистрация
              </button>
            </div>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Пароль</span>
              <input
                autoComplete={
                  authMode === "signup" ? "new-password" : "current-password"
                }
                minLength={6}
                placeholder="Минимум 6 символов"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
            {authMode === "signup" ? (
              <label>
                <span>Повтор пароля</span>
                <input
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="Повтори пароль"
                  type="password"
                  value={authPasswordRepeat}
                  onChange={(event) =>
                    setAuthPasswordRepeat(event.target.value)
                  }
                />
              </label>
            ) : null}
            {authMessage ? (
              <p className="auth-message" role="status">
                {authMessage}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setAuthMode(null)}
              >
                Отмена
              </button>
              <button className="primary-button" type="submit" disabled={authBusy}>
                {authBusy
                  ? "Подожди..."
                  : authMode === "signup"
                    ? "Создать аккаунт"
                    : "Войти"}
              </button>
            </div>
            <div className="auth-extra-actions">
              {authMode === "signin" ? (
                <button type="button" onClick={handlePasswordReset}>
                  Сбросить пароль
                </button>
              ) : null}
              <button type="button" onClick={handleGoogleAuth} disabled={authBusy}>
                Войти через Google
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="notes-band">
        <div>
          <h2>Телефон и компьютер</h2>
          <p>
            После публикации на GitHub Pages приложение откроется с любого
            устройства. Без входа данные останутся локальными; с Firebase и
            входом через email или Google новые хобби и оценки будут появляться
            везде.
          </p>
        </div>
        <div className="legend" aria-label="Цвета оценок">
          {[1, 2, 3, 4, 5].map((score) => (
            <span key={score}>
              <i style={{ backgroundColor: scoreColors[score as Score] }} />
              {score} - {scoreLabels[score as Score]}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
