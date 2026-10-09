import type { Database } from './database';

/**
 * Apaga os dados de todas as tabelas do app (RF16), mantendo o esquema e a versão das
 * migrations. Lista as tabelas do próprio banco, então cobre também as que vierem depois.
 */
export async function eraseAllData(db: Database): Promise<void> {
  const tables = await db.query(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name <> 'schema_version' AND name NOT LIKE 'sqlite_%'`,
  );
  await db.run('BEGIN');
  try {
    for (const { name } of tables) await db.run(`DELETE FROM "${String(name)}"`);
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
