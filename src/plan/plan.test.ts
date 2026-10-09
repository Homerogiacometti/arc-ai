import {
  addDays,
  buildWeek,
  computeProgress,
  dateKey,
  msByDay,
  planForWeek,
  weekStart,
  type PracticePlan,
} from './plan';

/** Sessão que começa no dia (hora local) e dura `minutes`. */
const session = (day: string, minutes: number, hour = 10) => {
  const [year, month, date] = day.split('-').map(Number);
  return {
    startedAt: new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, hour),
    durationMs: minutes * 60_000,
  };
};

const plan = (validFrom: string, daysPerWeek: number, minutesPerDay: number): PracticePlan => ({
  validFrom,
  daysPerWeek,
  minutesPerDay,
});

// 2026-10-05 é segunda-feira; 2026-10-08, quinta.
const thursday = new Date(2026, 9, 8, 20);

describe('datas', () => {
  it('usa o dia local e semanas de segunda a domingo', () => {
    expect(dateKey(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('soma as conversas do dia pelo início de cada uma', () => {
    const totals = msByDay([
      session('2026-10-06', 10),
      session('2026-10-06', 15, 21),
      session('2026-10-07', 5, 23),
    ]);
    expect(totals.get('2026-10-06')).toBe(25 * 60_000);
    expect(totals.get('2026-10-07')).toBe(5 * 60_000);
  });
});

describe('planForWeek', () => {
  const plans = [plan('2026-09-01', 3, 20), plan('2026-10-07', 5, 10)];

  it('usa o plano mais recente que começou até o fim da semana', () => {
    expect(planForWeek(plans, '2026-09-28')).toEqual({ daysPerWeek: 3, minutesPerDay: 20 });
    // Editado na quarta: já vale para a semana atual.
    expect(planForWeek(plans, '2026-10-05')).toEqual({ daysPerWeek: 5, minutesPerDay: 10 });
    expect(planForWeek(plans, '2026-08-24')).toBeNull();
  });
});

describe('buildWeek', () => {
  it('dia feito ao atingir a meta pela soma do dia; abaixo, parcial', () => {
    const totals = msByDay([
      session('2026-10-05', 20),
      session('2026-10-06', 12),
      session('2026-10-06', 8),
      session('2026-10-07', 19),
    ]);
    const week = buildWeek('2026-10-05', totals, [plan('2026-01-01', 2, 20)], '2026-10-08');
    expect(week.days.map((day) => day.status)).toEqual([
      'done',
      'done',
      'partial',
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(week.days[3]).toMatchObject({ isToday: true, isFuture: false });
    expect(week.days[4]?.isFuture).toBe(true);
    expect(week).toMatchObject({ minutes: 59, doneDays: 2, met: true });
  });

  it('sem plano, todo dia com conversa é parcial e a semana não conta', () => {
    const week = buildWeek('2026-10-05', msByDay([session('2026-10-05', 60)]), [], '2026-10-08');
    expect(week.days[0]?.status).toBe('partial');
    expect(week).toMatchObject({ plan: null, met: false });
  });
});

describe('computeProgress', () => {
  const plans = [plan('2026-09-14', 1, 10)];
  // Semanas (segundas): 14/09, 21/09, 28/09, 05/10 (atual).
  const met = (monday: string) => session(monday, 10);

  it('conta semanas cumpridas e a sequência até a semana atual', () => {
    const progress = computeProgress(
      [met('2026-09-14'), met('2026-09-28'), met('2026-10-05')],
      plans,
      thursday,
    );
    expect(progress.weeksMet).toBe(3);
    expect(progress.streak).toBe(2);
    expect(progress.current.start).toBe('2026-10-05');
    expect(progress.recent).toHaveLength(8);
    expect(progress.recent.at(-1)?.start).toBe('2026-10-05');
  });

  it('semana atual ainda não cumprida não quebra a sequência', () => {
    const progress = computeProgress([met('2026-09-21'), met('2026-09-28')], plans, thursday);
    expect(progress.streak).toBe(2);
    expect(progress.current.met).toBe(false);
  });

  it('sem plano, nada é contado', () => {
    const progress = computeProgress([met('2026-10-05')], [], thursday);
    expect(progress).toMatchObject({ weeksMet: 0, streak: 0 });
    expect(progress.current.minutes).toBe(10);
  });
});
