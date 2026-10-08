/**
 * Único lugar com nomes de modelo (SPEC §3). A Live API está em preview e os nomes mudam:
 * os valores abaixo são conferidos na documentação do Google no início do M3.
 */
export const MODELS = {
  /** Conversa por voz (Live API, áudio nativo). */
  live: 'gemini-3.8-live',
  /** Feedback e memória (API de texto, saída estruturada em JSON). */
  text: 'gemini-flash-latest',
} as const;

export type ModelRole = keyof typeof MODELS;
