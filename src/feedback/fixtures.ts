import type { Feedback } from './schema';

/** Feedback válido para testes. */
export const SAMPLE_FEEDBACK: Feedback = {
  summary: 'Vocês conversaram sobre uma viagem à praia.',
  strengths: ['Boa fluência ao descrever o fim de semana.'],
  mistakes: [
    {
      original: 'Yesterday I go to the beach',
      correction: 'Yesterday I went to the beach',
      explanation: 'Para ações no passado, use o passado simples (went).',
      category: 'tense',
    },
  ],
  vocabulary: [
    {
      original: 'very beautiful',
      suggestion: 'gorgeous',
      explanation: 'Mais natural e expressivo em conversas informais.',
    },
  ],
  level: { cefr: 'B1', comment: 'Comunica bem ideias do dia a dia, com erros de tempo verbal.' },
};
