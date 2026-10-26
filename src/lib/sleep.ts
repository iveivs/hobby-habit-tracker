import type { SleepEntry } from "../storage";
import { shiftDate } from "./tracker";

export type SleepRangeDays = 7 | 30;

export type SleepDayPoint = {
  date: string;
  minutes: number;
};

export function getSleepDurationMinutes(entry: SleepEntry) {
  return Math.round(
    (new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) / 60_000,
  );
}

export function formatSleepDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (!hours) return `${remainder} мин`;
  if (!remainder) return `${hours} ч`;
  return `${hours} ч ${remainder} мин`;
}

export function getSleepEntriesForRange(
  entries: SleepEntry[],
  todayKey: string,
  days: SleepRangeDays,
) {
  const firstDate = shiftDate(todayKey, -(days - 1));
  return entries
    .filter((entry) => {
      const date = entry.endAt.slice(0, 10);
      return date >= firstDate && date <= todayKey;
    })
    .sort((left, right) => right.endAt.localeCompare(left.endAt));
}

export function getSleepDailyTotals(
  entries: SleepEntry[],
  todayKey: string,
  days: SleepRangeDays,
): SleepDayPoint[] {
  const totals = new Map<string, number>();
  getSleepEntriesForRange(entries, todayKey, days).forEach((entry) => {
    const date = entry.endAt.slice(0, 10);
    totals.set(date, (totals.get(date) ?? 0) + getSleepDurationMinutes(entry));
  });

  return Array.from({ length: days }, (_, index) => {
    const date = shiftDate(todayKey, index - days + 1);
    return { date, minutes: totals.get(date) ?? 0 };
  });
}

export function getSleepSummary(entries: SleepEntry[]) {
  const nightEntries = entries.filter((entry) => entry.kind === "night");
  const nightMinutes = nightEntries.reduce(
    (total, entry) => total + getSleepDurationMinutes(entry),
    0,
  );
  const dayMinutes = entries
    .filter((entry) => entry.kind === "day")
    .reduce((total, entry) => total + getSleepDurationMinutes(entry), 0);

  return {
    averageNightMinutes: nightEntries.length
      ? Math.round(nightMinutes / nightEntries.length)
      : 0,
    dayMinutes,
    totalMinutes: nightMinutes + dayMinutes,
  };
}

export function formatSleepDate(entry: SleepEntry) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(new Date(`${entry.endAt.slice(0, 10)}T12:00:00`));
}

export function formatSleepTimeRange(entry: SleepEntry) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(entry.startAt))} - ${formatter.format(
    new Date(entry.endAt),
  )}`;
}

export function formatSleepChartDate(date: string, days: SleepRangeDays) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: days === 30 ? "numeric" : undefined,
    weekday: days === 7 ? "short" : undefined,
  }).format(new Date(`${date}T12:00:00`));
}

export function toLocalDateTimeInput(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}
