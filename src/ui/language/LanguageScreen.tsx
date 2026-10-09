import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage, LANGUAGES, type LanguageCode } from '../../config/languages';
import { LEVELS, type LearnerProfile } from '../../config/profile';
import { useSettingsStore } from '../../store/settings';
import { useNavigation } from '../navigation';
import { OptionList } from '../OptionList';
import { ScreenHeader } from '../ScreenHeader';
import { useUpdateSettings } from '../use-update-settings';

/**
 * RF03: idioma de prática. O nível é por idioma; um idioma novo pede o perfil antes de
 * virar o atual.
 */
export function LanguageScreen() {
  const { profiles } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const updateSettings = useUpdateSettings();
  const navigate = useNavigation((state) => state.navigate);
  const [known, setKnown] = useState<Map<string, LearnerProfile> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void profiles.list().then((list) => {
      if (active) setKnown(new Map(list.map((profile) => [profile.languageCode, profile])));
    });
    return () => {
      active = false;
    };
  }, [profiles]);

  const choose = async (code: LanguageCode) => {
    setError(false);
    if (!known?.has(code)) {
      navigate({ name: 'profile', languageCode: code });
      return;
    }
    try {
      await updateSettings({ languageCode: code });
    } catch {
      setError(true);
    }
  };

  const current = findLanguage(languageCode);

  return (
    <main className="screen">
      <ScreenHeader title="Idioma" />
      <p className="screen__text">
        A IA conversa no idioma escolhido, a partir da próxima conversa. Os erros e acertos da
        memória ficam separados por idioma.
      </p>
      {error && (
        <p className="error" role="alert">
          Não foi possível trocar o idioma. Tente de novo.
        </p>
      )}
      {known && (
        <OptionList
          legend="Idioma de prática"
          value={languageCode}
          options={LANGUAGES.map((language) => {
            const profile = known.get(language.code);
            return {
              value: language.code,
              label: language.label,
              description: profile ? LEVELS[profile.level] : 'Novo: você informa seu nível',
            };
          })}
          onChange={(code) => void choose(code)}
        />
      )}
      {current && (
        <div className="screen__footer">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              navigate({ name: 'profile', languageCode });
            }}
          >
            Editar nível e interesses ({current.label})
          </button>
        </div>
      )}
    </main>
  );
}
