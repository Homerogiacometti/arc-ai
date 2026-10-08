import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '../config/settings';
import type { Database } from './database';

export interface SettingsRepository {
  /** Configurações salvas, ou os padrões quando ainda não há nada salvo. */
  get(): Promise<Settings>;
  update(changes: Partial<Settings>): Promise<Settings>;
}

export class SqlSettingsRepository implements SettingsRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async get(): Promise<Settings> {
    const [row] = await this.#db.query(
      'SELECT language_code, response_mode, pause_level FROM settings WHERE id = 1',
    );
    if (!row) return DEFAULT_SETTINGS;
    const parsed = settingsSchema.safeParse({
      languageCode: row.language_code,
      responseMode: row.response_mode,
      pauseLevel: row.pause_level,
    });
    // Valor salvo que deixou de existir na configuração (ex.: idioma removido) volta ao padrão.
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    const next = settingsSchema.parse({ ...(await this.get()), ...changes });
    await this.#db.run(
      `INSERT INTO settings (id, language_code, response_mode, pause_level) VALUES (1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         language_code = excluded.language_code,
         response_mode = excluded.response_mode,
         pause_level = excluded.pause_level`,
      [next.languageCode, next.responseMode, next.pauseLevel],
    );
    return next;
  }
}
