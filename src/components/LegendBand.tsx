import { scoreColors, scoreLabels } from "../lib/tracker";
import type { Score } from "../storage";

export function LegendBand() {
  return (
    <section className="notes-band">
      <div>
        <h2>Прогресс начинается с наблюдения</h2>
        <p>
          Hab-Hob помогает отмечать привычки и упражнения, сохранять заметки и
          видеть изменения по дням. Регулярный трекинг показывает, что уже
          работает хорошо, а где стоит скорректировать ритм.
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
  );
}
