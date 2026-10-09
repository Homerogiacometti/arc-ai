import { useId, useState } from 'react';
import { useServices } from '../../app/services-context';
import { LANGUAGES, type LanguageCode } from '../../config/languages';
import { useSettingsStore } from '../../store/settings';
import { Logo } from '../Logo';
import { ProfileForm } from '../profile/ProfileForm';

interface ProfileStepProps {
  onSaved: () => void;
}

/** RF02: idioma de prática, nível autodeclarado e, opcionalmente, interesses e objetivos. */
export function ProfileStep({ onSaved }: ProfileStepProps) {
  const services = useServices();
  const currentLanguage = useSettingsStore((state) => state.languageCode);
  const replaceSettings = useSettingsStore((state) => state.replace);
  const id = useId();
  const [languageCode, setLanguageCode] = useState<LanguageCode>(currentLanguage);

  return (
    <main className="screen">
      <Logo size="medium" />
      <h1 className="screen__title">Seu perfil</h1>
      <p className="screen__text">Isso ajuda a IA a ajustar a conversa a você.</p>
      <ProfileForm
        submitLabel="Começar"
        before={
          <div className="field">
            <label className="field__label" htmlFor={`${id}-language`}>
              Idioma que você quer praticar
            </label>
            <select
              id={`${id}-language`}
              className="input"
              value={languageCode}
              onChange={(event) => {
                setLanguageCode(event.target.value as LanguageCode);
              }}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        }
        onSubmit={async (values) => {
          await services.profiles.save({ languageCode, ...values });
          replaceSettings(await services.settings.update({ languageCode }));
          onSaved();
        }}
      />
    </main>
  );
}
