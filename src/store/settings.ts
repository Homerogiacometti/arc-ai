import { z } from 'zod';
import { create } from 'zustand';
import { DEFAULT_LANGUAGE, LANGUAGES } from '../config/languages';
import { DEFAULT_PAUSE_LEVEL, PAUSE_LEVELS, type PauseLevel } from '../config/pause-levels';
import { DEFAULT_RESPONSE_MODE, RESPONSE_MODES, type ResponseMode } from '../config/response-modes';

const keysOf = <T extends object>(obj: T) => Object.keys(obj) as [keyof T & string];

export const settingsSchema = z.object({
  languageCode: z.enum(LANGUAGES.map((language) => language.code)),
  responseMode: z.enum(keysOf(RESPONSE_MODES)),
  pauseLevel: z.enum(keysOf(PAUSE_LEVELS)),
});

export type Settings = z.infer<typeof settingsSchema>;

interface SettingsState extends Settings {
  setLanguage: (code: Settings['languageCode']) => void;
  setResponseMode: (mode: ResponseMode) => void;
  setPauseLevel: (level: PauseLevel) => void;
}

/** Estado inicial mínimo. A persistência em SQLite chega no M6. */
export const useSettingsStore = create<SettingsState>()((set) => ({
  languageCode: DEFAULT_LANGUAGE,
  responseMode: DEFAULT_RESPONSE_MODE,
  pauseLevel: DEFAULT_PAUSE_LEVEL,
  setLanguage: (languageCode) => {
    set({ languageCode });
  },
  setResponseMode: (responseMode) => {
    set({ responseMode });
  },
  setPauseLevel: (pauseLevel) => {
    set({ pauseLevel });
  },
}));
