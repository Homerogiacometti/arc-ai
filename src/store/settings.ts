import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../config/settings';

interface SettingsState extends Settings {
  /** Substitui o estado pelas configurações lidas/gravadas no banco. */
  replace: (settings: Settings) => void;
}

/** Espelho em memória das configurações; a fonte da verdade é o SettingsRepository. */
export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  replace: (settings) => {
    set(settings);
  },
}));
