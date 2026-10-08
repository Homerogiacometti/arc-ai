/**
 * Único lugar com nomes de modelo (SPEC §3). A Live API está em preview e os nomes mudam:
 * conferidos na documentação do Google em 2026-10-08 (M3).
 */
export const MODELS = {
  /** Conversa por voz (Live API, áudio nativo). */
  live: 'gemini-3.8-live',
  /** Feedback e memória (API de texto, saída estruturada em JSON). */
  text: 'gemini-3.8-flash',
} as const;

export type ModelRole = keyof typeof MODELS;
