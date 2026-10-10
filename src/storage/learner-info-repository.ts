import { EMPTY_LEARNER_INFO, learnerInfoSchema, type LearnerInfo } from '../config/profile';
import type { Database } from './database';

export interface LearnerInfoRepository {
  /** Interesses e objetivos; vazios quando ainda não há nada salvo. */
  get(): Promise<LearnerInfo>;
  save(info: LearnerInfo): Promise<void>;
}

export class SqlLearnerInfoRepository implements LearnerInfoRepository {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  async get(): Promise<LearnerInfo> {
    const [row] = await this.#db.query('SELECT interests, goals FROM learner_info WHERE id = 1');
    if (!row) return EMPTY_LEARNER_INFO;
    const parsed = learnerInfoSchema.safeParse({ interests: row.interests, goals: row.goals });
    return parsed.success ? parsed.data : EMPTY_LEARNER_INFO;
  }

  async save(info: LearnerInfo): Promise<void> {
    const valid = learnerInfoSchema.parse(info);
    await this.#db.run(
      `INSERT INTO learner_info (id, interests, goals, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         interests = excluded.interests,
         goals = excluded.goals,
         updated_at = excluded.updated_at`,
      [valid.interests, valid.goals, this.#now().toISOString()],
    );
  }
}
