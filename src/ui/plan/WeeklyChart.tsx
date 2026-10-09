import { useState } from 'react';
import { parseKey, type WeekProgress } from '../../plan/plan';

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function weekLabel(week: WeekProgress): string {
  return shortDate.format(parseKey(week.start));
}

function weeklyGoal(week: WeekProgress): number | null {
  return week.plan ? week.plan.daysPerWeek * week.plan.minutesPerDay : null;
}

function describe(week: WeekProgress): string {
  const goal = weeklyGoal(week);
  return `Semana de ${weekLabel(week)}: ${String(week.minutes)} min${goal === null ? '' : ` (meta ${String(goal)} min${week.met ? ', cumprida' : ''})`}`;
}

/**
 * Minutos por semana (RF13): uma série, colunas finas a partir da base, com a meta da semana
 * marcada em cada coluna. Tocar numa coluna mostra o valor; há uma tabela para leitores de tela.
 */
export function WeeklyChart({ weeks }: { weeks: readonly WeekProgress[] }) {
  const [selected, setSelected] = useState(weeks.length - 1);
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.minutes, weeklyGoal(week) ?? 0)));
  const chosen = weeks[selected];

  return (
    <figure className="chart">
      <figcaption className="chart__title">Minutos por semana</figcaption>
      <div className="chart__plot" aria-hidden="true">
        {weeks.map((week, index) => {
          const goal = weeklyGoal(week);
          return (
            <button
              key={week.start}
              type="button"
              tabIndex={-1}
              className={`chart__slot${index === selected ? ' chart__slot--selected' : ''}`}
              onClick={() => {
                setSelected(index);
              }}
            >
              {goal !== null && (
                <span
                  className="chart__goal"
                  style={{ bottom: `${String((goal / max) * 100)}%` }}
                />
              )}
              <span
                className="chart__bar"
                style={{ height: `${String((week.minutes / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="chart__axis" aria-hidden="true">
        {weeks.map((week, index) => (
          <span key={week.start} className="chart__tick">
            {index % 2 === weeks.length % 2 ? '' : weekLabel(week)}
          </span>
        ))}
      </div>
      <p className="chart__readout" aria-hidden="true">
        {chosen ? describe(chosen) : ''}
      </p>
      <p className="chart__key" aria-hidden="true">
        <span className="chart__key-goal" /> meta da semana
      </p>
      <table className="visually-hidden">
        <caption>Minutos por semana</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            <th scope="col">Minutos</th>
            <th scope="col">Meta</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.start}>
              <td>{weekLabel(week)}</td>
              <td>{week.minutes}</td>
              <td>{weeklyGoal(week) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
