/**
 * Idiomas de prática oferecidos no menu (RF03).
 * Os modelos de áudio nativo não aceitam código de idioma fixo: o idioma é aplicado
 * pela instrução de sistema. `code` é BCP-47 e serve para rótulos, memória e histórico.
 */
export interface Language {
  readonly code: string;
  /** Nome em português, exibido na interface. */
  readonly label: string;
  /** Nome no próprio idioma, usado na instrução de sistema. */
  readonly nativeName: string;
}

export const LANGUAGES = [
  { code: 'en-US', label: 'Inglês', nativeName: 'English' },
  { code: 'es-ES', label: 'Espanhol', nativeName: 'Español' },
  { code: 'fr-FR', label: 'Francês', nativeName: 'Français' },
  { code: 'de-DE', label: 'Alemão', nativeName: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano', nativeName: 'Italiano' },
  { code: 'ja-JP', label: 'Japonês', nativeName: '日本語' },
  { code: 'ko-KR', label: 'Coreano', nativeName: '한국어' },
  { code: 'cmn-CN', label: 'Mandarim', nativeName: '中文' },
  { code: 'ru-RU', label: 'Russo', nativeName: 'Русский' },
  { code: 'nl-NL', label: 'Holandês', nativeName: 'Nederlands' },
  { code: 'pl-PL', label: 'Polonês', nativeName: 'Polski' },
  { code: 'tr-TR', label: 'Turco', nativeName: 'Türkçe' },
  { code: 'ar-XA', label: 'Árabe', nativeName: 'العربية' },
  { code: 'hi-IN', label: 'Híndi', nativeName: 'हिन्दी' },
] as const satisfies readonly Language[];

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en-US';

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((language) => language.code === code);
}
