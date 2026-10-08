import { learnerProfileSchema, type LearnerProfile } from '../config/profile';
import type { Database, Row } from './database';

export interface ProfileRepository {
  get(languageCode: string): Promise<LearnerProfile | null>;
  save(profile: LearnerProfile): Promise<void>;
}

export class SqlProfileRepository implements ProfileRepository {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  async get(languageCode: string): Promise<LearnerProfile | null> {
    const [row] = await this.#db.query(
      'SELECT language_code, level, interests, goals FROM learner_profile WHERE language_code = ?',
      [languageCode],
    );
    return row ? fromRow(row) : null;
  }

  async save(profile: LearnerProfile): Promise<void> {
    const valid = learnerProfileSchema.parse(profile);
    await this.#db.run(
      `INSERT INTO learner_profile (language_code, level, interests, goals, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (language_code) DO UPDATE SET
         level = excluded.level,
         interests = excluded.interests,
         goals = excluded.goals,
         updated_at = excluded.updated_at`,
      [valid.languageCode, valid.level, valid.interests, valid.goals, this.#now().toISOString()],
    );
  }
}

function fromRow(row: Row): LearnerProfile {
  return learnerProfileSchema.parse({
    languageCode: row.language_code,
    level: row.level,
    interests: row.interests,
    goals: row.goals,
  });
}
