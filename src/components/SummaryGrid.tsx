import type { TrackerStats } from "../lib/tracker";

type SummaryGridProps = {
  stats: TrackerStats;
};

export function SummaryGrid({ stats }: SummaryGridProps) {
  return (
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
        <span>Дней с отметками</span>
        <strong>{stats.trackedDays}</strong>
      </article>
    </section>
  );
}
