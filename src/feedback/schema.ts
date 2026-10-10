import { z } from 'zod';
import { SKILL_KEYS } from '../config/skills';
import { memoryUpdateSchema } from '../memory/memory';

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

const levelProgress = z
  .number()
  .int()
  .min(0)
  .max(100)
  .describe(
    'Quanto o aluno já avançou dentro do nível estimado: 0 = acabou de chegar, 100 = pronto para o próximo.',
  );

const skills = z
  .array(
    z.object({
      skill: z.enum(SKILL_KEYS),
      evaluation: z.enum(['strong', 'weak']),
    }),
  )
  .describe('Habilidades com evidência clara nesta conversa: strong = usou bem, weak = errou.');

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
      // Opcionais no que fica salvo: feedbacks anteriores ao prompt v3 não têm.
      progress: levelProgress.optional(),
      comment: text.describe('Justificativa curta da estimativa, em português.'),
    })
    .describe('Estimativa de nível com base apenas nesta conversa.'),
  skills: skills.optional(),
});

export type Feedback = z.infer<typeof feedbackSchema>;

/**
 * Resposta do modelo de texto: o feedback mais a memória atualizada (RF11). Só o feedback
 * é salvo junto da sessão; a memória vai para a tabela própria.
 */
export const feedbackResponseSchema = feedbackSchema.extend({
  // Na resposta do modelo, nível com progresso e habilidades são obrigatórios.
  level: feedbackSchema.shape.level.extend({ progress: levelProgress }),
  skills,
  memory: memoryUpdateSchema.describe(
    'Memória do aluno atualizada com esta conversa: as três listas completas, já mescladas.',
  ),
});

export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

/** JSON Schema para a saída estruturada do modelo de texto. */
export function feedbackJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(feedbackResponseSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
