import type { DayProgress, WeekProgress } from '../../plan/plan';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const WEEKDAY_NAMES = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
] as const;

const STATUS_LABEL: Record<DayProgress['status'], string> = {
  done: 'feito',
  partial: 'parcial',
  none: 'sem conversa',
};

/** Semana atual: dias marcados sozinhos quando a soma das conversas atinge a meta (RF13). */
export function WeekView({ week }: { week: WeekProgress }) {
  const goal = week.plan;
  return (
    <section className="section" aria-labelledby="plan-week">
      <h2 className="section__title" id="plan-week">
        Esta semana
      </h2>
      <p className="screen__text" role="status">
        {week.met
          ? `Meta da semana cumprida: ${String(week.doneDays)} ${week.doneDays === 1 ? 'dia' : 'dias'} · ${String(week.minutes)} min.`
          : `${String(week.doneDays)} de ${String(goal?.daysPerWeek ?? 0)} dias · ${String(week.minutes)} min no total.`}
      </p>
      <ol className="week">
        {week.days.map((day, index) => (
          <li
            key={day.date}
            className={`week__day week__day--${day.status}${day.isToday ? ' week__day--today' : ''}${day.isFuture ? ' week__day--future' : ''}`}
            aria-label={`${WEEKDAY_NAMES[index] ?? ''}: ${STATUS_LABEL[day.status]}, ${String(day.minutes)} min`}
          >
            <span className="week__name" aria-hidden="true">
              {WEEKDAYS[index]}
            </span>
            <span className="week__mark" aria-hidden="true">
              {day.status === 'done' ? '✓' : day.status === 'partial' ? '½' : ''}
            </span>
            <span className="week__minutes" aria-hidden="true">
              {day.minutes > 0 ? `${String(day.minutes)}′` : '–'}
            </span>
          </li>
        ))}
      </ol>
      <p className="week__legend">✓ feito · ½ parcial (abaixo de {goal?.minutesPerDay ?? 0} min)</p>
    </section>
  );
}
