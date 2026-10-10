/** Aparência da interface (RF16). "system" segue o tema do aparelho. */
export const THEMES = {
  dark: { label: 'Escuro' },
  light: { label: 'Claro' },
  system: { label: 'Seguir o aparelho' },
} as const satisfies Record<string, { label: string }>;

export type Theme = keyof typeof THEMES;

export const DEFAULT_THEME: Theme = 'dark';
