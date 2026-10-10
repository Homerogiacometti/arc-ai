import { useEffect } from 'react';
import type { Theme } from '../config/themes';
import { useSettingsStore } from '../store/settings';

/** Chave do tema no localStorage, lida pelo index.html antes do React para evitar o flash. */
export const THEME_STORAGE_KEY = 'arc-theme';

/** Tema efetivo: "system" vira claro ou escuro conforme o aparelho. */
export function resolveTheme(theme: Theme, prefersLight: boolean): 'dark' | 'light' {
  if (theme === 'system') return prefersLight ? 'light' : 'dark';
  return theme;
}

/**
 * Aplica o tema das configurações no documento. `enabled` fica falso até as configurações
 * serem lidas do banco, para o padrão não sobrescrever o tema guardado.
 */
export function useApplyTheme(enabled: boolean): void {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    if (!enabled) return;
    // A WebView tem matchMedia; o jsdom dos testes não.
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media?.matches ?? false);
    };
    apply();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Sem localStorage, o splash abre no tema escuro; o resto do app segue o tema salvo.
    }
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
    };
  }, [enabled, theme]);
}
