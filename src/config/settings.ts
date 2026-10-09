import { z } from 'zod';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { DEFAULT_PAUSE_LEVEL, PAUSE_LEVELS } from './pause-levels';
import { DEFAULT_RESPONSE_MODE, RESPONSE_MODES } from './response-modes';
import { DEFAULT_VOICE, VOICES } from './voices';

const keysOf = <T extends object>(obj: T) => Object.keys(obj) as [keyof T & string];

export const languageCodeSchema = z.enum(LANGUAGES.map((language) => language.code));

export const settingsSchema = z.object({
  languageCode: languageCodeSchema,
  responseMode: z.enum(keysOf(RESPONSE_MODES)),
  pauseLevel: z.enum(keysOf(PAUSE_LEVELS)),
  voice: z.enum(keysOf(VOICES)),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  languageCode: DEFAULT_LANGUAGE,
  responseMode: DEFAULT_RESPONSE_MODE,
  pauseLevel: DEFAULT_PAUSE_LEVEL,
  voice: DEFAULT_VOICE,
};
