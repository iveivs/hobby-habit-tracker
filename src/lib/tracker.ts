import type { Habit, Score, TrackerState } from "../storage";

export const scoreLabels: Record<Score, string> = {
  1: "слабо",
  2: "частично",
  3: "нормально",
  4: "хорошо",
  5: "отлично",
};

export const scoreColors: Record<Score, string> = {
  1: "#e66767",
  2: "#f0a24a",
  3: "#e8cf52",
  4: "#70b86f",
  5: "#4b8fe2",
};

export const habitColors = ["#2f80ed", "#2f9e6d", "#d46b32", "#8f5bd3", "#c44569"];
export const popoverWidth = 180;
export const popoverHeight = 254;
export const noteEditorWidth = 320;
export const noteEditorHeight = 272;
export const longHabitNameLimit = 38;
export const dayNoteLimit = 500;
export const themeStorageKey = "hobby-habit-theme";

export type Theme = "light" | "dark";
export type AuthMode = "signin" | "signup";
export type ChartRange = "week" | "month" | "all";
export type ChartView = "donut" | "timeline";

export const chartRanges: Record<ChartRange, string> = {
  week: "Неделя",
  month: "Месяц",
  all: "Всё время",
};

export const chartViews: Record<ChartView, string> = {
  donut: "Круговая",
  timeline: "По дням",
};

export type HabitRow = Habit & {
  depth: number;
  childCount: number;
};

export type PickerState = {
  key: string;
  habitId: string;
  date: string;
  top: number;
  left: number;
};

export type DayNoteEditorState = {
  date: string;
  top: number;
  left: number;
};

export type TrackerStats = {
  habitCount: number;
  total: number;
  average: string;
  best: number;
};

export function loadTheme(): Theme {
  const savedTheme = localStorage.getItem(themeStorageKey);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isFutureDay(day: string, todayKey = dateKey(new Date())) {
  return day > todayKey;
}

export function getDateWindow(daysBefore: number, daysAfter: number) {
  const dates: Date[] = [];
  const today = new Date();
  for (let offset = -daysBefore; offset <= daysAfter; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    dates.push(date);
  }
  return dates;
}

export function formatDay(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date);
}

export function formatChartDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatLongDay(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

export function getNotePreview(note: string, limit = 72) {
  if (note.length <= limit) return note;
  return `${note.slice(0, limit).trimEnd()}...`;
}

export function getStats(state: TrackerState): TrackerStats {
  const habits = state.habits.filter((habit) => !habit.archived);
  const scores = Object.values(state.entries).map((entry) => entry.score);
  const total = scores.length;
  const average = total
    ? (scores.reduce((sum, score) => sum + score, 0) / total).toFixed(1)
    : "0.0";
  const best = scores.filter((score) => score >= 4).length;
  return { habitCount: habits.length, total, average, best };
}

export function formatSubskillCount(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} упражнение`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} упражнения`;
  }
  return `${count} упражнений`;
}

export function getActiveHabits(habits: Habit[]) {
  return habits.filter((habit) => !habit.archived);
}

export function getChildrenByParent(habits: Habit[]) {
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

export function getVisibleHabitRows(
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

export function getChartPoints(
  state: TrackerState,
  habitId: string,
  range: ChartRange,
) {
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

export function getExpandedProjectsFromState(state: TrackerState) {
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
