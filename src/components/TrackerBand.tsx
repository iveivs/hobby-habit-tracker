import { type CSSProperties, type FormEvent, type MouseEvent } from "react";
import { makeEntryKey, type Habit } from "../storage";
import {
  dateKey,
  formatDay,
  formatLongDay,
  formatSubskillCount,
  formatWeekday,
  longHabitNameLimit,
  scoreColors,
  type HabitRow,
} from "../lib/tracker";

type TrackerBandProps = {
  dates: Date[];
  dayNotes: Record<string, string>;
  entries: Record<string, { habitId: string; date: string; score: 1 | 2 | 3 | 4 | 5 }>;
  expandedProjects: Set<string>;
  newArea: string;
  newHabit: string;
  onAddHabit: (event: FormEvent<HTMLFormElement>) => void;
  onAddSubSkill: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  onEditHabit: (habit: Habit) => void;
  onNewAreaChange: (value: string) => void;
  onNewHabitChange: (value: string) => void;
  onOpenChart: (habit: Habit) => void;
  onOpenDayNoteEditor: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onOpenFullHabitName: (habit: Habit) => void;
  onTogglePicker: (
    event: MouseEvent<HTMLButtonElement>,
    key: string,
    habitId: string,
    date: string,
  ) => void;
  onToggleProject: (projectId: string) => void;
  todayKey: string;
  visibleHabits: HabitRow[];
};

export function TrackerBand({
  dates,
  dayNotes,
  entries,
  expandedProjects,
  newArea,
  newHabit,
  onAddHabit,
  onAddSubSkill,
  onDeleteHabit,
  onEditHabit,
  onNewAreaChange,
  onNewHabitChange,
  onOpenChart,
  onOpenDayNoteEditor,
  onOpenFullHabitName,
  onTogglePicker,
  onToggleProject,
  todayKey,
  visibleHabits,
}: TrackerBandProps) {
  return (
    <section className="tracker-band">
      <div className="toolbar">
        <form className="habit-form" onSubmit={onAddHabit}>
          <input
            aria-label="Название привычки"
            placeholder="Новый проект или привычка"
            value={newHabit}
            onChange={(event) => onNewHabitChange(event.target.value)}
          />
          <input
            aria-label="Категория"
            placeholder="Категория"
            value={newArea}
            onChange={(event) => onNewAreaChange(event.target.value)}
          />
          <button type="submit">Добавить</button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="tracker-table">
          <thead>
            <tr>
              <th className="habit-heading">Проект / навык</th>
              {dates.map((date) => {
                const day = dateKey(date);
                const note = dayNotes[day];
                return (
                  <th
                    key={day}
                    className={day === todayKey ? "today-column" : ""}
                  >
                    <div className="day-heading">
                      <span>{formatWeekday(date)}</span>
                      <strong>{formatDay(date)}</strong>
                      <button
                        className={`day-note-button ${note ? "has-note" : ""}`}
                        type="button"
                        title={note ? note : `Добавить заметку на ${formatLongDay(day)}`}
                        aria-label={
                          note
                            ? `Открыть заметку на ${formatLongDay(day)}`
                            : `Добавить заметку на ${formatLongDay(day)}`
                        }
                        onClick={(event) => onOpenDayNoteEditor(event, day)}
                      >
                        <span className="day-note-glyph" aria-hidden="true">
                          ✎
                        </span>
                      </button>
                    </div>
                  </th>
                );
              })}
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
                          onClick={() => onToggleProject(habit.id)}
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
                          onClick={() => onOpenFullHabitName(habit)}
                        >
                          ...
                        </button>
                      ) : null}
                      <button
                        className="chart-button"
                        type="button"
                        aria-label={`Открыть диаграмму ${habit.name}`}
                        onClick={() => onOpenChart(habit)}
                      >
                        ▥
                      </button>
                      <button
                        className="edit-button"
                        type="button"
                        aria-label={`Редактировать ${habit.name}`}
                        onClick={() => onEditHabit(habit)}
                      >
                        ⚙
                      </button>
                      {!habit.parentId ? (
                        <button
                          className="add-subskill-button"
                          type="button"
                          aria-label={`Добавить упражнение в ${habit.name}`}
                          onClick={() => onAddSubSkill(habit)}
                        >
                          +
                        </button>
                      ) : null}
                    </div>
                    <span>
                      {habit.parentId
                        ? habit.area
                        : habit.childCount
                          ? `${habit.area} · ${formatSubskillCount(habit.childCount)}`
                          : habit.area}
                    </span>
                  </div>
                </th>
                {dates.map((date) => {
                  const day = dateKey(date);
                  const key = makeEntryKey(habit.id, day);
                  const entry = entries[key];

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
                          onTogglePicker(event, key, habit.id, day)
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
                    onClick={() => onDeleteHabit(habit)}
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
  );
}
