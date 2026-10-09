import type { Services } from '../app/services';
import { FakeInput, FakeOutput, FakeProvider } from '../conversation/fakes';
import { SAMPLE_RESPONSE } from '../feedback/fixtures';
import type { JsonModel } from '../feedback/generate-feedback';
import { eraseAllData } from '../storage/erase-all';
import { SqlMemoryRepository } from '../storage/memory-repository';
import { SqlPlanRepository } from '../storage/plan-repository';
import { SqlProfileRepository } from '../storage/profile-repository';
import { SqlSessionRepository } from '../storage/session-repository';
import { SqlSettingsRepository } from '../storage/settings-repository';
import { createTestDatabase } from '../storage/test-database';

export class MemoryApiKeyStore {
  value: string | null;
  constructor(value: string | null = null) {
    this.value = value;
  }
  get = () => Promise.resolve(this.value);
  set = (apiKey: string) => {
    this.value = apiKey;
    return Promise.resolve();
  };
  remove = () => {
    this.value = null;
    return Promise.resolve();
  };
}

/** Serviços completos para testes de UI: banco sql.js real e áudio/modelos falsos. */
export async function createTestServices(options: { apiKey?: string | null } = {}) {
  const db = await createTestDatabase();
  const apiKeyStore = new MemoryApiKeyStore(
    options.apiKey === undefined ? 'AIzaKEY' : options.apiKey,
  );
  const provider = new FakeProvider();
  const generateJson = vi.fn<JsonModel['generateJson']>(() =>
    Promise.resolve(JSON.stringify(SAMPLE_RESPONSE)),
  );
  const screen = {
    keepAwake: vi.fn(() => Promise.resolve()),
    allowSleep: vi.fn(() => Promise.resolve()),
  };
  const validateApiKey = vi.fn<Services['validateApiKey']>(() => Promise.resolve({ ok: true }));
  const services = {
    apiKeyStore,
    profiles: new SqlProfileRepository(db),
    settings: new SqlSettingsRepository(db),
    sessions: new SqlSessionRepository(db),
    memory: new SqlMemoryRepository(db),
    plans: new SqlPlanRepository(db),
    feedbackModels: [
      { name: 'fake-model', generateJson },
      { name: 'fake-fallback', generateJson },
    ],
    feedbackRetryWait: () => Promise.resolve(),
    validateApiKey,
    eraseAllData: async () => {
      await eraseAllData(db);
      await apiKeyStore.remove();
    },
    conversation: {
      provider,
      createInput: () => new FakeInput(),
      createOutput: (onIdle: () => void) => new FakeOutput(onIdle),
    },
    screen,
  } satisfies Services;
  return { services, db, apiKeyStore, provider, generateJson, screen, validateApiKey };
}
