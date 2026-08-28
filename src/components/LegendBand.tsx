import { scoreColors, scoreLabels } from "../lib/tracker";
import type { Score } from "../storage";

export function LegendBand() {
  return (
    <section className="notes-band">
      <div>
        <h2>Телефон и компьютер</h2>
        <p>
          После публикации на GitHub Pages приложение откроется с любого
          устройства. Без входа данные останутся локальными; с Firebase и
          входом через email или Google новые хобби и оценки будут появляться
          везде.
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
