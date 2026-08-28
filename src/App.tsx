import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { FirebaseError } from "firebase/app";
import {
  completeRedirectSignIn,
  hasFirebaseConfig,
  loadCloudState,
  loadLocalState,
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
import { LegendBand } from "./components/LegendBand";
import { MobileTracker } from "./components/MobileTracker";
import { SummaryGrid } from "./components/SummaryGrid";
import { TopBar } from "./components/TopBar";
import { TrackerBand } from "./components/TrackerBand";
import {
  AddSubSkillDialog,
  AuthDialog,
  ChartDialog,
  DayNoteEditor,
  DeleteHabitDialog,
  EditHabitDialog,
  FullNameDialog,
  ProfileDialog,
  ScorePopover,
} from "./components/TrackerDialogs";
import {
  dateKey,
  getActiveHabits,
  getChartPoints,
  getChildrenByParent,
  getDateWindow,
  getExpandedProjectsFromState,
  isFutureDay,
  getStats,
  getVisibleHabitRows,
  habitColors,
  loadTheme,
  noteEditorHeight,
  noteEditorWidth,
  popoverHeight,
  popoverWidth,
  themeStorageKey,
  type AuthMode,
  type ChartRange,
  type ChartView,
  type DayNoteEditorState,
  type PickerState,
  type Theme,
} from "./lib/tracker";

const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";

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

export function App() {
  const [state, setState] = useState<TrackerState>(() => loadLocalState());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    getExpandedProjectsFromState(loadLocalState()),
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
  const [dayNoteEditor, setDayNoteEditor] = useState<DayNoteEditorState | null>(
    null,
  );
  const [dayNoteDraft, setDayNoteDraft] = useState("");

  const dates = useMemo(() => getDateWindow(5, 4), []);
  const mobileDates = useMemo(() => getDateWindow(2, 3), []);
  const todayKey = dateKey(new Date());
  const activeHabits = useMemo(() => getActiveHabits(state.habits), [state.habits]);
  const childrenByParent = useMemo(
    () => getChildrenByParent(state.habits),
    [state.habits],
  );
  const rootHabits = useMemo(
    () => activeHabits.filter((habit) => !habit.parentId),
    [activeHabits],
  );
  const visibleHabits = useMemo(
    () => getVisibleHabitRows(state.habits, expandedProjects),
    [state.habits, expandedProjects],
  );
  const stats = useMemo(() => getStats(state), [state]);
  const nickname = state.profile?.nickname?.trim() || null;
  const displayName = nickname ?? userName ?? syncStatus;
  const chartPoints = useMemo(
    () => (chartHabit ? getChartPoints(state, chartHabit.id, chartRange) : []),
    [chartHabit, chartRange, state],
  );
  const chartAverage = chartPoints.length
    ? (
        chartPoints.reduce((sum, entry) => sum + entry.score, 0) /
        chartPoints.length
      ).toFixed(1)
    : "0.0";
  const chartBestScore = chartPoints.length
    ? Math.max(...chartPoints.map((entry) => entry.score))
    : 0;
  const chartScoreBreakdown = useMemo(
    () =>
      ([1, 2, 3, 4, 5] as Score[]).map((score) => ({
        score,
        count: chartPoints.filter((entry) => entry.score === score).length,
      })),
    [chartPoints],
  );
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
    if (!dayNoteEditor) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest(".day-note-editor, .day-note-button, .mobile-note-card")) {
        return;
      }
      setDayNoteEditor(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDayNoteEditor(null);
    }

    function closeEditor() {
      setDayNoteEditor(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeEditor);
    window.addEventListener("scroll", closeEditor, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeEditor);
      window.removeEventListener("scroll", closeEditor, true);
    };
  }, [dayNoteEditor]);

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

  function addHabit(event: FormEvent<HTMLFormElement>) {
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
    if (isFutureDay(date, todayKey)) {
      setPicker(null);
      return;
    }

    const key = `${date}__${habitId}`;
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
    setDayNoteEditor(null);
  }

  function openDayNoteEditorAtPosition(date: string, top: number, left: number) {
    const currentNote = state.dayNotes[date] ?? "";
    const viewportPadding = 12;
    const clampedTop = Math.min(
      Math.max(viewportPadding, top),
      window.innerHeight - noteEditorHeight - viewportPadding,
    );
    const clampedLeft = Math.min(
      Math.max(viewportPadding, left),
      window.innerWidth - noteEditorWidth - viewportPadding,
    );

    setPicker(null);
    setDayNoteDraft(currentNote);
    setDayNoteEditor({ date, top: clampedTop, left: clampedLeft });
  }

  function openDayNoteEditor(event: MouseEvent<HTMLButtonElement>, date: string) {
    if (dayNoteEditor?.date === date) {
      setDayNoteEditor(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const enoughSpaceBelow =
      rect.bottom + noteEditorHeight + viewportPadding < window.innerHeight;
    const top = enoughSpaceBelow
      ? rect.bottom + 8
      : Math.max(viewportPadding, rect.top - noteEditorHeight - 8);
    const left = Math.min(
      Math.max(
        viewportPadding,
        rect.left + rect.width / 2 - noteEditorWidth / 2,
      ),
      window.innerWidth - noteEditorWidth - viewportPadding,
    );

    openDayNoteEditorAtPosition(date, top, left);
  }

  function openDayNoteFromPicker(date: string) {
    if (!picker) return;
    openDayNoteEditorAtPosition(date, picker.top, picker.left);
  }

  function saveDayNote() {
    if (!dayNoteEditor) return;

    const normalized = dayNoteDraft.trim();
    const nextDayNotes = { ...state.dayNotes };

    if (normalized) {
      nextDayNotes[dayNoteEditor.date] = normalized;
    } else {
      delete nextDayNotes[dayNoteEditor.date];
    }

    commit({ ...state, dayNotes: nextDayNotes });
    setDayNoteEditor(null);
  }

  function deleteDayNote(date: string) {
    const nextDayNotes = { ...state.dayNotes };
    delete nextDayNotes[date];
    commit({ ...state, dayNotes: nextDayNotes });
    setDayNoteEditor(null);
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

  function addSubSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parentForNewSkill) return;

    const parentId = parentForNewSkill.id;
    const name = newSkillName.trim();
    if (!name) return;

    const habit: Habit = {
      id: crypto.randomUUID(),
      name,
      area: "упражнение",
      color: parentForNewSkill.color,
      parentId,
    };

    const parentIndex = state.habits.findIndex((item) => item.id === parentId);
    let insertAt = parentIndex < 0 ? state.habits.length : parentIndex + 1;

    while (state.habits[insertAt]?.parentId === parentId) {
      insertAt += 1;
    }

    const nextHabits = [...state.habits];
    nextHabits.splice(insertAt, 0, habit);
    const nextProjects = new Set(expandedProjects);
    nextProjects.add(parentId);

    setExpandedProjects(nextProjects);
    commit({
      ...state,
      habits: nextHabits,
      preferences: {
        ...state.preferences,
        expandedProjectIds: [...nextProjects],
      },
    });
    setParentForNewSkill(null);
  }

  function startEditingHabit(habit: Habit) {
    setEditName(habit.name);
    setEditArea(habit.area);
    setHabitToEdit(habit);
  }

  function saveHabitEdits(event: FormEvent<HTMLFormElement>) {
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

  function saveProfile(event: FormEvent<HTMLFormElement>) {
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
      const message = getAuthErrorMessage(error);
      setAuthMessage(message);
      setSyncStatus(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
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
      const message = getAuthErrorMessage(error);
      setAuthMessage(message);
      setSyncStatus(message);
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

  function handleAuthModeChange(mode: AuthMode) {
    setAuthMode(mode);
    setAuthMessage("");
    if (mode === "signin") {
      setAuthPasswordRepeat("");
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
      <TopBar
        appVersion={appVersion}
        displayName={displayName}
        hasSync={hasFirebaseConfig}
        isSignedIn={Boolean(userId)}
        nickname={nickname}
        onAuthClick={handleAuthClick}
        onEditProfile={startEditingProfile}
        onToggleTheme={toggleTheme}
        theme={theme}
        userPhoto={userPhoto}
      />

      <TrackerBand
        dates={dates}
        dayNotes={state.dayNotes}
        entries={state.entries}
        expandedProjects={expandedProjects}
        newArea={newArea}
        newHabit={newHabit}
        onAddHabit={addHabit}
        onAddSubSkill={startAddingSubSkill}
        onDeleteHabit={setHabitToDelete}
        onEditHabit={startEditingHabit}
        onNewAreaChange={setNewArea}
        onNewHabitChange={setNewHabit}
        onOpenChart={openChart}
        onOpenDayNoteEditor={openDayNoteEditor}
        onOpenFullHabitName={setExpandedHabit}
        onTogglePicker={togglePicker}
        onToggleProject={toggleProject}
        todayKey={todayKey}
        visibleHabits={visibleHabits}
      />

      <MobileTracker
        childrenByParent={childrenByParent}
        dayNotes={state.dayNotes}
        entries={state.entries}
        expandedProjects={expandedProjects}
        mobileDates={mobileDates}
        onAddSubSkill={startAddingSubSkill}
        onDeleteHabit={setHabitToDelete}
        onEditHabit={startEditingHabit}
        onOpenChart={openChart}
        onOpenDayNoteEditor={openDayNoteEditor}
        onTogglePicker={togglePicker}
        onToggleProject={toggleProject}
        rootHabits={rootHabits}
        todayKey={todayKey}
      />

      <SummaryGrid stats={stats} />

      <ScorePopover
        hasDayNote={Boolean(picker && state.dayNotes[picker.date])}
        onOpenDayNote={openDayNoteFromPicker}
        onSetScore={setScore}
        picker={picker}
        todayKey={todayKey}
      />

      <DayNoteEditor
        draft={dayNoteDraft}
        editor={dayNoteEditor}
        onChangeDraft={setDayNoteDraft}
        onClose={() => setDayNoteEditor(null)}
        onDelete={deleteDayNote}
        onSave={saveDayNote}
      />

      <DeleteHabitDialog
        habit={habitToDelete}
        hasChildren={Boolean(
          habitToDelete &&
            state.habits.some((habit) => habit.parentId === habitToDelete.id),
        )}
        onClose={() => setHabitToDelete(null)}
        onConfirm={deleteHabit}
      />

      <AddSubSkillDialog
        onChange={setNewSkillName}
        onClose={() => setParentForNewSkill(null)}
        onSubmit={addSubSkill}
        parent={parentForNewSkill}
        value={newSkillName}
      />

      <EditHabitDialog
        area={editArea}
        habit={habitToEdit}
        name={editName}
        onAreaChange={setEditArea}
        onClose={() => setHabitToEdit(null)}
        onNameChange={setEditName}
        onSubmit={saveHabitEdits}
      />

      <FullNameDialog
        habit={expandedHabit}
        onClose={() => setExpandedHabit(null)}
      />

      <ProfileDialog
        draft={nicknameDraft}
        onChange={setNicknameDraft}
        onClose={() => setProfileDialogOpen(false)}
        onSubmit={saveProfile}
        open={profileDialogOpen}
        userName={userName}
      />

      <ChartDialog
        average={chartAverage}
        bestScore={chartBestScore}
        habit={chartHabit}
        points={chartPoints}
        range={chartRange}
        scoreBreakdown={chartScoreBreakdown}
        total={chartTotal}
        view={chartView}
        onClose={() => setChartHabit(null)}
        onRangeChange={setChartRange}
        onViewChange={setChartView}
      />

      <AuthDialog
        busy={authBusy}
        email={authEmail}
        message={authMessage}
        mode={authMode}
        password={authPassword}
        passwordRepeat={authPasswordRepeat}
        onChangeEmail={setAuthEmail}
        onChangePassword={setAuthPassword}
        onChangePasswordRepeat={setAuthPasswordRepeat}
        onClose={() => setAuthMode(null)}
        onGoogleAuth={handleGoogleAuth}
        onPasswordReset={handlePasswordReset}
        onSelectMode={handleAuthModeChange}
        onSubmit={handleEmailAuth}
      />

      <LegendBand />
    </main>
  );
}
