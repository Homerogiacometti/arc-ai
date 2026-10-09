import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { computeProgress, type PlanGoal, type PracticePlan, type Progress } from '../../plan/plan';
import { ScreenHeader } from '../ScreenHeader';
import { PlanForm } from './PlanForm';
import { WeekView } from './WeekView';
import { WeeklyChart } from './WeeklyChart';
import './Plan.css';

interface Loaded {
  plans: PracticePlan[];
  progress: Progress;
}

/** RF13: plano semanal editável, semana atual e evolução. */
export function PlanScreen() {
  const { plans, sessions } = useServices();
  const [data, setData] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [planList, sessionList] = await Promise.all([plans.list(), sessions.list()]);
    return { plans: planList, progress: computeProgress(sessionList, planList, new Date()) };
  }, [plans, sessions]);

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
    await plans.save(goal);
    setData(await load());
    setEditing(false);
  };

  const goal = data?.progress.current.plan ?? null;

  return (
    <main className="screen">
      <ScreenHeader title="Cronograma e progresso" />
      {data === null && <p className="screen__text">Carregando…</p>}

      {data && !goal && (
        <>
          <p className="screen__text">
            Defina quantos dias por semana e quantos minutos por dia você quer praticar. O dia fica
            marcado sozinho quando a soma das conversas atinge a meta.
          </p>
          <PlanForm submitLabel="Criar plano" onSubmit={save} />
        </>
      )}

      {data && goal && (
        <>
          <section className="section" aria-labelledby="plan-goal">
            <h2 className="section__title" id="plan-goal">
              Meta
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

          <WeekView week={data.progress.current} />

          <section className="section" aria-labelledby="plan-evolution">
            <h2 className="section__title" id="plan-evolution">
              Evolução
            </h2>
            <div className="plan__tiles">
              <div className="plan__tile">
                <span className="plan__tile-value">{data.progress.weeksMet}</span>
                <span className="plan__tile-label">
                  {data.progress.weeksMet === 1 ? 'semana cumprida' : 'semanas cumpridas'}
                </span>
              </div>
              <div className="plan__tile">
                <span className="plan__tile-value">{data.progress.streak}</span>
                <span className="plan__tile-label">
                  {data.progress.streak === 1 ? 'semana seguida' : 'semanas seguidas'} na meta
                </span>
              </div>
            </div>
            <WeeklyChart weeks={data.progress.recent} />
          </section>
        </>
      )}
    </main>
  );
}
