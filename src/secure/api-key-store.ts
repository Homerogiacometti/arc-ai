/**
 * Armazenamento da chave de API do Gemini (RF01, RNF06).
 * A chave nunca vai para logs, estado persistido comum ou backup.
 */
export interface ApiKeyStore {
  get(): Promise<string | null>;
  set(apiKey: string): Promise<void>;
  remove(): Promise<void>;
}

export const API_KEY_STORAGE_KEY = 'gemini-api-key';
