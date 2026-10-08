import { z } from 'zod';
import { languageCodeSchema } from './settings';

export const LEVELS = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
} as const;

export type Level = keyof typeof LEVELS;

export const PROFILE_TEXT_MAX_LENGTH = 300;

/** Perfil do aluno por idioma (RF02): nível autodeclarado, interesses e objetivos opcionais. */
export const learnerProfileSchema = z.object({
  languageCode: languageCodeSchema,
  level: z.enum(Object.keys(LEVELS) as [Level, ...Level[]]),
  interests: z.string().trim().max(PROFILE_TEXT_MAX_LENGTH),
  goals: z.string().trim().max(PROFILE_TEXT_MAX_LENGTH),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
