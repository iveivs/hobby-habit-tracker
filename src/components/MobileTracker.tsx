import { type MouseEvent } from "react";
import { makeEntryKey, type Habit, type TrackerState } from "../storage";
import {
  dateKey,
  formatDay,
  formatSubskillCount,
  formatWeekday,
  getNotePreview,
  scoreColors,
} from "../lib/tracker";

type MobileTrackerProps = {
  childrenByParent: Map<string, Habit[]>;
  dayNotes: Record<string, string>;
  entries: TrackerState["entries"];
  expandedProjects: Set<string>;
  mobileDates: Date[];
  onAddSubSkill: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  onEditHabit: (habit: Habit) => void;
  onOpenChart: (habit: Habit) => void;
  onOpenDayNoteEditor: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onTogglePicker: (
    event: MouseEvent<HTMLButtonElement>,
    key: string,
    habitId: string,
    date: string,
  ) => void;
  onToggleProject: (projectId: string) => void;
  rootHabits: Habit[];
  todayKey: string;
};

export function MobileTracker({
  childrenByParent,
  dayNotes,
  entries,
  expandedProjects,
  mobileDates,
  onAddSubSkill,
  onDeleteHabit,
  onEditHabit,
  onOpenChart,
  onOpenDayNoteEditor,
  onTogglePicker,
  onToggleProject,
  rootHabits,
  todayKey,
}: MobileTrackerProps) {
  return (
    <section className="mobile-tracker" aria-label="Навыки по дням">
      <div className="mobile-day-notes" aria-label="Заметки по дням">
        {mobileDates.map((date) => {
          const day = dateKey(date);
          const note = dayNotes[day];

          return (
            <button
              className={`mobile-note-card ${note ? "has-note" : ""}`}
              key={day}
              type="button"
              onClick={(event) => onOpenDayNoteEditor(event, day)}
            >
              <span className="mobile-note-date">
                {formatWeekday(date)}
                <strong>{formatDay(date)}</strong>
              </span>
              <span className="mobile-note-body">
                <span className="day-note-glyph" aria-hidden="true">
                  ✎
                </span>
                <span>{note ? getNotePreview(note, 46) : "Добавить заметку"}</span>
              </span>
            </button>
          );
        })}
      </div>

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
              onClick={() => children.length && onToggleProject(habit.id)}
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
                onClick={() => onOpenChart(habit)}
              >
                График
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => onEditHabit(habit)}
              >
                Изменить
              </button>
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={() => onAddSubSkill(habit)}
              >
                Упражнение
              </button>
              <button
                className="archive-button mobile-delete-button"
                type="button"
                aria-label={`Удалить ${habit.name}`}
                onClick={() => onDeleteHabit(habit)}
              >
                ×
              </button>
            </div>

            <div className="mobile-skill-stack">
              {habitsToShow.map((rowHabit) => (
                <div
                  className={rowHabit.parentId ? "mobile-day-row child" : "mobile-day-row"}
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
                        onClick={() => onOpenChart(rowHabit)}
                      >
                        ▥
                      </button>
                      <button
                        className="edit-button"
                        type="button"
                        aria-label={`Редактировать ${rowHabit.name}`}
                        onClick={() => onEditHabit(rowHabit)}
                      >
                        ⚙
                      </button>
                    </div>
                  ) : null}
                  <div className="mobile-days">
                    {mobileDates.map((date) => {
                      const day = dateKey(date);
                      const key = makeEntryKey(rowHabit.id, day);
                      const entry = entries[key];
                      return (
                        <div
                          className={day === todayKey ? "mobile-day today" : "mobile-day"}
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
                              onTogglePicker(event, key, rowHabit.id, day)
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
  );
}
