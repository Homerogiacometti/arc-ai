import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { Database, Row, SqlValue } from './database';

const DATABASE_NAME = 'arc-ai';

/** Implementação sobre o plugin SQLite do Capacitor (banco do próprio app no aparelho). */
export class CapacitorDatabase implements Database {
  readonly #connection: SQLiteConnection;
  readonly #db: SQLiteDBConnection;

  private constructor(connection: SQLiteConnection, db: SQLiteDBConnection) {
    this.#connection = connection;
    this.#db = db;
  }

  static async open(): Promise<CapacitorDatabase> {
    const connection = new SQLiteConnection(CapacitorSQLite);
    await connection.checkConnectionsConsistency();
    const exists = (await connection.isConnection(DATABASE_NAME, false)).result ?? false;
    const db = exists
      ? await connection.retrieveConnection(DATABASE_NAME, false)
      : await connection.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false);
    await db.open();
    return new CapacitorDatabase(connection, db);
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    // Transações são controladas por quem chama (BEGIN/COMMIT), não pelo plugin.
    await this.#db.run(sql, [...params], false);
  }

  async query(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    const result = await this.#db.query(sql, [...params]);
    return (result.values ?? []) as Row[];
  }

  async close(): Promise<void> {
    await this.#connection.closeConnection(DATABASE_NAME, false);
  }
}
