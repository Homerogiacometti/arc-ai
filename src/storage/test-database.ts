import initSqlJs from 'sql.js';
import type { Database } from './database';
import { migrate } from './migrations';
import { SqlJsDatabase } from './sqljs-database';

/** Banco em memória com todas as migrations aplicadas, para testes. */
export async function createTestDatabase(options: { migrate?: boolean } = {}): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SqlJsDatabase(new SQL.Database());
  if (options.migrate !== false) await migrate(db);
  return db;
}
