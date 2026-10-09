import { useId, useState, type SubmitEvent } from 'react';
import { DAYS_PER_WEEK_OPTIONS, MINUTES_PER_DAY_OPTIONS, type PlanGoal } from '../../plan/plan';

interface PlanFormProps {
  initial?: PlanGoal;
  submitLabel: string;
  onSubmit: (goal: PlanGoal) => Promise<void>;
  onCancel?: () => void;
}

export function PlanForm({ initial, submitLabel, onSubmit, onCancel }: PlanFormProps) {
  const id = useId();
  const [daysPerWeek, setDaysPerWeek] = useState(initial?.daysPerWeek ?? 3);
  const [minutesPerDay, setMinutesPerDay] = useState(initial?.minutesPerDay ?? 15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setSaving(true);
    try {
      await onSubmit({ daysPerWeek, minutesPerDay });
    } catch {
      setError(true);
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
      <fieldset className="field">
        <legend className="field__label">Dias por semana</legend>
        <div className="choices">
          {DAYS_PER_WEEK_OPTIONS.map((value) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name={`${id}-days`}
                checked={daysPerWeek === value}
                onChange={() => {
                  setDaysPerWeek(value);
                }}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field__label">Minutos por dia</legend>
        <div className="choices">
          {MINUTES_PER_DAY_OPTIONS.map((value) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name={`${id}-minutes`}
                checked={minutesPerDay === value}
                onChange={() => {
                  setMinutesPerDay(value);
                }}
              />
              <span>{value} min</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="screen__text">
        Vale a partir desta semana; as semanas anteriores continuam com o plano que tinham.
      </p>
      {error && (
        <p className="error" role="alert">
          Não foi possível salvar o plano. Tente de novo.
        </p>
      )}
      <button className="button" type="submit" disabled={saving}>
        {submitLabel}
      </button>
      {onCancel && (
        <button className="button button--quiet" type="button" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </form>
  );
}
