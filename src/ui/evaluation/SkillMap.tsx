import { useId } from 'react';
import { SKILLS } from '../../config/skills';
import { EVALUATION, type SkillScore, type SkillStatus } from '../../evaluation/evaluation';

const GROUPS: { status: SkillStatus; title: string; empty: string }[] = [
  { status: 'strong', title: 'Pontos fortes', empty: 'Ainda sem pontos fortes consolidados.' },
  { status: 'weak', title: 'Pontos fracos', empty: 'Nenhum ponto fraco recorrente agora.' },
  { status: 'developing', title: 'Em desenvolvimento', empty: '' },
];

const TREND_LABEL = { up: 'melhorando', down: 'piorando' } as const;

/** Mapa de pontos fortes e fracos: o tamanho da palavra acompanha o peso da habilidade. */
export function SkillMap({ skills }: { skills: readonly SkillScore[] }) {
  const id = useId();
  const maxScore = Math.max(EVALUATION.skillThreshold * 2, ...skills.map((s) => Math.abs(s.score)));
  const turned = skills.filter((skill) => skill.turnedStrong);

  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Pontos fortes e fracos
      </h2>
      {skills.length === 0 && (
        <p className="screen__text">
          O mapa aparece quando os feedbacks começarem a apontar o que você faz bem e o que erra.
        </p>
      )}
      {turned.length > 0 && (
        <p className="evaluation__promoted" role="status">
          Virou ponto forte: {turned.map((skill) => SKILLS[skill.skill]).join(', ')}.
        </p>
      )}
      {skills.length > 0 &&
        GROUPS.map((group) => {
          const items = skills.filter((skill) => skill.status === group.status);
          if (items.length === 0 && !group.empty) return null;
          return (
            <div className="skills" key={group.status} role="group" aria-label={group.title}>
              <h3 className={`skills__title skills__title--${group.status}`}>{group.title}</h3>
              {items.length === 0 ? (
                <p className="field__hint">{group.empty}</p>
              ) : (
                <ul className="skills__cloud">
                  {items.map((item) => (
                    <li
                      key={item.skill}
                      className={`skills__word skills__word--${item.status}`}
                      style={{
                        fontSize: `${String(0.85 + (Math.abs(item.score) / maxScore) * 0.75)}rem`,
                      }}
                    >
                      {SKILLS[item.skill]}
                      {item.trend && (
                        <span
                          className={`skills__trend skills__trend--${item.trend}`}
                          aria-label={TREND_LABEL[item.trend]}
                        >
                          {item.trend === 'up' ? '↑' : '↓'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
    </section>
  );
}
