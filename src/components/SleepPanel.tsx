import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SleepEntry, SleepKind } from "../storage";
import {
  formatSleepChartDate,
  formatSleepDate,
  formatSleepDuration,
  formatSleepTimeRange,
  getSleepDailyTotals,
  getSleepDurationMinutes,
  getSleepEntriesForRange,
  getSleepSummary,
  toLocalDateTimeInput,
  type SleepRangeDays,
} from "../lib/sleep";

type SleepPanelProps = {
  entries: SleepEntry[];
  onAdd: (entry: Omit<SleepEntry, "id">) => void;
  onDelete: (entry: SleepEntry) => void;
  todayKey: string;
};

function SleepIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20.4 15.6A8.7 8.7 0 0 1 8.4 3.6 8.7 8.7 0 1 0 20.4 15.6Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
    </svg>
  );
}

function createDefaultTimes() {
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end.getTime() - 8 * 60 * 60 * 1000);
  return {
    startAt: toLocalDateTimeInput(start),
    endAt: toLocalDateTimeInput(end),
  };
}

export function SleepPanel({ entries, onAdd, onDelete, todayKey }: SleepPanelProps) {
  const [rangeDays, setRangeDays] = useState<SleepRangeDays>(7);
  const [editorOpen, setEditorOpen] = useState(false);
  const [kind, setKind] = useState<SleepKind>("night");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [formError, setFormError] = useState("");
  const [entryToDelete, setEntryToDelete] = useState<SleepEntry | null>(null);

  const visibleEntries = useMemo(
    () => getSleepEntriesForRange(entries, todayKey, rangeDays),
    [entries, rangeDays, todayKey],
  );
  const summary = useMemo(() => getSleepSummary(visibleEntries), [visibleEntries]);
  const chartPoints = useMemo(
    () => getSleepDailyTotals(entries, todayKey, rangeDays),
    [entries, rangeDays, todayKey],
  );
  const chartMaximum = Math.max(12 * 60, ...chartPoints.map((point) => point.minutes));

  useEffect(() => {
    if (!editorOpen && !entryToDelete) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setEditorOpen(false);
      setEntryToDelete(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen, entryToDelete]);

  function openEditor() {
    const defaults = createDefaultTimes();
    setKind("night");
    setStartAt(defaults.startAt);
    setEndAt(defaults.endAt);
    setFormError("");
    setEditorOpen(true);
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startTime = new Date(startAt).getTime();
    const endTime = new Date(endAt).getTime();
    const duration = endTime - startTime;

    if (!startAt || !endAt || !Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      setFormError("Укажи время начала и окончания сна.");
      return;
    }
    if (duration <= 0) {
      setFormError("Время пробуждения должно быть позже времени засыпания.");
      return;
    }
    if (duration > 24 * 60 * 60 * 1000) {
      setFormError("Одна запись сна не может быть длиннее 24 часов.");
      return;
    }
    if (endTime > Date.now() + 60_000) {
      setFormError("Нельзя добавить сон, который ещё не закончился.");
      return;
    }
    const overlaps = entries.some((entry) => {
      const existingStart = new Date(entry.startAt).getTime();
      const existingEnd = new Date(entry.endAt).getTime();
      return startTime < existingEnd && endTime > existingStart;
    });
    if (overlaps) {
      setFormError("Эта запись пересекается с уже сохранённым периодом сна.");
      return;
    }

    onAdd({ kind, startAt, endAt });
    setEditorOpen(false);
  }

  return (
    <section className="sleep-panel" aria-labelledby="sleep-panel-title">
      <div className="sleep-panel-header">
        <div className="sleep-panel-title">
          <span className="sleep-panel-icon"><SleepIcon /></span>
          <div>
            <h2 id="sleep-panel-title">Сон</h2>
            <p>Ночной и дневной сон</p>
          </div>
        </div>
        <button className="primary-button sleep-add-button" type="button" onClick={openEditor}>
          <span aria-hidden="true">+</span>
          Добавить сон
        </button>
      </div>

      <div className="sleep-range-tabs" aria-label="Период статистики сна">
        <button
          aria-pressed={rangeDays === 7}
          className={rangeDays === 7 ? "active" : ""}
          type="button"
          onClick={() => setRangeDays(7)}
        >
          Неделя
        </button>
        <button
          aria-pressed={rangeDays === 30}
          className={rangeDays === 30 ? "active" : ""}
          type="button"
          onClick={() => setRangeDays(30)}
        >
          Месяц
        </button>
      </div>

      <div className="sleep-summary">
        <div>
          <span>Средний ночной</span>
          <strong>{summary.averageNightMinutes ? formatSleepDuration(summary.averageNightMinutes) : "Нет данных"}</strong>
        </div>
        <div>
          <span>Дневной сон</span>
          <strong>{formatSleepDuration(summary.dayMinutes)}</strong>
        </div>
        <div>
          <span>Всего за период</span>
          <strong>{formatSleepDuration(summary.totalMinutes)}</strong>
        </div>
      </div>

      <div className="sleep-chart-scroll">
        <div
          className={`sleep-chart sleep-chart-${rangeDays}`}
          aria-label={`Сон за ${rangeDays === 7 ? "неделю" : "месяц"}`}
        >
          {chartPoints.map((point) => (
            <div className="sleep-chart-column" key={point.date}>
              <span className="sleep-chart-value">
                {point.minutes ? formatSleepDuration(point.minutes) : ""}
              </span>
              <div className="sleep-chart-track">
                <span
                  className="sleep-chart-bar"
                  style={{ height: point.minutes ? `${Math.max(7, point.minutes / chartMaximum * 100)}%` : "0" }}
                />
              </div>
              <span className="sleep-chart-label">{formatSleepChartDate(point.date, rangeDays)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sleep-history">
        <h3>Записи</h3>
        {visibleEntries.length ? (
          visibleEntries.map((entry) => (
            <article className="sleep-entry" key={entry.id}>
              <span className={`sleep-kind-mark sleep-kind-${entry.kind}`} aria-hidden="true" />
              <div className="sleep-entry-main">
                <strong>{entry.kind === "night" ? "Ночной сон" : "Дневной сон"}</strong>
                <span>{formatSleepDate(entry)} · {formatSleepTimeRange(entry)}</span>
              </div>
              <strong className="sleep-entry-duration">
                {formatSleepDuration(getSleepDurationMinutes(entry))}
              </strong>
              <button
                className="sleep-delete-button"
                type="button"
                aria-label={`Удалить запись: ${formatSleepDate(entry)}`}
                title="Удалить запись"
                onClick={() => setEntryToDelete(entry)}
              >
                <TrashIcon />
              </button>
            </article>
          ))
        ) : (
          <p className="sleep-empty">За выбранный период записей пока нет.</p>
        )}
      </div>

      {editorOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <button className="dialog-scrim" type="button" aria-label="Закрыть добавление сна" onClick={() => setEditorOpen(false)} />
          <form className="confirm-dialog edit-dialog sleep-dialog" role="dialog" aria-modal="true" aria-labelledby="sleep-dialog-title" onSubmit={submitEntry}>
            <h2 id="sleep-dialog-title">Добавить сон</h2>
            <div className="sleep-kind-tabs" aria-label="Тип сна">
              <button className={kind === "night" ? "active" : ""} type="button" aria-pressed={kind === "night"} onClick={() => setKind("night")}>Ночной</button>
              <button className={kind === "day" ? "active" : ""} type="button" aria-pressed={kind === "day"} onClick={() => setKind("day")}>Дневной</button>
            </div>
            <div className="sleep-datetime-grid">
              <label>
                <span>Лёг</span>
                <input type="datetime-local" value={startAt} onChange={(event) => { setStartAt(event.target.value); setFormError(""); }} />
              </label>
              <label>
                <span>Встал</span>
                <input type="datetime-local" value={endAt} onChange={(event) => { setEndAt(event.target.value); setFormError(""); }} />
              </label>
            </div>
            {formError ? <p className="sleep-form-error" role="alert">{formError}</p> : null}
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setEditorOpen(false)}>Отмена</button>
              <button className="primary-button" type="submit">Сохранить</button>
            </div>
          </form>
        </div>
      ) : null}

      {entryToDelete ? (
        <div className="dialog-backdrop" role="presentation">
          <button className="dialog-scrim" type="button" aria-label="Закрыть подтверждение удаления" onClick={() => setEntryToDelete(null)} />
          <div className="confirm-dialog sleep-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="sleep-delete-title">
            <h2 id="sleep-delete-title">Удалить запись сна?</h2>
            <p>{formatSleepDate(entryToDelete)}, {formatSleepTimeRange(entryToDelete)}. Отменить это действие нельзя.</p>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setEntryToDelete(null)}>Отмена</button>
              <button className="danger-button" type="button" onClick={() => { onDelete(entryToDelete); setEntryToDelete(null); }}>Удалить</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
