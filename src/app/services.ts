import { Microphone } from '../audio/microphone';
import { PcmPlayer } from '../audio/player';
import type { ConversationProvider } from '../conversation/provider';
import type { JsonModel } from '../feedback/generate-feedback';
import { GeminiTextModel } from '../feedback/gemini-text-model';
import { MODELS } from '../config/models';
import type { AudioInput, AudioOutput } from '../conversation/session-controller';
import type { ApiKeyStore } from '../secure/api-key-store';
import { createApiKeyStore } from '../secure/create-api-key-store';
import { validateApiKey, type ApiKeyValidation } from '../secure/validate-api-key';
import { eraseAllData } from '../storage/erase-all';
import { SqlMemoryRepository, type MemoryRepository } from '../storage/memory-repository';
import { openDatabase } from '../storage/open-database';
import { SqlPlanRepository, type PlanRepository } from '../storage/plan-repository';
import { SqlProfileRepository, type ProfileRepository } from '../storage/profile-repository';
import { SqlSessionRepository, type SessionRepository } from '../storage/session-repository';
import { SqlSettingsRepository, type SettingsRepository } from '../storage/settings-repository';
import { createScreen, type Screen } from './screen';

/** Dependências do app, injetadas pela UI (permite trocar por versões falsas nos testes). */
export interface Services {
  apiKeyStore: ApiKeyStore;
  profiles: ProfileRepository;
  settings: SettingsRepository;
  sessions: SessionRepository;
  memory: MemoryRepository;
  plans: PlanRepository;
  /** Modelos do feedback em ordem de preferência: principal e reserva. */
  feedbackModels: readonly JsonModel[];
  /** Espera entre tentativas do feedback; padrão: tempo real. Os testes passam uma instantânea. */
  feedbackRetryWait?: (ms: number) => Promise<void>;
  validateApiKey: (apiKey: string) => Promise<ApiKeyValidation>;
  /** Apaga todos os dados do app e a chave de API (RF16). */
  eraseAllData: () => Promise<void>;
  conversation: {
    provider: ConversationProvider;
    createInput: () => AudioInput;
    createOutput: (onIdle: () => void) => AudioOutput;
  };
  screen: Screen;
}

export async function createServices(): Promise<Services> {
  const [db, apiKeyStore] = await Promise.all([openDatabase(), createApiKeyStore()]);
  return {
    apiKeyStore,
    profiles: new SqlProfileRepository(db),
    settings: new SqlSettingsRepository(db),
    sessions: new SqlSessionRepository(db),
    memory: new SqlMemoryRepository(db),
    plans: new SqlPlanRepository(db),
    feedbackModels: [new GeminiTextModel(MODELS.text), new GeminiTextModel(MODELS.textFallback)],
    validateApiKey: (apiKey) => validateApiKey(apiKey),
    eraseAllData: async () => {
      await eraseAllData(db);
      await apiKeyStore.remove();
    },
    conversation: {
      provider: lazyGeminiProvider(),
      createInput: () => new Microphone(),
      createOutput: (onIdle) => new PcmPlayer({ onIdle }),
    },
    screen: createScreen(),
  };
}

/** Carrega o SDK do Gemini só na primeira conversa, deixando a abertura do app leve. */
function lazyGeminiProvider(): ConversationProvider {
  let provider: Promise<ConversationProvider> | null = null;
  return {
    connect: async (options, events) => {
      provider ??= import('../conversation/gemini-live-provider').then(
        ({ GeminiLiveProvider }) => new GeminiLiveProvider(),
      );
      return (await provider).connect(options, events);
    },
  };
}
