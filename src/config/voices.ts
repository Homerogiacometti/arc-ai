/**
 * Vozes da IA oferecidas nas configurações (RF16): uma seleção das vozes pré-definidas da
 * Live API (as mesmas do TTS do Gemini). Nomes conferidos na documentação do Google em
 * 2026-10-08: https://ai.google.dev/gemini-api/docs/speech-generation
 */
export const VOICES = {
  Puck: 'Animada',
  Zephyr: 'Brilhante',
  Charon: 'Informativa',
  Kore: 'Firme',
  Fenrir: 'Empolgada',
  Leda: 'Jovial',
  Aoede: 'Leve',
  Achird: 'Amigável',
  Sulafat: 'Calorosa',
  Vindemiatrix: 'Gentil',
  Zubenelgenubi: 'Descontraída',
  Gacrux: 'Madura',
} as const satisfies Record<string, string>;

export type Voice = keyof typeof VOICES;

export const DEFAULT_VOICE: Voice = 'Puck';
