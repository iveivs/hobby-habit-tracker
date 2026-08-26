import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  hasFirebaseConfig,
  loadCloudState,
  loadLocalState,
  makeEntryKey,
  saveCloudState,
  saveLocalState,
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

type PickerState = {
  key: string;
  habitId: string;
  date: string;
  top: number;
  left: number;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getVisibleDates() {
  const dates: Date[] = [];
  const today = new Date();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
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

export function App() {
  const [state, setState] = useState<TrackerState>(() => loadLocalState());
  const [newHabit, setNewHabit] = useState("");
  const [newArea, setNewArea] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState(
    hasFirebaseConfig ? "Можно войти через Google" : "Локальное хранение",
  );
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [expandedHabit, setExpandedHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editArea, setEditArea] = useState("");

  const dates = useMemo(() => getVisibleDates(), []);
  const visibleHabits = state.habits.filter((habit) => !habit.archived);
  const stats = getStats(state);

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    return watchAuth(async (user) => {
      setUserId(user?.uid ?? null);
      setUserName(user?.displayName ?? user?.email ?? null);

      if (!user) {
        setSyncStatus("Можно войти через Google");
        return;
      }

      setSyncStatus("Загружаю облачные данные");
      const cloudState = await loadCloudState(user.uid);
      if (cloudState) {
        setState(cloudState);
        saveLocalState(cloudState);
      } else {
        await saveCloudState(user.uid, loadLocalState());
      }
      setSyncStatus("Синхронизация включена");
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    return subscribeCloudState(userId, (cloudState) => {
      if (!cloudState) return;
      setState(cloudState);
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
    if (!habitToEdit && !expandedHabit) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setHabitToEdit(null);
      setExpandedHabit(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [habitToEdit, expandedHabit]);

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
    const entries = Object.fromEntries(
      Object.entries(state.entries).filter(
        ([, entry]) => entry.habitId !== habitId,
      ),
    );

    commit({
      ...state,
      habits: state.habits.filter((habit) => habit.id !== habitId),
      entries,
    });
    setHabitToDelete(null);
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

  async function handleAuthClick() {
    try {
      if (userId) {
        await signOutOfGoogle();
        return;
      }

      await signInWithGoogle();
    } catch {
      setSyncStatus("Не удалось войти через Google");
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Обзор трекера">
        <div>
          <p className="eyebrow">Личный трекер</p>
          <h1>Хобби и привычки</h1>
        </div>
        <div className="sync-card">
          <span className={`status-dot ${userId ? "online" : ""}`} />
          <div>
            <strong>{userName ?? syncStatus}</strong>
            <span>
              {userId
                ? "Данные общие для всех устройств"
                : hasFirebaseConfig
                  ? "После входа появится облачная синхронизация"
                  : "Данные пока сохраняются в этом браузере"}
            </span>
          </div>
          {hasFirebaseConfig ? (
            <button
              className="ghost-button"
              type="button"
              onClick={handleAuthClick}
            >
              {userId ? "Выйти" : "Войти"}
            </button>
          ) : null}
        </div>
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

      <section className="tracker-band">
        <div className="toolbar">
          <form className="habit-form" onSubmit={addHabit}>
            <input
              aria-label="Название привычки"
              placeholder="Новая привычка или хобби"
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
                <th className="habit-heading">Привычка</th>
                {dates.map((date) => (
                  <th key={dateKey(date)}>
                    <span>{formatWeekday(date)}</span>
                    <strong>{formatDay(date)}</strong>
                  </th>
                ))}
                <th className="actions-heading"> </th>
              </tr>
            </thead>
            <tbody>
              {visibleHabits.map((habit) => (
                <tr key={habit.id}>
                  <th className="habit-cell">
                    <span
                      className="habit-mark"
                      style={{ backgroundColor: habit.color }}
                    />
                    <div className="habit-copy">
                      <div className="habit-title-row">
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
                          className="edit-button"
                          type="button"
                          aria-label={`Редактировать ${habit.name}`}
                          onClick={() => startEditingHabit(habit)}
                        >
                          ✎
                        </button>
                      </div>
                      <span>{habit.area}</span>
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
              Строка «{habitToDelete.name}» и все её оценки исчезнут из
              таблицы. Это действие нельзя будет отменить.
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

      <section className="notes-band">
        <div>
          <h2>Телефон и компьютер</h2>
          <p>
            После публикации на GitHub Pages приложение откроется с любого
            устройства. Без Firebase данные останутся локальными; с Firebase и
            входом через Google новые хобби и оценки будут появляться везде.
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
