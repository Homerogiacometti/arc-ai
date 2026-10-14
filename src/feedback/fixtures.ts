import type { Feedback, FeedbackResponse } from './schema';

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
  level: {
    cefr: 'B1',
    progress: 40,
    comment: 'Comunica bem ideias do dia a dia, com erros de tempo verbal.',
  },
  skills: [
    { skill: 'past', evaluation: 'weak' },
    { skill: 'fluency', evaluation: 'strong' },
  ],
  topics: ['viagem à praia'],
  followUp: ['vai voltar à praia no próximo feriado'],
};

/** Resposta válida do modelo para testes: o feedback e a memória atualizada. */
export const SAMPLE_RESPONSE: FeedbackResponse = {
  ...SAMPLE_FEEDBACK,
  level: { ...SAMPLE_FEEDBACK.level, progress: 40 },
  skills: SAMPLE_FEEDBACK.skills ?? [],
  topics: SAMPLE_FEEDBACK.topics ?? [],
  followUp: SAMPLE_FEEDBACK.followUp ?? [],
  memory: {
    personal: ['Foi à praia no fim de semana'],
    mistakes: ['Usa presente no lugar do passado ("I go" por "I went")'],
    strengths: ['Descreve o fim de semana com fluência'],
  },
};
