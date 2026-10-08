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
