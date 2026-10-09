import type { Database } from './database';

export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

/**
 * Migrations versionadas, aplicadas em ordem e nunca editadas depois de publicadas.
 * Cada marco adiciona as tabelas que usa (SPEC §8).
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE learner_profile (
        language_code TEXT PRIMARY KEY,
        level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
        interests TEXT NOT NULL DEFAULT '',
        goals TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        language_code TEXT NOT NULL,
        response_mode TEXT NOT NULL,
        pause_level TEXT NOT NULL
      )`,
    ],
  },
  {
    // M4: sessões, transcrição e feedback (RF09, RF10, RF12).
    version: 2,
    statements: [
      `CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language_code TEXT NOT NULL,
        response_mode TEXT NOT NULL,
        instruction_version INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        end_reason TEXT NOT NULL,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        latencies_ms TEXT NOT NULL DEFAULT '[]',
        feedback_status TEXT NOT NULL
          CHECK (feedback_status IN ('pending', 'ready', 'failed', 'skipped')),
        reported INTEGER NOT NULL DEFAULT 0
      )`,
      'CREATE INDEX sessions_started_at ON sessions (started_at)',
      `CREATE TABLE transcript_turns (
        session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        speaker TEXT NOT NULL CHECK (speaker IN ('user', 'ai')),
        text TEXT NOT NULL,
        PRIMARY KEY (session_id, position)
      )`,
      `CREATE TABLE feedbacks (
        session_id INTEGER PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    // M5: memória entre sessões (RF11). Itens pessoais não têm idioma; erros e acertos têm.
    version: 3,
    statements: [
      `CREATE TABLE memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('personal', 'mistake', 'strength')),
        language_code TEXT,
        position INTEGER NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((kind = 'personal') = (language_code IS NULL))
      )`,
      'CREATE INDEX memory_language ON memory (language_code, kind, position)',
    ],
  },
];

export async function currentVersion(db: Database): Promise<number> {
  await db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const [row] = await db.query('SELECT MAX(version) AS version FROM schema_version');
  return typeof row?.version === 'number' ? row.version : 0;
}

/** Liga as chaves estrangeiras (vale por conexão, fora de transação) e aplica as migrations. */
export async function prepareDatabase(db: Database): Promise<number> {
  await db.run('PRAGMA foreign_keys = ON');
  return migrate(db);
}

/** Aplica as migrations pendentes. Devolve a versão final. */
export async function migrate(
  db: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  let version = await currentVersion(db);
  const pending = migrations
    .filter((migration) => migration.version > version)
    .toSorted((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.run('BEGIN');
    try {
      for (const statement of migration.statements) {
        await db.run(statement);
      }
      await db.run('INSERT INTO schema_version (version) VALUES (?)', [migration.version]);
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
    version = migration.version;
  }
  return version;
}
