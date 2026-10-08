import { API_KEY_STORAGE_KEY, type ApiKeyStore } from './api-key-store';

/**
 * Fallback para rodar no navegador durante o desenvolvimento. Usa localStorage, que
 * NÃO é seguro: por isso só existe em build de dev (ver `createApiKeyStore`).
 */
export class DevApiKeyStore implements ApiKeyStore {
  readonly #storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.#storage = storage;
  }

  get(): Promise<string | null> {
    return Promise.resolve(this.#storage.getItem(API_KEY_STORAGE_KEY));
  }

  set(apiKey: string): Promise<void> {
    this.#storage.setItem(API_KEY_STORAGE_KEY, apiKey);
    return Promise.resolve();
  }

  remove(): Promise<void> {
    this.#storage.removeItem(API_KEY_STORAGE_KEY);
    return Promise.resolve();
  }
}
