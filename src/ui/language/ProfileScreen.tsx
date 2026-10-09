import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage, type LanguageCode } from '../../config/languages';
import type { LearnerProfile } from '../../config/profile';
import { useSettingsStore } from '../../store/settings';
import { useNavigation } from '../navigation';
import { ProfileForm } from '../profile/ProfileForm';
import { ScreenHeader } from '../ScreenHeader';
import { useUpdateSettings } from '../use-update-settings';

interface ProfileScreenProps {
  languageCode: LanguageCode;
}

/**
 * RF02 por idioma: edita o perfil do idioma atual ou cria o de um idioma novo, que passa a
 * ser o atual. Interesses e objetivos de um idioma novo vêm preenchidos com os do atual.
 */
export function ProfileScreen({ languageCode }: ProfileScreenProps) {
  const { profiles } = useServices();
  const currentLanguage = useSettingsStore((state) => state.languageCode);
  const updateSettings = useUpdateSettings();
  const { back, home } = useNavigation();
  const [initial, setInitial] = useState<Partial<LearnerProfile> | null>(null);
  const isNew = languageCode !== currentLanguage;
  const language = findLanguage(languageCode);

  useEffect(() => {
    let active = true;
    void Promise.all([profiles.get(languageCode), profiles.get(currentLanguage)]).then(
      ([own, current]) => {
        if (!active) return;
        setInitial(own ?? { interests: current?.interests ?? '', goals: current?.goals ?? '' });
      },
    );
    return () => {
      active = false;
    };
  }, [profiles, languageCode, currentLanguage]);

  return (
    <main className="screen">
      <ScreenHeader title={`Perfil · ${language?.label ?? languageCode}`} />
      {isNew && (
        <p className="screen__text">
          Antes de praticar {language?.label ?? 'esse idioma'}, diga seu nível nele.
        </p>
      )}
      {initial && (
        <ProfileForm
          initial={initial}
          submitLabel={isNew ? `Praticar ${language?.label ?? ''}`.trim() : 'Salvar'}
          onSubmit={async (values) => {
            await profiles.save({ languageCode, ...values });
            if (!isNew) {
              back();
              return;
            }
            await updateSettings({ languageCode });
            home();
          }}
        />
      )}
    </main>
  );
}
