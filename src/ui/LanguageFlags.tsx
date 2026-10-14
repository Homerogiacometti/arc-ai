import { useEffect, useState } from 'react';
import { useServices } from '../app/services-context';
import { findLanguage, type Language, type LanguageCode } from '../config/languages';
import { useSettingsStore } from '../store/settings';
import { useUpdateSettings } from './use-update-settings';

/** Idiomas que o usuário aprende, com o atual incluído mesmo se ainda não tiver perfil. */
function useLearningLanguages(): Language[] {
  const { profiles } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const [learning, setLearning] = useState<Language[]>([]);

  useEffect(() => {
    let active = true;
    void profiles.list().then((list) => {
      if (!active) return;
      setLearning(list.flatMap((profile) => findLanguage(profile.languageCode) ?? []));
    });
    return () => {
      active = false;
    };
  }, [profiles]);

  const current = findLanguage(languageCode);
  return learning.some((language) => language.code === languageCode)
    ? learning
    : [...(current ? [current] : []), ...learning];
}

/**
 * Bandeiras dos idiomas que o usuário aprende; a do idioma atual fica em destaque e tocar em
 * outra troca o idioma do app inteiro: próxima conversa, plano, histórico e avaliação.
 */
export function LanguageFlags({ disabled = false }: { disabled?: boolean }) {
  const languageCode = useSettingsStore((state) => state.languageCode);
  const updateSettings = useUpdateSettings();
  const languages = useLearningLanguages();
  const current = findLanguage(languageCode);

  return (
    <div className="flags" role="group" aria-label="Idioma atual">
      <span className="visually-hidden">{current?.label}</span>
      {languages.map((language) => {
        const selected = language.code === languageCode;
        return (
          <button
            key={language.code}
            className={`flags__flag${selected ? ' flags__flag--current' : ''}`}
            type="button"
            aria-label={`Praticar ${language.label}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => {
              if (selected) return;
              updateSettings({ languageCode: language.code as LanguageCode }).catch(() => {
                // Se não salvar, continua no idioma atual.
              });
            }}
          >
            <span aria-hidden="true">{language.flag}</span>
          </button>
        );
      })}
    </div>
  );
}
