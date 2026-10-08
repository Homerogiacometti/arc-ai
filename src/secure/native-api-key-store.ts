import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { API_KEY_STORAGE_KEY, type ApiKeyStore } from './api-key-store';

/** Android Keystore via `@aparajita/capacitor-secure-storage`. */
export class NativeApiKeyStore implements ApiKeyStore {
  async get(): Promise<string | null> {
    const value = await SecureStorage.getItem(API_KEY_STORAGE_KEY);
    return value || null;
  }

  async set(apiKey: string): Promise<void> {
    await SecureStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  }

  async remove(): Promise<void> {
    await SecureStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}
