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
  /** Bandeira (emoji) mostrada na home. */
  readonly flag: string;
}

export const LANGUAGES = [
  { code: 'en-US', label: 'Inglês', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es-ES', label: 'Espanhol', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'Francês', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', label: 'Alemão', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', label: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ja-JP', label: 'Japonês', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', label: 'Coreano', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'cmn-CN', label: 'Mandarim', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ru-RU', label: 'Russo', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'nl-NL', label: 'Holandês', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl-PL', label: 'Polonês', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'tr-TR', label: 'Turco', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar-XA', label: 'Árabe', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi-IN', label: 'Híndi', nativeName: 'हिन्दी', flag: '🇮🇳' },
] as const satisfies readonly Language[];

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en-US';

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((language) => language.code === code);
}
