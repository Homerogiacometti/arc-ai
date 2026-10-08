import type { Database as SqlJsDb, SqlValue as SqlJsValue } from 'sql.js';
import type { Database, Row, SqlValue } from './database';

/** Implementação sobre sql.js (SQLite em WebAssembly, em memória). */
export class SqlJsDatabase implements Database {
  readonly #db: SqlJsDb;

  constructor(db: SqlJsDb) {
    this.#db = db;
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    this.#db.run(sql, [...params]);
    return Promise.resolve();
  }

  query(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    const statement = this.#db.prepare(sql, [...params]);
    const rows: Row[] = [];
    try {
      while (statement.step()) {
        rows.push(toRow(statement.getAsObject()));
      }
    } finally {
      statement.free();
    }
    return Promise.resolve(rows);
  }

  close(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }
}

function toRow(object: Record<string, SqlJsValue>): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(object)) {
    if (value instanceof Uint8Array) throw new Error(`Coluna BLOB não suportada: ${key}`);
    row[key] = value;
  }
  return row;
}
