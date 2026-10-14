import { currentVersion, migrate, MIGRATIONS } from './migrations';
import { createTestDatabase } from './test-database';

describe('migrations', () => {
  it('aplica todas as migrations num banco vazio', async () => {
    const db = await createTestDatabase({ migrate: false });
    const latest = Math.max(...MIGRATIONS.map((migration) => migration.version));
    expect(await migrate(db)).toBe(latest);

    const tables = await db.query("SELECT name FROM sqlite_master WHERE type = 'table'");
    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining(['schema_version', 'learner_profile', 'settings']),
    );
  });

  it('é idempotente', async () => {
    const db = await createTestDatabase();
    const before = await currentVersion(db);
    expect(await migrate(db)).toBe(before);
    const rows = await db.query('SELECT version FROM schema_version');
    expect(rows).toHaveLength(MIGRATIONS.length);
  });

  it('7: o plano único passa a valer para cada idioma aprendido', async () => {
    const db = await createTestDatabase({ migrate: false });
    await migrate(
      db,
      MIGRATIONS.filter((migration) => migration.version <= 6),
    );
    await db.run(
      "INSERT INTO settings (id, language_code, response_mode, pause_level) VALUES (1, 'en-US', 'quick', 'medium')",
    );
    for (const code of ['en-US', 'es-ES']) {
      await db.run(
        "INSERT INTO learner_profile (language_code, level, updated_at) VALUES (?, 'beginner', 'x')",
        [code],
      );
    }
    await db.run(
      "INSERT INTO practice_plan (valid_from, days_per_week, minutes_per_day, updated_at) VALUES ('2026-10-01', 3, 20, 'x')",
    );

    await migrate(db);
    const rows = await db.query(
      'SELECT language_code, valid_from, days_per_week FROM practice_plan ORDER BY language_code',
    );
    expect(rows).toEqual([
      { language_code: 'en-US', valid_from: '2026-10-01', days_per_week: 3 },
      { language_code: 'es-ES', valid_from: '2026-10-01', days_per_week: 3 },
    ]);
    const [settings] = await db.query(
      'SELECT conversation_style, custom_instructions FROM settings',
    );
    expect(settings).toEqual({ conversation_style: 'balanced', custom_instructions: '' });
  });

  it('desfaz a migration inteira quando um comando falha', async () => {
    const db = await createTestDatabase();
    const before = await currentVersion(db);
    await expect(
      migrate(db, [
        ...MIGRATIONS,
        { version: before + 1, statements: ['CREATE TABLE temp_ok (id INTEGER)', 'NOT SQL'] },
      ]),
    ).rejects.toThrow();
    expect(await currentVersion(db)).toBe(before);
    const tables = await db.query("SELECT name FROM sqlite_master WHERE name = 'temp_ok'");
    expect(tables).toHaveLength(0);
  });
});
