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
      `SELECT language_code, response_mode, pause_level, voice, theme, conversation_style,
         custom_instructions
       FROM settings WHERE id = 1`,
    );
    if (!row) return DEFAULT_SETTINGS;
    // Cada campo salvo que deixou de existir na configuração (ex.: idioma removido) volta ao padrão.
    const field = <K extends keyof Settings>(key: K, value: unknown): Settings[K] => {
      const parsed = settingsSchema.shape[key].safeParse(value);
      return parsed.success ? (parsed.data as Settings[K]) : DEFAULT_SETTINGS[key];
    };
    return {
      languageCode: field('languageCode', row.language_code),
      responseMode: field('responseMode', row.response_mode),
      pauseLevel: field('pauseLevel', row.pause_level),
      voice: field('voice', row.voice),
      theme: field('theme', row.theme),
      conversationStyle: field('conversationStyle', row.conversation_style),
      customInstructions: field('customInstructions', row.custom_instructions),
    };
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    const next = settingsSchema.parse({ ...(await this.get()), ...changes });
    await this.#db.run(
      `INSERT INTO settings (id, language_code, response_mode, pause_level, voice, theme,
         conversation_style, custom_instructions)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         language_code = excluded.language_code,
         response_mode = excluded.response_mode,
         pause_level = excluded.pause_level,
         voice = excluded.voice,
         theme = excluded.theme,
         conversation_style = excluded.conversation_style,
         custom_instructions = excluded.custom_instructions`,
      [
        next.languageCode,
        next.responseMode,
        next.pauseLevel,
        next.voice,
        next.theme,
        next.conversationStyle,
        next.customInstructions,
      ],
    );
    return next;
  }
}
