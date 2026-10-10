/** Proteção por silêncio (RF07, decisão D7). Tempo em pausa (ADR-006) não conta. */
export const SILENCE = {
  /** Sem fala do usuário por este tempo → a IA pergunta se ele ainda está ali. */
  promptAfterMs: 2 * 60_000,
  /** Após a pergunta, sem fala por mais este tempo → a sessão encerra e salva. */
  endAfterPromptMs: 30_000,
} as const;

/** Memória entre sessões (RF11, decisão D8). */
export const MEMORY = {
  /** Informações pessoais, compartilhadas entre idiomas. */
  maxPersonalItems: 15,
  /** Principais erros, por idioma. */
  maxMistakesPerLanguage: 10,
  /** Principais acertos, por idioma. */
  maxStrengthsPerLanguage: 10,
  /** Orçamento da memória injetada na instrução de sistema. */
  tokenBudget: 600,
  /** Estimativa de tokens: caracteres ÷ 4. */
  charsPerToken: 4,
} as const;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / MEMORY.charsPerToken);
}

/** Histórico (RF12). */
export const HISTORY = {
  /** Conversas listadas no Histórico; as mais antigas perdem a transcrição. */
  visibleSessions: 10,
} as const;
