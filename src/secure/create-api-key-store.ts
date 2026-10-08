import { Capacitor } from '@capacitor/core';
import type { ApiKeyStore } from './api-key-store';

export async function createApiKeyStore(): Promise<ApiKeyStore> {
  if (Capacitor.isNativePlatform()) {
    const { NativeApiKeyStore } = await import('./native-api-key-store');
    return new NativeApiKeyStore();
  }
  if (import.meta.env.DEV) {
    const { DevApiKeyStore } = await import('./dev-api-key-store');
    return new DevApiKeyStore();
  }
  throw new Error('Armazenamento seguro indisponível fora do aparelho.');
}
