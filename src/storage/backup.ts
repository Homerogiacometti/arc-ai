import { z } from 'zod';
import type { Database, Row } from './database';
import { currentVersion } from './migrations';

/**
 * Backup (RF14): JSON versionado com todas as tabelas do app — perfil, memória, plano,
 * configurações, sessões, transcrições e feedbacks. A chave de API fica no Keystore, fora do
 * banco, então nunca entra aqui. Lê as tabelas do próprio banco: as que vierem depois (V2)
 * entram sozinhas.
 */
export const BACKUP_FORMAT = 1;

const sqlValue = z.union([z.string(), z.number(), z.null()]);

export const backupSchema = z.object({
  app: z.literal('arc-ai'),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.string(),
  /** Versão das migrations do banco que gerou o backup. */
  schemaVersion: z.number().int().min(1),
  tables: z.record(z.string(), z.array(z.record(z.string(), sqlValue))),
});

export type Backup = z.infer<typeof backupSchema>;

export class BackupError extends Error {
  override readonly name = 'BackupError';
}

export async function exportBackup(db: Database, now: Date = new Date()): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const table of await tablesInInsertOrder(db)) {
    tables[table] = await db.query(`SELECT * FROM "${table}"`);
  }
  return {
    app: 'arc-ai',
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    schemaVersion: await currentVersion(db),
    tables,
  };
}

/** Lê e valida o arquivo; mensagens em português para a tela. */
export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um backup do Arc AI.');
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new BackupError('O arquivo não é um backup do Arc AI.');
  return parsed.data;
}

/** Resumo para a confirmação antes de importar. */
export function describeBackup(backup: Backup): { exportedAt: Date; sessions: number } {
  return {
    exportedAt: new Date(backup.exportedAt),
    sessions: backup.tables.sessions?.length ?? 0,
  };
}

/**
 * Substitui todos os dados pelos do backup, numa transação só: se qualquer linha for
 * recusada (tabela ou coluna desconhecida, CHECK, chave estrangeira), nada muda.
 * Backups de versões anteriores do banco funcionam porque as migrations só acrescentam.
 */
export async function importBackup(db: Database, backup: Backup): Promise<void> {
  if (backup.schemaVersion > (await currentVersion(db))) {
    throw new BackupError('Este backup é de uma versão mais nova do app. Atualize o Arc AI.');
  }
  const order = await tablesInInsertOrder(db);
  const columns = new Map<string, Set<string>>();
  for (const table of order) {
    const info = await db.query(`PRAGMA table_info("${table}")`);
    columns.set(table, new Set(info.map((row) => String(row.name))));
  }
  for (const [table, rows] of Object.entries(backup.tables)) {
    const known = columns.get(table);
    if (!known) throw new BackupError('O backup tem dados que este app não reconhece.');
    for (const row of rows) {
      if (Object.keys(row).some((column) => !known.has(column))) {
        throw new BackupError('O backup tem dados que este app não reconhece.');
      }
    }
  }

  await db.run('BEGIN');
  try {
    for (const table of [...order].reverse()) await db.run(`DELETE FROM "${table}"`);
    for (const table of order) {
      for (const row of backup.tables[table] ?? []) await insert(db, table, row);
    }
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    if (error instanceof BackupError) throw error;
    throw new BackupError('O backup está incompleto ou corrompido. Nada foi alterado.', {
      cause: error,
    });
  }
}

async function insert(db: Database, table: string, row: Row): Promise<void> {
  const keys = Object.keys(row);
  if (keys.length === 0) return;
  const names = keys.map((key) => `"${key}"`).join(', ');
  const marks = keys.map(() => '?').join(', ');
  await db.run(
    `INSERT INTO "${table}" (${names}) VALUES (${marks})`,
    keys.map((key) => row[key] ?? null),
  );
}

/** Tabelas do app (sem as internas), com as referenciadas antes das que as referenciam. */
async function tablesInInsertOrder(db: Database): Promise<string[]> {
  const rows = await db.query(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name <> 'schema_version' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  );
  const names = rows.map((row) => String(row.name));
  const parents = new Map<string, string[]>();
  for (const name of names) {
    const keys = await db.query(`PRAGMA foreign_key_list("${name}")`);
    parents.set(
      name,
      keys.map((key) => String(key.table)).filter((parent) => parent !== name),
    );
  }
  const ordered: string[] = [];
  const visit = (name: string, path: Set<string>) => {
    if (ordered.includes(name) || path.has(name)) return;
    path.add(name);
    for (const parent of parents.get(name) ?? []) visit(parent, path);
    ordered.push(name);
  };
  for (const name of names) visit(name, new Set());
  return ordered;
}
