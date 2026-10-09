import { dateKey, planGoalSchema, type PlanGoal, type PracticePlan } from '../plan/plan';
import type { Database } from './database';

export interface PlanRepository {
  /** Todas as vigências, da mais antiga à mais recente. */
  list(): Promise<PracticePlan[]>;
  /** Salva o plano valendo a partir de hoje (editar de novo no mesmo dia substitui). */
  save(goal: PlanGoal): Promise<void>;
}

export class SqlPlanRepository implements PlanRepository {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  async list(): Promise<PracticePlan[]> {
    const rows = await this.#db.query(
      'SELECT valid_from, days_per_week, minutes_per_day FROM practice_plan ORDER BY valid_from',
    );
    return rows.map((row) => ({
      validFrom: String(row.valid_from),
      daysPerWeek: Number(row.days_per_week),
      minutesPerDay: Number(row.minutes_per_day),
    }));
  }

  async save(goal: PlanGoal): Promise<void> {
    const valid = planGoalSchema.parse(goal);
    const now = this.#now();
    await this.#db.run(
      `INSERT INTO practice_plan (valid_from, days_per_week, minutes_per_day, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (valid_from) DO UPDATE SET
         days_per_week = excluded.days_per_week,
         minutes_per_day = excluded.minutes_per_day,
         updated_at = excluded.updated_at`,
      [dateKey(now), valid.daysPerWeek, valid.minutesPerDay, now.toISOString()],
    );
  }
}
