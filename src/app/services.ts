import type { ApiKeyStore } from '../secure/api-key-store';
import { createApiKeyStore } from '../secure/create-api-key-store';
import { validateApiKey, type ApiKeyValidation } from '../secure/validate-api-key';
import { openDatabase } from '../storage/open-database';
import { SqlProfileRepository, type ProfileRepository } from '../storage/profile-repository';
import { SqlSettingsRepository, type SettingsRepository } from '../storage/settings-repository';

/** Dependências do app, injetadas pela UI (permite trocar por versões falsas nos testes). */
export interface Services {
  apiKeyStore: ApiKeyStore;
  profiles: ProfileRepository;
  settings: SettingsRepository;
  validateApiKey: (apiKey: string) => Promise<ApiKeyValidation>;
}

export async function createServices(): Promise<Services> {
  const [db, apiKeyStore] = await Promise.all([openDatabase(), createApiKeyStore()]);
  return {
    apiKeyStore,
    profiles: new SqlProfileRepository(db),
    settings: new SqlSettingsRepository(db),
    validateApiKey: (apiKey) => validateApiKey(apiKey),
  };
}
