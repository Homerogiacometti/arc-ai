import { useId, useState, type SubmitEvent } from 'react';
import { useServices } from '../../app/services-context';
import { LANGUAGES, type LanguageCode } from '../../config/languages';
import { LEVELS, PROFILE_TEXT_MAX_LENGTH, type Level } from '../../config/profile';
import { useSettingsStore } from '../../store/settings';
import { Logo } from '../Logo';

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
  const [level, setLevel] = useState<Level | null>(null);
  const [interests, setInterests] = useState('');
  const [goals, setGoals] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!level) return;
    setError(null);
    setSaving(true);
    try {
      await services.profiles.save({ languageCode, level, interests, goals });
      replaceSettings(await services.settings.update({ languageCode }));
    } catch {
      setError('Não foi possível salvar o perfil. Tente de novo.');
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <main className="screen">
      <Logo size="medium" />
      <h1 className="screen__title">Seu perfil</h1>
      <p className="screen__text">Isso ajuda a IA a ajustar a conversa a você.</p>
      <form
        className="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
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

        <fieldset className="field">
          <legend className="field__label">Seu nível nesse idioma</legend>
          <div className="choices">
            {(Object.entries(LEVELS) as [Level, string][]).map(([value, label]) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name={`${id}-level`}
                  value={value}
                  checked={level === value}
                  onChange={() => {
                    setLevel(value);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-interests`}>
            Interesses (opcional)
          </label>
          <textarea
            id={`${id}-interests`}
            className="input"
            maxLength={PROFILE_TEXT_MAX_LENGTH}
            placeholder="Ex.: viagens, tecnologia, futebol"
            value={interests}
            onChange={(event) => {
              setInterests(event.target.value);
            }}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-goals`}>
            Objetivos (opcional)
          </label>
          <textarea
            id={`${id}-goals`}
            className="input"
            maxLength={PROFILE_TEXT_MAX_LENGTH}
            placeholder="Ex.: me preparar para uma entrevista de emprego"
            value={goals}
            onChange={(event) => {
              setGoals(event.target.value);
            }}
          />
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button" type="submit" disabled={!level || saving}>
          Começar
        </button>
      </form>
    </main>
  );
}
