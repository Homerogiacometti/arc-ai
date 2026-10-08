/**
 * Tolerância a pausas (RF05): tempo de silêncio antes de a IA responder.
 * Referência da documentação: padrão do servidor ~800 ms; acima de ~2000 ms a latência
 * percebida aumenta. Valores provisórios, ajustados em testes reais (M9).
 */
export const PAUSE_LEVELS = {
  short: { label: 'Curta', silenceDurationMs: 800 },
  medium: { label: 'Média', silenceDurationMs: 1300 },
  long: { label: 'Longa', silenceDurationMs: 2000 },
} as const satisfies Record<string, { label: string; silenceDurationMs: number }>;

export type PauseLevel = keyof typeof PAUSE_LEVELS;

export const DEFAULT_PAUSE_LEVEL: PauseLevel = 'medium';
