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
];

export async function currentVersion(db: Database): Promise<number> {
  await db.run('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const [row] = await db.query('SELECT MAX(version) AS version FROM schema_version');
  return typeof row?.version === 'number' ? row.version : 0;
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
