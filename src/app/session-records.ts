import { findLanguage } from '../config/languages';
import { HISTORY } from '../config/limits';
import type { LearnerProfile } from '../config/profile';
import type { Settings } from '../config/settings';
import type { SessionResult } from '../conversation/session-controller';
import {
  FeedbackError,
  generateFeedback,
  hasUserSpeech,
  type FeedbackFailure,
} from '../feedback/generate-feedback';
import { FEEDBACK_PROMPT_VERSION } from '../feedback/prompt';
import type { MemoryLists } from '../memory/memory';
import { CONVERSATION_INSTRUCTION_VERSION } from '../prompts/conversation-instruction';
import type { Services } from './services';

type Deps = Pick<Services, 'sessions' | 'profiles' | 'memory' | 'apiKeyStore' | 'feedbackModels'> &
  Partial<Pick<Services, 'feedbackRetryWait'>>;

/**
 * Salva a sessão encerrada (RF09, RF12). Sessões sem nenhuma fala não são salvas.
 * Devolve o id, ou null quando não havia nada a guardar.
 */
export async function recordSession(
  { sessions }: Pick<Deps, 'sessions'>,
  result: SessionResult,
  settings: Pick<Settings, 'languageCode' | 'responseMode'>,
): Promise<number | null> {
  if (result.transcript.length === 0) return null;
  const id = await sessions.create({
    languageCode: settings.languageCode,
    responseMode: settings.responseMode,
    instructionVersion: CONVERSATION_INSTRUCTION_VERSION,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMs: result.durationMs,
    endReason: result.endReason,
    totalTokens: result.totalTokens,
    latenciesMs: result.latenciesMs,
    feedbackStatus: hasUserSpeech(result.transcript) ? 'pending' : 'skipped',
    transcript: result.transcript,
  });
  await pruneTranscripts(sessions);
  return id;
}

/** Só as últimas conversas do Histórico guardam a transcrição; falhar aqui não é grave. */
async function pruneTranscripts(sessions: Deps['sessions']): Promise<void> {
  try {
    await sessions.pruneTranscripts(HISTORY.visibleSessions);
  } catch (error) {
    console.warn('[histórico] falhou ao podar transcrições:', describeError(error));
  }
}

/**
 * Gera e salva o feedback de uma sessão pendente ou que falhou antes (RF10) e atualiza a
 * memória do aluno com o que a conversa trouxe (RF11).
 * Em caso de falha, a sessão fica com feedback "failed" e pode ser gerada depois; devolve o
 * motivo da falha (ou null) para a tela explicar.
 */
export function produceFeedback(deps: Deps, sessionId: number): Promise<FeedbackFailure | null> {
  // A mesma sessão nunca gera feedback duas vezes ao mesmo tempo.
  let running = inFlight.get(sessionId);
  if (!running) {
    running = runFeedback(deps, sessionId).finally(() => {
      inFlight.delete(sessionId);
    });
    inFlight.set(sessionId, running);
  }
  return running;
}

const inFlight = new Map<number, Promise<FeedbackFailure | null>>();

async function runFeedback(deps: Deps, sessionId: number): Promise<FeedbackFailure | null> {
  const detail = await deps.sessions.get(sessionId);
  if (!detail || detail.feedbackStatus === 'ready' || detail.feedbackStatus === 'skipped') {
    return null;
  }

  try {
    const language = findLanguage(detail.languageCode);
    const apiKey = await deps.apiKeyStore.get();
    if (!language || !apiKey) throw new Error('Sem idioma ou chave');
    const profile: LearnerProfile = (await deps.profiles.get(detail.languageCode)) ?? {
      languageCode: language.code as LearnerProfile['languageCode'],
      level: 'intermediate',
    };
    const { response, model } = await generateFeedback(
      deps.feedbackModels,
      apiKey,
      {
        language,
        profile,
        transcript: detail.transcript,
        memory: await deps.memory.forLanguage(detail.languageCode),
      },
      deps.feedbackRetryWait ? { wait: deps.feedbackRetryWait } : {},
    );
    const { memory, ...feedback } = response;
    await deps.sessions.saveFeedback(sessionId, feedback, {
      model,
      promptVersion: FEEDBACK_PROMPT_VERSION,
    });
    console.info(
      '[feedback] nível',
      feedback.level.cefr,
      feedback.level.progress,
      'habilidades',
      JSON.stringify(feedback.skills),
    );
    await saveMemory(deps, detail.languageCode, memory);
    await pruneTranscripts(deps.sessions);
    return null;
  } catch (error) {
    // Diagnóstico (só tipo e mensagem; a chave nunca aparece nesses erros).
    console.warn('[feedback] falhou:', describeError(error));
    await deps.sessions.setFeedbackStatus(sessionId, 'failed');
    return error instanceof FeedbackError ? error.reason : 'invalid';
  }
}

/** Falhar ao salvar a memória não invalida o feedback já salvo; a próxima sessão tenta de novo. */
async function saveMemory(
  deps: Pick<Deps, 'memory'>,
  languageCode: string,
  memory: MemoryLists,
): Promise<void> {
  try {
    await deps.memory.replace(languageCode, memory);
  } catch (error) {
    console.warn('[memória] falhou:', describeError(error));
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause === undefined ? '' : ` <- ${describeError(error.cause)}`;
  return `${error.name}: ${error.message.slice(0, 500)}${cause}`;
}
