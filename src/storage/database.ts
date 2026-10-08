export type SqlValue = string | number | null;

export type Row = Record<string, SqlValue>;

/**
 * Acesso mínimo ao SQLite. Duas implementações: Capacitor (aparelho) e sql.js
 * (testes e navegador em dev), que rodam exatamente as mesmas migrations.
 */
export interface Database {
  /** Executa um comando (INSERT, UPDATE, DDL...). */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Executa uma consulta e devolve as linhas como objetos. */
  query(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  close(): Promise<void>;
}
