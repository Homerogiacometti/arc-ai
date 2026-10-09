import { useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { LEVELS, PROFILE_TEXT_MAX_LENGTH, type Level } from '../../config/profile';

export interface ProfileValues {
  level: Level;
  interests: string;
  goals: string;
}

interface ProfileFormProps {
  initial?: Partial<ProfileValues>;
  /** Campo extra no topo do formulário (ex.: escolha do idioma no onboarding). */
  before?: ReactNode;
  submitLabel: string;
  /** Pode lançar erro; o formulário mostra a mensagem e deixa tentar de novo. */
  onSubmit: (values: ProfileValues) => Promise<void>;
}

/** RF02: nível autodeclarado e, opcionalmente, interesses e objetivos. */
export function ProfileForm({ initial, before, submitLabel, onSubmit }: ProfileFormProps) {
  const id = useId();
  const [level, setLevel] = useState<Level | null>(initial?.level ?? null);
  const [interests, setInterests] = useState(initial?.interests ?? '');
  const [goals, setGoals] = useState(initial?.goals ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!level) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ level, interests, goals });
    } catch {
      setError('Não foi possível salvar o perfil. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      {before}

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
        {submitLabel}
      </button>
    </form>
  );
}
