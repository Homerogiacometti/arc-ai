import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { useServices } from '../../app/services-context';
import { PROFILE_TEXT_MAX_LENGTH, type LearnerInfo } from '../../config/profile';

/** Interesses e objetivos (RF02), comuns a todos os idiomas. */
export function InfoSection() {
  const { learnerInfo } = useServices();
  const id = useId();
  const [values, setValues] = useState<LearnerInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    void learnerInfo.get().then((info) => {
      if (active) setValues(info);
    });
    return () => {
      active = false;
    };
  }, [learnerInfo]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) return;
    setStatus('saving');
    try {
      await learnerInfo.save(values);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  const change = (field: keyof LearnerInfo, value: string) => {
    setValues((current) => current && { ...current, [field]: value });
    setStatus('idle');
  };

  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Interesses e objetivos
      </h2>
      <p className="screen__text">A IA usa para puxar assunto, em todos os idiomas.</p>
      {values && (
        <form
          className="form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="field">
            <label className="field__label" htmlFor={`${id}-interests`}>
              Interesses (opcional)
            </label>
            <textarea
              id={`${id}-interests`}
              className="input"
              maxLength={PROFILE_TEXT_MAX_LENGTH}
              placeholder="Ex.: viagens, tecnologia, futebol"
              value={values.interests}
              onChange={(event) => {
                change('interests', event.target.value);
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
              value={values.goals}
              onChange={(event) => {
                change('goals', event.target.value);
              }}
            />
          </div>
          {status === 'error' && (
            <p className="error" role="alert">
              Não foi possível salvar. Tente de novo.
            </p>
          )}
          {status === 'saved' && (
            <p className="field__hint" role="status">
              Salvo.
            </p>
          )}
          <button className="button button--quiet" type="submit" disabled={status === 'saving'}>
            Salvar interesses e objetivos
          </button>
        </form>
      )}
    </section>
  );
}
