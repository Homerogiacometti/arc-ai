import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { computeProgress, type PlanGoal, type PracticePlan, type Progress } from '../../plan/plan';
import { useSettingsStore } from '../../store/settings';
import { ScreenHeader } from '../ScreenHeader';
import { PlanForm } from './PlanForm';
import { WeekView } from './WeekView';
import { WeeklyChart } from './WeeklyChart';
import './Plan.css';

interface Loaded {
  languageCode: string;
  plans: PracticePlan[];
  progress: Progress;
}

/** RF13: plano de estudo semanal editável, semana atual e constância, por idioma (v3). */
export function PlanScreen() {
  const { plans, sessions } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const [data, setData] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [planList, sessionList] = await Promise.all([
      plans.list(languageCode),
      sessions.list({ languageCode }),
    ]);
    return {
      languageCode,
      plans: planList,
      progress: computeProgress(sessionList, planList, new Date()),
    };
  }, [plans, sessions, languageCode]);

  useEffect(() => {
    let active = true;
    void load().then((loaded) => {
      if (active) setData(loaded);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const save = async (goal: PlanGoal) => {
    await plans.save(languageCode, goal);
    setData(await load());
    setEditing(false);
  };

  // Depois de trocar o idioma, o plano do anterior não aparece enquanto o novo carrega.
  const ready = data?.languageCode === languageCode ? data : null;
  const goal = ready?.progress.current.plan ?? null;
  const label = findLanguage(languageCode)?.label ?? 'este idioma';

  return (
    <main className="screen">
      <ScreenHeader title="Plano de estudo" languageSwitch />
      {ready === null && <p className="screen__text">Carregando…</p>}

      {ready && !goal && (
        <>
          <p className="screen__text">
            Defina quantos dias por semana e quantos minutos por dia você quer praticar. Cada idioma
            tem o seu plano; este vale para {label}. O dia fica marcado sozinho quando a soma das
            conversas nesse idioma atinge a meta.
          </p>
          <PlanForm submitLabel="Criar plano" onSubmit={save} />
        </>
      )}

      {ready && goal && (
        <>
          <section className="section" aria-labelledby="plan-goal">
            <h2 className="section__title" id="plan-goal">
              Meta em {label}
            </h2>
            {editing ? (
              <PlanForm
                initial={goal}
                submitLabel="Salvar plano"
                onSubmit={save}
                onCancel={() => {
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <p className="plan__goal">
                  {goal.daysPerWeek} {goal.daysPerWeek === 1 ? 'dia' : 'dias'} por semana ·{' '}
                  {goal.minutesPerDay} min por dia
                </p>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  Editar plano
                </button>
              </>
            )}
          </section>

          <WeekView week={ready.progress.current} />

          <section className="section" aria-labelledby="plan-evolution">
            <h2 className="section__title" id="plan-evolution">
              Constância
            </h2>
            <div className="plan__tiles">
              <div className="plan__tile">
                <span className="plan__tile-value">{ready.progress.weeksMet}</span>
                <span className="plan__tile-label">
                  {ready.progress.weeksMet === 1 ? 'semana cumprida' : 'semanas cumpridas'}
                </span>
              </div>
              <div className="plan__tile">
                <span className="plan__tile-value">{ready.progress.streak}</span>
                <span className="plan__tile-label">
                  {ready.progress.streak === 1 ? 'semana seguida' : 'semanas seguidas'} na meta
                </span>
              </div>
            </div>
            <WeeklyChart weeks={ready.progress.recent} />
          </section>
        </>
      )}
    </main>
  );
}
