/**
 * Estilo de conversa (v3): como a IA conduz o papo, para todos os idiomas. O modo de resposta
 * controla o tamanho da fala; o estilo, a condução.
 */
export const CONVERSATION_STYLES = {
  balanced: {
    label: 'Bate-papo',
    description: 'Alterna perguntas, opiniões e pequenas histórias',
    guidance:
      'Lead the conversation like a real person: ask questions, react, share opinions and small stories.',
  },
  interviewer: {
    label: 'Entrevistador',
    description: 'Sempre termina com uma pergunta e fala pouco de si',
    guidance:
      'Act like a curious interviewer: always end your turn with a question, often a follow-up on what the user just said, and say little about yourself.',
  },
  explorer: {
    label: 'Explorador',
    description: 'Muda de assunto a cada poucas trocas',
    guidance:
      'Keep the conversation moving across topics: after a few exchanges on one subject, bridge naturally to a new one, so the user practices a wide range of vocabulary.',
  },
  deep: {
    label: 'Aprofundar',
    description: 'Fica num assunto só e vai fundo nele',
    guidance:
      'Stay on one topic and go deep: ask for details, reasons, examples and feelings, and only change topic if the user wants to.',
  },
  debate: {
    label: 'Debate',
    description: 'Discorda com educação e pede argumentos',
    guidance:
      'Be a friendly debate partner: take a position, politely disagree or play devil’s advocate, and ask the user to justify and defend their opinions.',
  },
} as const satisfies Record<string, { label: string; description: string; guidance: string }>;

export type ConversationStyle = keyof typeof CONVERSATION_STYLES;

export const DEFAULT_CONVERSATION_STYLE: ConversationStyle = 'balanced';

/** Tamanho máximo das instruções livres para a IA. */
export const CUSTOM_INSTRUCTIONS_MAX_LENGTH = 300;
