import { z } from 'zod';

export const MISTAKE_CATEGORIES = {
  grammar: 'Gramática',
  vocabulary: 'Vocabulário',
  'word-order': 'Ordem das palavras',
  tense: 'Tempo verbal',
  preposition: 'Preposição',
  other: 'Outro',
} as const;

export type MistakeCategory = keyof typeof MISTAKE_CATEGORIES;

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const text = z.string().trim().min(1);

/** Feedback de fim de sessão (RF10). Textos explicativos em português. */
export const feedbackSchema = z.object({
  summary: text.describe('Resumo da conversa em português, 2 a 4 frases.'),
  strengths: z.array(text).describe('Pontos fortes do usuário nesta conversa, em português.'),
  mistakes: z
    .array(
      z.object({
        original: text.describe('Frase exatamente como o usuário disse, no idioma praticado.'),
        correction: text.describe('Versão corrigida e natural, no idioma praticado.'),
        explanation: text.describe('Explicação curta em português.'),
        category: z.enum(
          Object.keys(MISTAKE_CATEGORIES) as [MistakeCategory, ...MistakeCategory[]],
        ),
      }),
    )
    .describe('Erros reais do usuário, do mais importante ao menos importante.'),
  vocabulary: z
    .array(
      z.object({
        original: text.describe('O que o usuário disse, no idioma praticado.'),
        suggestion: text.describe('Forma mais natural, no idioma praticado.'),
        explanation: text.describe('Por que soa mais natural, em português.'),
      }),
    )
    .describe('Sugestões de vocabulário ou expressões mais naturais.'),
  level: z
    .object({
      cefr: z.enum(CEFR_LEVELS),
      comment: text.describe('Justificativa curta da estimativa, em português.'),
    })
    .describe('Estimativa de nível com base apenas nesta conversa.'),
});

export type Feedback = z.infer<typeof feedbackSchema>;

/** JSON Schema para a saída estruturada do modelo de texto. */
export function feedbackJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(feedbackSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
