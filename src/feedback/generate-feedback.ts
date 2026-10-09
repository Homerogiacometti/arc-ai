import { z } from 'zod';
import { buildFeedbackPrompt, type FeedbackInput } from './prompt';
import { feedbackJsonSchema, feedbackSchema, type Feedback } from './schema';

/** Modelo de texto com saída estruturada. Implementação real em `gemini-text-model.ts`. */
export interface JsonModel {
  readonly name: string;
  generateJson(
    apiKey: string,
    prompt: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<string>;
}

export class FeedbackError extends Error {
  override readonly name = 'FeedbackError';
}

const MAX_ATTEMPTS = 2;

/**
 * Gera o feedback (RF10): a resposta precisa validar no schema Zod; se falhar (rede,
 * JSON inválido ou fora do schema), tenta mais uma vez antes de desistir.
 */
export async function generateFeedback(
  model: JsonModel,
  apiKey: string,
  input: FeedbackInput,
): Promise<Feedback> {
  const prompt = buildFeedbackPrompt(input);
  const schema = feedbackJsonSchema();
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await model.generateJson(apiKey, prompt, schema);
      return feedbackSchema.parse(JSON.parse(raw));
    } catch (error) {
      lastError = error;
      console.warn(`[feedback] tentativa ${String(attempt)} falhou:`, summarize(error));
    }
  }
  throw new FeedbackError('Feedback inválido após novas tentativas', { cause: lastError });
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
