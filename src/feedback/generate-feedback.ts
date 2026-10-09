import { z } from 'zod';
import { buildFeedbackPrompt, type FeedbackInput } from './prompt';
import { feedbackJsonSchema, feedbackResponseSchema, type FeedbackResponse } from './schema';

/** Modelo de texto com saída estruturada. Implementação real em `gemini-text-model.ts`. */
export interface JsonModel {
  readonly name: string;
  generateJson(
    apiKey: string,
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<string>;
}

/** Por que o feedback não saiu, para a mensagem certa na tela. */
export type FeedbackFailure = 'overloaded' | 'quota' | 'network' | 'auth' | 'invalid';

export class FeedbackError extends Error {
  override readonly name = 'FeedbackError';
  readonly reason: FeedbackFailure;

  constructor(reason: FeedbackFailure, options?: ErrorOptions) {
    super(`Feedback não gerado (${reason})`, options);
    this.reason = reason;
  }
}

export interface GeneratedFeedback {
  response: FeedbackResponse;
  /** Modelo que de fato gerou a resposta (o principal ou o reserva). */
  model: string;
}

export interface GenerateOptions {
  /** Espera entre tentativas; os testes passam uma versão instantânea. */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Espera antes de cada tentativa. As tentativas alternam entre os modelos (principal,
 * reserva, principal...): sobrecarga (503) costuma ser de um modelo só.
 */
export const ATTEMPT_DELAYS_MS = [0, 1_500, 5_000, 5_000] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Gera o feedback (RF10) e a memória atualizada (RF11): a resposta precisa validar no schema
 * Zod. Falhas passageiras (sobrecarga, limite, rede, JSON fora do schema) levam a nova
 * tentativa, com espera e alternando de modelo; chave recusada encerra na hora.
 */
export async function generateFeedback(
  models: readonly JsonModel[],
  apiKey: string,
  input: FeedbackInput,
  { wait = sleep }: GenerateOptions = {},
): Promise<GeneratedFeedback> {
  if (models.length === 0) throw new Error('Nenhum modelo de feedback');
  const prompt = buildFeedbackPrompt(input);
  const schema = feedbackJsonSchema();
  let lastError: unknown;
  for (const [attempt, delay] of ATTEMPT_DELAYS_MS.entries()) {
    const model = models[attempt % models.length] as JsonModel;
    if (delay > 0) await wait(delay);
    try {
      const raw = await model.generateJson(apiKey, prompt, schema);
      return { response: feedbackResponseSchema.parse(JSON.parse(raw)), model: model.name };
    } catch (error) {
      lastError = error;
      console.warn(
        `[feedback] tentativa ${String(attempt + 1)} (${model.name}) falhou:`,
        summarize(error),
      );
      if (classify(error) === 'auth') break;
    }
  }
  throw new FeedbackError(classify(lastError), { cause: lastError });
}

/** Classifica o erro pelo status HTTP do SDK, sem depender da classe dele (carregada sob demanda). */
export function classify(error: unknown): FeedbackFailure {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') {
    if (status === 429) return 'quota';
    if (status === 401 || status === 403) return 'auth';
    // 400 também vem quando um modelo recusa o pedido; só é chave inválida se o erro disser.
    if (status === 400 && error instanceof Error && error.message.includes('API_KEY')) {
      return 'auth';
    }
    if (status >= 500) return 'overloaded';
  }
  if (error instanceof TypeError) return 'network';
  return 'invalid';
}

/** Só vale pedir feedback se o usuário de fato falou algo. */
export function hasUserSpeech(transcript: FeedbackInput['transcript']): boolean {
  return transcript.some(
    (turn) => turn.speaker === 'user' && turn.text.trim().split(/\s+/).length >= 2,
  );
}

/** Resumo do erro para diagnóstico (inclui os campos que não validaram no schema). */
function summarize(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `schema: ${error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`;
  }
  return error instanceof Error ? `${error.name}: ${error.message.slice(0, 500)}` : String(error);
}
