import { z } from 'zod';
import { languageCodeSchema } from './settings';

export const LEVELS = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
} as const;

export type Level = keyof typeof LEVELS;

export const PROFILE_TEXT_MAX_LENGTH = 300;

/** Perfil do aluno por idioma (RF02): nível autodeclarado. */
export const learnerProfileSchema = z.object({
  languageCode: languageCodeSchema,
  level: z.enum(Object.keys(LEVELS) as [Level, ...Level[]]),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

/** Interesses e objetivos do aluno (RF02), opcionais e comuns a todos os idiomas. */
export const learnerInfoSchema = z.object({
  interests: z.string().trim().max(PROFILE_TEXT_MAX_LENGTH),
  goals: z.string().trim().max(PROFILE_TEXT_MAX_LENGTH),
});

export type LearnerInfo = z.infer<typeof learnerInfoSchema>;

export const EMPTY_LEARNER_INFO: LearnerInfo = { interests: '', goals: '' };
