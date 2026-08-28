import { type FormEvent, type ReactNode } from "react";
import {
  chartRanges,
  chartViews,
  dayNoteLimit,
  formatChartDate,
  formatLongDay,
  isFutureDay,
  scoreColors,
  scoreLabels,
  type AuthMode,
  type ChartRange,
  type ChartView,
  type DayNoteEditorState,
  type PickerState,
} from "../lib/tracker";
import type { Habit, Score } from "../storage";

function ModalShell({
  ariaLabel,
  children,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <button
        className="dialog-scrim"
        type="button"
        aria-label={ariaLabel}
        onClick={onClose}
      />
      {children}
    </div>
  );
}

type ScorePopoverProps = {
  hasDayNote: boolean;
  onOpenDayNote: (date: string) => void;
  onSetScore: (habitId: string, date: string, score: Score | null) => void;
  picker: PickerState | null;
  todayKey: string;
};

export function ScorePopover({
  hasDayNote,
  onOpenDayNote,
  onSetScore,
  picker,
  todayKey,
}: ScorePopoverProps) {
  if (!picker) return null;

  const futureDay = isFutureDay(picker.date, todayKey);

  return (
    <div
      className="score-popover"
      role="menu"
      style={{ left: picker.left, top: picker.top }}
    >
      {!futureDay
        ? ([1, 2, 3, 4, 5] as Score[]).map((score) => (
            <button
              key={score}
              type="button"
              style={{ backgroundColor: scoreColors[score] }}
              onClick={() => onSetScore(picker.habitId, picker.date, score)}
            >
              <strong>{score}</strong>
              <span>{scoreLabels[score]}</span>
            </button>
          ))
        : null}
      <button
        className="note-popover-action"
        type="button"
        onClick={() => onOpenDayNote(picker.date)}
      >
        {hasDayNote ? "Изменить заметку" : "Добавить заметку"}
      </button>
      {!futureDay ? (
        <button
          className="clear-score"
          type="button"
          onClick={() => onSetScore(picker.habitId, picker.date, null)}
        >
          Очистить
        </button>
      ) : null}
    </div>
  );
}

type DayNoteEditorProps = {
  draft: string;
  editor: DayNoteEditorState | null;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onDelete: (date: string) => void;
  onSave: () => void;
};

export function DayNoteEditor({
  draft,
  editor,
  onChangeDraft,
  onClose,
  onDelete,
  onSave,
}: DayNoteEditorProps) {
  if (!editor) return null;

  return (
    <div
      className="day-note-editor"
      role="dialog"
      aria-modal="false"
      aria-labelledby="day-note-title"
      style={{ left: editor.left, top: editor.top }}
    >
      <div className="day-note-editor-head">
        <div>
          <strong id="day-note-title">Заметка на день</strong>
          <span>{formatLongDay(editor.date)}</span>
        </div>
        <button
          className="archive-button"
          type="button"
          aria-label="Закрыть заметку"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <label className="day-note-field">
        <span className="sr-only">Текст заметки</span>
        <textarea
          maxLength={dayNoteLimit}
          placeholder="Коротко зафиксируй мысль, событие или контекст этого дня"
          value={draft}
          onChange={(event) => onChangeDraft(event.target.value)}
        />
      </label>
      <div className="day-note-editor-meta">
        <span>
          {draft.length} / {dayNoteLimit}
        </span>
      </div>
      <div className="day-note-editor-actions">
        <button
          className="ghost-button note-delete-button"
          type="button"
          onClick={() => onDelete(editor.date)}
        >
          Удалить
        </button>
        <div className="day-note-editor-buttons">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" type="button" onClick={onSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

type DeleteHabitDialogProps = {
  habit: Habit | null;
  hasChildren: boolean;
  onClose: () => void;
  onConfirm: (habitId: string) => void;
};

export function DeleteHabitDialog({
  habit,
  hasChildren,
  onClose,
  onConfirm,
}: DeleteHabitDialogProps) {
  if (!habit) return null;

  return (
    <ModalShell ariaLabel="Закрыть подтверждение удаления" onClose={onClose}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-habit-title"
      >
        <h2 id="delete-habit-title">Удалить привычку?</h2>
        <p>
          Строка «{habit.name}»
          {hasChildren ? " вместе с упражнениями" : ""} и все её оценки исчезнут из
          таблицы. Это действие нельзя будет отменить.
        </p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => onConfirm(habit.id)}
          >
            Удалить
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type AddSubSkillDialogProps = {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  parent: Habit | null;
  value: string;
  onChange: (value: string) => void;
};

export function AddSubSkillDialog({
  onChange,
  onClose,
  onSubmit,
  parent,
  value,
}: AddSubSkillDialogProps) {
  if (!parent) return null;

  return (
    <ModalShell ariaLabel="Закрыть добавление упражнения" onClose={onClose}>
      <form
        className="confirm-dialog edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-subskill-title"
        onSubmit={onSubmit}
      >
        <h2 id="new-subskill-title">Добавить упражнение</h2>
        <p className="dialog-context">{parent.name}</p>
        <label>
          <span>Название</span>
          <input
            maxLength={120}
            placeholder="Например, игра с метрономом"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" type="submit">
            Добавить
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

type EditHabitDialogProps = {
  area: string;
  habit: Habit | null;
  name: string;
  onAreaChange: (value: string) => void;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function EditHabitDialog({
  area,
  habit,
  name,
  onAreaChange,
  onClose,
  onNameChange,
  onSubmit,
}: EditHabitDialogProps) {
  if (!habit) return null;

  return (
    <ModalShell ariaLabel="Закрыть редактирование привычки" onClose={onClose}>
      <form
        className="confirm-dialog edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-habit-title"
        onSubmit={onSubmit}
      >
        <h2 id="edit-habit-title">Редактировать привычку</h2>
        <label>
          <span>Название</span>
          <input maxLength={120} value={name} onChange={(event) => onNameChange(event.target.value)} />
        </label>
        <label>
          <span>Категория</span>
          <input maxLength={48} value={area} onChange={(event) => onAreaChange(event.target.value)} />
        </label>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" type="submit">
            Сохранить
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

type FullNameDialogProps = {
  habit: Habit | null;
  onClose: () => void;
};

export function FullNameDialog({ habit, onClose }: FullNameDialogProps) {
  if (!habit) return null;

  return (
    <ModalShell ariaLabel="Закрыть полное название" onClose={onClose}>
      <div
        className="confirm-dialog full-name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-habit-title"
      >
        <h2 id="full-habit-title">Полное название</h2>
        <p>{habit.name}</p>
        <div className="dialog-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type ProfileDialogProps = {
  draft: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  userName: string | null;
};

export function ProfileDialog({
  draft,
  onChange,
  onClose,
  onSubmit,
  open,
  userName,
}: ProfileDialogProps) {
  if (!open) return null;

  return (
    <ModalShell ariaLabel="Закрыть профиль" onClose={onClose}>
      <form
        className="confirm-dialog edit-dialog profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onSubmit={onSubmit}
      >
        <h2 id="profile-title">Профиль</h2>
        <p className="dialog-context">{userName ?? "Аккаунт Firebase"}</p>
        <label>
          <span>Никнейм</span>
          <input
            maxLength={40}
            placeholder="Как показывать тебя в приложении"
            value={draft}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <p className="profile-hint">
          Никнейм виден только внутри Hab-Hob. Если оставить поле пустым, будет
          показан email или имя из аккаунта.
        </p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" type="submit">
            Сохранить
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

type ChartPoint = {
  date: string;
  score: Score;
};

type ChartDialogProps = {
  average: string;
  bestScore: number;
  habit: Habit | null;
  points: ChartPoint[];
  range: ChartRange;
  scoreBreakdown: Array<{ score: Score; count: number }>;
  total: number;
  view: ChartView;
  onClose: () => void;
  onRangeChange: (range: ChartRange) => void;
  onViewChange: (view: ChartView) => void;
};

export function ChartDialog({
  average,
  bestScore,
  habit,
  points,
  range,
  scoreBreakdown,
  total,
  view,
  onClose,
  onRangeChange,
  onViewChange,
}: ChartDialogProps) {
  if (!habit) return null;

  return (
    <ModalShell ariaLabel="Закрыть диаграмму" onClose={onClose}>
      <div
        className="confirm-dialog chart-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-title"
      >
        <div className="chart-head">
          <div>
            <p className="eyebrow">Диаграмма привычки</p>
            <h2 id="chart-title">{habit.name}</h2>
          </div>
          <button
            className="archive-button"
            type="button"
            aria-label="Закрыть диаграмму"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="range-tabs" role="tablist" aria-label="Период">
          {(Object.keys(chartRanges) as ChartRange[]).map((nextRange) => (
            <button
              className={range === nextRange ? "active" : ""}
              key={nextRange}
              type="button"
              role="tab"
              aria-selected={range === nextRange}
              onClick={() => onRangeChange(nextRange)}
            >
              {chartRanges[nextRange]}
            </button>
          ))}
        </div>
        <div className="chart-view-tabs" role="tablist" aria-label="Вид диаграммы">
          {(Object.keys(chartViews) as ChartView[]).map((nextView) => (
            <button
              className={view === nextView ? "active" : ""}
              key={nextView}
              type="button"
              role="tab"
              aria-selected={view === nextView}
              onClick={() => onViewChange(nextView)}
            >
              {chartViews[nextView]}
            </button>
          ))}
        </div>
        <div className="chart-stats" aria-label="Статистика диаграммы">
          <span>
            Отметок <strong>{points.length}</strong>
          </span>
          <span>
            Средняя <strong>{average}</strong>
          </span>
          <span>
            Лучшая <strong>{bestScore || "-"}</strong>
          </span>
        </div>
        {points.length ? (
          view === "donut" ? (
            <div className="donut-chart-layout">
              <div className="donut-chart-wrap" aria-hidden="true">
                <svg className="donut-chart" viewBox="0 0 120 120" role="presentation">
                  <circle
                    className="donut-chart-base"
                    cx="60"
                    cy="60"
                    r="42"
                    pathLength="100"
                  />
                  {scoreBreakdown.map((item, index) => {
                    if (!total || item.count === 0) return null;
                    const offset =
                      scoreBreakdown
                        .slice(0, index)
                        .reduce((sum, part) => sum + part.count, 0) / total;
                    return (
                      <circle
                        key={item.score}
                        className="donut-chart-segment"
                        cx="60"
                        cy="60"
                        r="42"
                        pathLength="100"
                        stroke={scoreColors[item.score]}
                        strokeDasharray={`${(item.count / total) * 100} 100`}
                        strokeDashoffset={`${25 - offset * 100}`}
                      />
                    );
                  })}
                </svg>
                <div className="donut-chart-center">
                  <strong>{average}</strong>
                  <span>средняя</span>
                </div>
              </div>
              <div className="donut-legend" aria-label="Распределение оценок">
                {scoreBreakdown.map((item) => (
                  <div className="donut-legend-row" key={item.score}>
                    <span className="donut-legend-main">
                      <i style={{ backgroundColor: scoreColors[item.score] }} />
                      {item.score} - {scoreLabels[item.score]}
                    </span>
                    <strong>
                      {item.count}
                      {total ? ` · ${Math.round((item.count / total) * 100)}%` : ""}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chart-scroll">
              <div className="chart-bars">
                {points.map((entry) => (
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
          <div className="chart-empty">Пока нет оценок за выбранный период.</div>
        )}
      </div>
    </ModalShell>
  );
}

type AuthDialogProps = {
  busy: boolean;
  email: string;
  message: string;
  mode: AuthMode | null;
  password: string;
  passwordRepeat: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangePasswordRepeat: (value: string) => void;
  onClose: () => void;
  onGoogleAuth: () => void;
  onPasswordReset: () => void;
  onSelectMode: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthDialog({
  busy,
  email,
  message,
  mode,
  password,
  passwordRepeat,
  onChangeEmail,
  onChangePassword,
  onChangePasswordRepeat,
  onClose,
  onGoogleAuth,
  onPasswordReset,
  onSelectMode,
  onSubmit,
}: AuthDialogProps) {
  if (!mode) return null;

  return (
    <ModalShell ariaLabel="Закрыть вход" onClose={onClose}>
      <form
        className="confirm-dialog auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onSubmit={onSubmit}
      >
        <h2 id="auth-title">Синхронизация</h2>
        <p>
          Email и пароль удобнее для телефона и встроенных браузеров. Google можно
          оставить как быстрый вход на компьютере.
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Режим входа">
          <button
            className={mode === "signin" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => onSelectMode("signin")}
          >
            Вход
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => onSelectMode("signup")}
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
            value={email}
            onChange={(event) => onChangeEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Пароль</span>
          <input
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            placeholder="Минимум 6 символов"
            type="password"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
          />
        </label>
        {mode === "signup" ? (
          <label>
            <span>Повтор пароля</span>
            <input
              autoComplete="new-password"
              minLength={6}
              placeholder="Повтори пароль"
              type="password"
              value={passwordRepeat}
              onChange={(event) => onChangePasswordRepeat(event.target.value)}
            />
          </label>
        ) : null}
        {message ? (
          <p className="auth-message" role="status">
            {message}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Подожди..." : mode === "signup" ? "Создать аккаунт" : "Войти"}
          </button>
        </div>
        <div className="auth-extra-actions">
          {mode === "signin" ? (
            <button type="button" onClick={onPasswordReset}>
              Сбросить пароль
            </button>
          ) : null}
          <button type="button" onClick={onGoogleAuth} disabled={busy}>
            Войти через Google
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
