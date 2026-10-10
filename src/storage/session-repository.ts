import { z } from 'zod';
import { feedbackSchema, type Feedback } from '../feedback/schema';
import type { Database, Row } from './database';

export type FeedbackStatus = 'pending' | 'ready' | 'failed' | 'skipped';

export interface TranscriptEntry {
  speaker: 'user' | 'ai';
  text: string;
}

export interface NewSession {
  languageCode: string;
  responseMode: string;
  instructionVersion: number;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  endReason: string;
  totalTokens: number;
  latenciesMs: number[];
  feedbackStatus: FeedbackStatus;
  transcript: TranscriptEntry[];
}

export interface SessionSummary {
  id: number;
  languageCode: string;
  responseMode: string;
  startedAt: Date;
  durationMs: number;
  feedbackStatus: FeedbackStatus;
}

export interface SessionDetail extends SessionSummary {
  endedAt: Date;
  endReason: string;
  totalTokens: number;
  latenciesMs: number[];
  reported: boolean;
  transcript: TranscriptEntry[];
  feedback: Feedback | null;
}

export interface FeedbackMeta {
  model: string;
  promptVersion: number;
}

export interface SessionRepository {
  create(session: NewSession): Promise<number>;
  list(): Promise<SessionSummary[]>;
  get(id: number): Promise<SessionDetail | null>;
  saveFeedback(id: number, feedback: Feedback, meta: FeedbackMeta): Promise<void>;
  setFeedbackStatus(id: number, status: FeedbackStatus): Promise<void>;
  /** RF15: o usuário reportou conteúdo inadequado desta sessão. */
  markReported(id: number): Promise<void>;
}

const SUMMARY_COLUMNS =
  'id, language_code, response_mode, started_at, duration_ms, feedback_status';
const latenciesSchema = z.array(z.number());

export class SqlSessionRepository implements SessionRepository {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  async create(session: NewSession): Promise<number> {
    await this.#db.run('BEGIN');
    try {
      await this.#db.run(
        `INSERT INTO sessions (language_code, response_mode, instruction_version, started_at,
           ended_at, duration_ms, end_reason, total_tokens, latencies_ms, feedback_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.languageCode,
          session.responseMode,
          session.instructionVersion,
          session.startedAt.toISOString(),
          session.endedAt.toISOString(),
          Math.round(session.durationMs),
          session.endReason,
          session.totalTokens,
          JSON.stringify(session.latenciesMs.map(Math.round)),
          session.feedbackStatus,
        ],
      );
      const [row] = await this.#db.query('SELECT last_insert_rowid() AS id');
      const id = Number(row?.id);
      for (const [position, turn] of session.transcript.entries()) {
        await this.#db.run(
          'INSERT INTO transcript_turns (session_id, position, speaker, text) VALUES (?, ?, ?, ?)',
          [id, position, turn.speaker, turn.text],
        );
      }
      await this.#db.run('COMMIT');
      return id;
    } catch (error) {
      await this.#db.run('ROLLBACK');
      throw error;
    }
  }

  async list(): Promise<SessionSummary[]> {
    const rows = await this.#db.query(
      `SELECT ${SUMMARY_COLUMNS} FROM sessions ORDER BY started_at DESC, id DESC`,
    );
    return rows.map(toSummary);
  }

  async get(id: number): Promise<SessionDetail | null> {
    const [row] = await this.#db.query(
      `SELECT ${SUMMARY_COLUMNS}, ended_at, end_reason, total_tokens, latencies_ms, reported
       FROM sessions WHERE id = ?`,
      [id],
    );
    if (!row) return null;
    const [turns, feedbackRows] = await Promise.all([
      this.#db.query(
        'SELECT speaker, text FROM transcript_turns WHERE session_id = ? ORDER BY position',
        [id],
      ),
      this.#db.query('SELECT data FROM feedbacks WHERE session_id = ?', [id]),
    ]);
    const feedback = parseFeedback(feedbackRows[0]?.data);
    const summary = toSummary(row);
    return {
      ...summary,
      // Feedback salvo que não valida mais no schema conta como falha (pode gerar de novo).
      feedbackStatus:
        summary.feedbackStatus === 'ready' && !feedback ? 'failed' : summary.feedbackStatus,
      endedAt: new Date(String(row.ended_at)),
      endReason: String(row.end_reason),
      totalTokens: Number(row.total_tokens),
      latenciesMs: latenciesSchema.catch([]).parse(safeJson(row.latencies_ms)),
      reported: row.reported === 1,
      transcript: turns.map((turn) => ({
        speaker: turn.speaker === 'ai' ? 'ai' : 'user',
        text: String(turn.text),
      })),
      feedback,
    };
  }

  async saveFeedback(id: number, feedback: Feedback, meta: FeedbackMeta): Promise<void> {
    const valid = feedbackSchema.parse(feedback);
    await this.#db.run('BEGIN');
    try {
      await this.#db.run(
        `INSERT INTO feedbacks (session_id, data, model, prompt_version, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (session_id) DO UPDATE SET
           data = excluded.data, model = excluded.model,
           prompt_version = excluded.prompt_version, created_at = excluded.created_at`,
        [id, JSON.stringify(valid), meta.model, meta.promptVersion, this.#now().toISOString()],
      );
      await this.#db.run("UPDATE sessions SET feedback_status = 'ready' WHERE id = ?", [id]);
      await this.#db.run('COMMIT');
    } catch (error) {
      await this.#db.run('ROLLBACK');
      throw error;
    }
  }

  async setFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
    await this.#db.run('UPDATE sessions SET feedback_status = ? WHERE id = ?', [status, id]);
  }

  async markReported(id: number): Promise<void> {
    await this.#db.run('UPDATE sessions SET reported = 1 WHERE id = ?', [id]);
  }
}

function toSummary(row: Row): SessionSummary {
  return {
    id: Number(row.id),
    languageCode: String(row.language_code),
    responseMode: String(row.response_mode),
    startedAt: new Date(String(row.started_at)),
    durationMs: Number(row.duration_ms),
    feedbackStatus: z
      .enum(['pending', 'ready', 'failed', 'skipped'])
      .catch('failed')
      .parse(row.feedback_status),
  };
}

function parseFeedback(data: unknown): Feedback | null {
  if (typeof data !== 'string') return null;
  const parsed = feedbackSchema.safeParse(safeJson(data));
  return parsed.success ? parsed.data : null;
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}
