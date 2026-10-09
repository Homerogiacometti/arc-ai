import { z } from 'zod';
import {
  EMPTY_MEMORY,
  memoryKey,
  normalizeMemory,
  type MemoryListName,
  type MemoryLists,
} from '../memory/memory';
import type { Database, Row } from './database';

export type MemoryKind = 'personal' | 'mistake' | 'strength';

export interface MemoryItem {
  id: number;
  kind: MemoryKind;
  /** Nulo para itens pessoais (compartilhados entre idiomas). */
  languageCode: string | null;
  content: string;
  updatedAt: Date;
}

export interface MemoryRepository {
  /** Todos os itens, para a tela de memória. */
  list(): Promise<MemoryItem[]>;
  /** Memória usada na conversa e no feedback de um idioma: pessoais + erros e acertos dele. */
  forLanguage(languageCode: string): Promise<MemoryLists>;
  /** Substitui as listas do idioma (e as pessoais) pelas atualizadas no feedback. */
  replace(languageCode: string, lists: MemoryLists): Promise<void>;
  remove(id: number): Promise<void>;
  /** Apaga toda a memória, de todos os idiomas. */
  clear(): Promise<void>;
}

const KIND_OF: Record<MemoryListName, MemoryKind> = {
  personal: 'personal',
  mistakes: 'mistake',
  strengths: 'strength',
};

const kindSchema = z.enum(['personal', 'mistake', 'strength']);

export class SqlMemoryRepository implements MemoryRepository {
  readonly #db: Database;
  readonly #now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.#db = db;
    this.#now = now;
  }

  async list(): Promise<MemoryItem[]> {
    const rows = await this.#db.query(
      `SELECT id, kind, language_code, content, updated_at FROM memory
       ORDER BY language_code IS NOT NULL, language_code, kind, position`,
    );
    return rows.map(toItem);
  }

  async forLanguage(languageCode: string): Promise<MemoryLists> {
    const items = await this.#select(languageCode);
    const lists: MemoryLists = { personal: [], mistakes: [], strengths: [] };
    for (const item of items) lists[listOf(item.kind)].push(item.content);
    return lists;
  }

  async replace(languageCode: string, lists: MemoryLists): Promise<void> {
    const valid = normalizeMemory({ ...EMPTY_MEMORY, ...lists });
    await this.#db.run('BEGIN');
    try {
      // Itens que já existiam mantêm a data em que entraram ou mudaram pela última vez.
      const previous = new Map(
        (await this.#select(languageCode)).map((item) => [
          `${item.kind}:${memoryKey(item.content)}`,
          item.updatedAt.toISOString(),
        ]),
      );
      await this.#db.run(
        "DELETE FROM memory WHERE language_code IS NULL OR (language_code = ? AND kind <> 'personal')",
        [languageCode],
      );
      const now = this.#now().toISOString();
      for (const name of Object.keys(KIND_OF) as MemoryListName[]) {
        const kind = KIND_OF[name];
        for (const [position, content] of valid[name].entries()) {
          await this.#db.run(
            `INSERT INTO memory (kind, language_code, position, content, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              kind,
              kind === 'personal' ? null : languageCode,
              position,
              content,
              previous.get(`${kind}:${memoryKey(content)}`) ?? now,
            ],
          );
        }
      }
      await this.#db.run('COMMIT');
    } catch (error) {
      await this.#db.run('ROLLBACK');
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.#db.run('DELETE FROM memory WHERE id = ?', [id]);
  }

  async clear(): Promise<void> {
    await this.#db.run('DELETE FROM memory');
  }

  async #select(languageCode: string): Promise<MemoryItem[]> {
    const rows = await this.#db.query(
      `SELECT id, kind, language_code, content, updated_at FROM memory
       WHERE language_code IS NULL OR language_code = ?
       ORDER BY kind, position`,
      [languageCode],
    );
    return rows.map(toItem);
  }
}

function listOf(kind: MemoryKind): MemoryListName {
  return kind === 'personal' ? 'personal' : kind === 'mistake' ? 'mistakes' : 'strengths';
}

function toItem(row: Row): MemoryItem {
  return {
    id: Number(row.id),
    kind: kindSchema.parse(row.kind),
    languageCode: row.language_code === null ? null : String(row.language_code),
    content: String(row.content),
    updatedAt: new Date(String(row.updated_at)),
  };
}
