import { CEFR_LEVELS } from '../../feedback/schema';
import type { LevelPoint } from '../../evaluation/evaluation';

const WIDTH = 300;
const HEIGHT = 150;
const LEFT = 28;
const RIGHT = 8;
const TOP = 8;
const BOTTOM = 8;

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Notas das últimas conversas (pontos) e a média móvel (linha), com uma faixa por nível CEFR.
 * Há uma tabela para leitores de tela.
 */
export function LevelChart({ points }: { points: readonly LevelPoint[] }) {
  const values = points.flatMap((point) => [point.score, point.average]);
  const min = Math.max(0, Math.floor(Math.min(...values)));
  const max = Math.min(CEFR_LEVELS.length, Math.max(min + 1, Math.ceil(Math.max(...values))));
  const x = (index: number) =>
    points.length === 1
      ? LEFT + (WIDTH - LEFT - RIGHT) / 2
      : LEFT + (index / (points.length - 1)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - (value - min) / (max - min)) * (HEIGHT - TOP - BOTTOM);
  const levels = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const line = points
    .map((point, index) => `${x(index).toFixed(1)},${y(point.average).toFixed(1)}`)
    .join(' ');

  return (
    <figure className="level-chart">
      <svg
        className="level-chart__plot"
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        aria-hidden="true"
      >
        {levels.map((level) => (
          <g key={level}>
            <line
              className="level-chart__grid"
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(level)}
              y2={y(level)}
            />
            {level < max && (
              <text className="level-chart__label" x={0} y={y(level + 0.5) + 4}>
                {CEFR_LEVELS[level]}
              </text>
            )}
          </g>
        ))}
        {points.length > 1 && <polyline className="level-chart__average" points={line} />}
        {points.map((point, index) => (
          <circle
            key={point.date.toISOString() + String(index)}
            className="level-chart__dot"
            cx={x(index)}
            cy={y(point.score)}
            r={3}
          />
        ))}
      </svg>
      <p className="level-chart__key" aria-hidden="true">
        <span className="level-chart__key-dot" /> nota da conversa
        <span className="level-chart__key-line" /> média
      </p>
      <table className="visually-hidden">
        <caption>Nota por conversa</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Nota</th>
            <th scope="col">Média</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.date.toISOString() + String(index)}>
              <td>{shortDate.format(point.date)}</td>
              <td>{describeScore(point.score)}</td>
              <td>{describeScore(point.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function describeScore(score: number): string {
  const index = Math.min(CEFR_LEVELS.length - 1, Math.floor(score));
  return `${CEFR_LEVELS[index] ?? ''} (${String(Math.round((score - index) * 100))}%)`;
}
