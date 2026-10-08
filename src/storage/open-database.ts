import { Capacitor } from '@capacitor/core';
import type { Database } from './database';
import { migrate } from './migrations';

/**
 * Abre o banco e aplica as migrations. No aparelho usa o SQLite nativo; no navegador
 * (apenas dev) usa sql.js em memória — os dados somem ao recarregar a página.
 */
export async function openDatabase(): Promise<Database> {
  let db: Database;
  if (Capacitor.isNativePlatform()) {
    const { CapacitorDatabase } = await import('./capacitor-database');
    db = await CapacitorDatabase.open();
  } else {
    const [{ default: initSqlJs }, { default: wasmUrl }, { SqlJsDatabase }] = await Promise.all([
      import('sql.js'),
      import('sql.js/dist/sql-wasm.wasm?url'),
      import('./sqljs-database'),
    ]);
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    db = new SqlJsDatabase(new SQL.Database());
  }
  await migrate(db);
  return db;
}
