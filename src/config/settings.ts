import { z } from 'zod';
import {
  CONVERSATION_STYLES,
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  DEFAULT_CONVERSATION_STYLE,
} from './conversation-styles';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { DEFAULT_PAUSE_LEVEL, PAUSE_LEVELS } from './pause-levels';
import { DEFAULT_RESPONSE_MODE, RESPONSE_MODES } from './response-modes';
import { DEFAULT_THEME, THEMES } from './themes';
import { DEFAULT_VOICE, VOICES } from './voices';

const keysOf = <T extends object>(obj: T) => Object.keys(obj) as [keyof T & string];

export const languageCodeSchema = z.enum(LANGUAGES.map((language) => language.code));

export const settingsSchema = z.object({
  languageCode: languageCodeSchema,
  responseMode: z.enum(keysOf(RESPONSE_MODES)),
  pauseLevel: z.enum(keysOf(PAUSE_LEVELS)),
  voice: z.enum(keysOf(VOICES)),
  theme: z.enum(keysOf(THEMES)),
  conversationStyle: z.enum(keysOf(CONVERSATION_STYLES)),
  customInstructions: z.string().trim().max(CUSTOM_INSTRUCTIONS_MAX_LENGTH),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  languageCode: DEFAULT_LANGUAGE,
  responseMode: DEFAULT_RESPONSE_MODE,
  pauseLevel: DEFAULT_PAUSE_LEVEL,
  voice: DEFAULT_VOICE,
  theme: DEFAULT_THEME,
  conversationStyle: DEFAULT_CONVERSATION_STYLE,
  customInstructions: '',
};
