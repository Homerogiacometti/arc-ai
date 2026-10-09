import { z } from 'zod';

/**
 * Cronograma (RF13). Datas são dias do calendário local, no formato YYYY-MM-DD. A semana vai
 * de segunda a domingo.
 */
export const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const MINUTES_PER_DAY_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

export const planGoalSchema = z.object({
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerDay: z.number().int().min(1).max(240),
});

export type PlanGoal = z.infer<typeof planGoalSchema>;

/** Plano com vigência: vale a partir de `validFrom` até o próximo plano. */
export interface PracticePlan extends PlanGoal {
  validFrom: string;
}

export interface PracticeSession {
  startedAt: Date;
  durationMs: number;
}

/** Dia feito quando a soma das conversas atinge a meta; abaixo disso, parcial. */
export type DayStatus = 'done' | 'partial' | 'none';

export interface DayProgress {
  date: string;
  minutes: number;
  status: DayStatus;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekProgress {
  /** Segunda-feira da semana. */
  start: string;
  days: DayProgress[];
  minutes: number;
  doneDays: number;
  /** Plano em vigor na semana; nulo antes do primeiro plano. */
  plan: PlanGoal | null;
  met: boolean;
}

export interface Progress {
  current: WeekProgress;
  /** Últimas semanas, da mais antiga à atual. */
  recent: WeekProgress[];
  /** Semanas com a meta cumprida desde o primeiro plano. */
  weeksMet: number;
  /** Semanas seguidas na meta, até a atual (se já cumprida) ou até a anterior. */
  streak: number;
}

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Converte YYYY-MM-DD para meio-dia local (imune a horário de verão). */
export function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12);
}

export function addDays(key: string, days: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Segunda-feira da semana da data. */
export function weekStart(key: string): string {
  const weekday = (parseKey(key).getDay() + 6) % 7;
  return addDays(key, -weekday);
}

/** Tempo de conversa por dia; a sessão conta no dia em que começou. */
export function msByDay(sessions: readonly PracticeSession[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const key = dateKey(session.startedAt);
    totals.set(key, (totals.get(key) ?? 0) + Math.max(0, session.durationMs));
  }
  return totals;
}

/** Plano em vigor numa semana: o mais recente que começou até o fim dela. */
export function planForWeek(plans: readonly PracticePlan[], start: string): PlanGoal | null {
  const end = addDays(start, 6);
  let chosen: PracticePlan | null = null;
  for (const plan of plans) {
    if (plan.validFrom <= end && (!chosen || plan.validFrom > chosen.validFrom)) chosen = plan;
  }
  return chosen && { daysPerWeek: chosen.daysPerWeek, minutesPerDay: chosen.minutesPerDay };
}

export function buildWeek(
  start: string,
  totals: ReadonlyMap<string, number>,
  plans: readonly PracticePlan[],
  today: string,
): WeekProgress {
  const plan = planForWeek(plans, start);
  const days = Array.from({ length: 7 }, (_, index): DayProgress => {
    const date = addDays(start, index);
    const ms = totals.get(date) ?? 0;
    const status: DayStatus =
      ms === 0 ? 'none' : plan && ms >= plan.minutesPerDay * 60_000 ? 'done' : 'partial';
    return {
      date,
      minutes: Math.floor(ms / 60_000),
      status,
      isToday: date === today,
      isFuture: date > today,
    };
  });
  const doneDays = days.filter((day) => day.status === 'done').length;
  const ms = days.reduce((sum, day) => sum + (totals.get(day.date) ?? 0), 0);
  return {
    start,
    days,
    minutes: Math.floor(ms / 60_000),
    doneDays,
    plan,
    met: plan !== null && doneDays >= plan.daysPerWeek,
  };
}

export function computeProgress(
  sessions: readonly PracticeSession[],
  plans: readonly PracticePlan[],
  today: Date,
  recentWeeks = 8,
): Progress {
  const todayKey = dateKey(today);
  const totals = msByDay(sessions);
  const currentStart = weekStart(todayKey);
  const week = (start: string) => buildWeek(start, totals, plans, todayKey);

  const recent = Array.from({ length: recentWeeks }, (_, index) =>
    week(addDays(currentStart, -7 * (recentWeeks - 1 - index))),
  );

  // Todas as semanas desde o primeiro plano, da atual para trás.
  const firstPlan = plans.reduce<string | null>(
    (first, plan) => (first === null || plan.validFrom < first ? plan.validFrom : first),
    null,
  );
  const history: WeekProgress[] = [];
  if (firstPlan) {
    const firstStart = weekStart(firstPlan);
    for (let start = currentStart; start >= firstStart; start = addDays(start, -7)) {
      history.push(week(start));
    }
  }

  let streak = 0;
  for (const [index, item] of history.entries()) {
    if (item.met) streak++;
    else if (index > 0) break; // a semana atual ainda pode ser cumprida
  }

  return {
    current: recent[recent.length - 1] ?? week(currentStart),
    recent,
    weeksMet: history.filter((item) => item.met).length,
    streak,
  };
}
