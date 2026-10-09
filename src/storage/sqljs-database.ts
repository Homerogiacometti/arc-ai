import type { Database as SqlJsDb, SqlValue as SqlJsValue } from 'sql.js';
import type { Database, Row, SqlValue } from './database';

/**
 * Implementação sobre sql.js (SQLite em WebAssembly, em memória). O sql.js lança erros de
 * forma síncrona; aqui eles viram promessas rejeitadas, como no plugin do aparelho.
 */
export class SqlJsDatabase implements Database {
  readonly #db: SqlJsDb;

  constructor(db: SqlJsDb) {
    this.#db = db;
  }

  run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    return attempt(() => {
      this.#db.run(sql, [...params]);
    });
  }

  query(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    return attempt(() => {
      const statement = this.#db.prepare(sql, [...params]);
      const rows: Row[] = [];
      try {
        while (statement.step()) {
          rows.push(toRow(statement.getAsObject()));
        }
      } finally {
        statement.free();
      }
      return rows;
    });
  }

  close(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }
}

function attempt<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
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
