import { useEffect, useId, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { LEVELS, type LearnerProfile } from '../../config/profile';
import {
  EVALUATION,
  scoreSkills,
  summarizeLevel,
  type LevelSummary,
  type SkillScore,
} from '../../evaluation/evaluation';
import { useSettingsStore } from '../../store/settings';
import { ScreenHeader } from '../ScreenHeader';
import { LevelChart } from './LevelChart';
import { SkillMap } from './SkillMap';
import './Evaluation.css';

interface Loaded {
  languageCode: string;
  level: LevelSummary | null;
  skills: SkillScore[];
}

/** Avaliação (M9.1): nível estimado ao longo das conversas e mapa de pontos fortes e fracos. */
export function EvaluationScreen() {
  const { sessions, profiles } = useServices();
  const currentLanguage = useSettingsStore((state) => state.languageCode);
  const id = useId();
  const [languageCode, setLanguageCode] = useState<string>(currentLanguage);
  const [learning, setLearning] = useState<LearnerProfile[]>([]);
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    void profiles.list().then((list) => {
      if (active) setLearning(list);
    });
    return () => {
      active = false;
    };
  }, [profiles]);

  useEffect(() => {
    let active = true;
    void sessions.listFeedbacks(languageCode).then((list) => {
      if (!active) return;
      setData({ languageCode, level: summarizeLevel(list), skills: scoreSkills(list) });
    });
    return () => {
      active = false;
    };
  }, [sessions, languageCode]);

  const language = findLanguage(languageCode);
  const declared = learning.find((profile) => profile.languageCode === languageCode);
  const ready = data?.languageCode === languageCode ? data : null;

  return (
    <main className="screen">
      <ScreenHeader title="Avaliação" />

      {learning.length > 1 && (
        <div className="field evaluation__language">
          <label className="field__label" htmlFor={`${id}-language`}>
            Idioma
          </label>
          <select
            id={`${id}-language`}
            className="input"
            value={languageCode}
            onChange={(event) => {
              setLanguageCode(event.target.value);
            }}
          >
            {learning.map((profile) => {
              const item = findLanguage(profile.languageCode);
              return (
                <option key={profile.languageCode} value={profile.languageCode}>
                  {item?.flag} {item?.label}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {ready === null && <p className="screen__text">Carregando…</p>}

      {ready && !ready.level && (
        <p className="screen__text">
          Ainda não há conversas avaliadas em {language?.label ?? 'este idioma'}. A cada conversa, o
          feedback estima seu nível e o que você já faz bem ou ainda erra; aqui você acompanha a
          evolução.
        </p>
      )}

      {ready?.level && (
        <>
          <LevelSection level={ready.level} declared={declared} />
          <section className="section" aria-labelledby={`${id}-evolution`}>
            <h2 className="section__title" id={`${id}-evolution`}>
              Evolução
            </h2>
            <LevelChart points={ready.level.history} />
          </section>
          <SkillMap skills={ready.skills} />
          <section className="section evaluation__method" aria-labelledby={`${id}-method`}>
            <h2 className="section__title" id={`${id}-method`}>
              Como funciona
            </h2>
            <p className="screen__text">
              Cada feedback dá uma nota: o nível CEFR estimado mais o quanto você já avançou dentro
              dele. Seu nível é a média das últimas {EVALUATION.levelWindow} conversas, para uma
              conversa ruim (ou ótima) não mudar tudo de uma vez.
            </p>
            <p className="screen__text">
              Os pontos fortes e fracos somam o que o feedback observou em cada conversa, com mais
              peso para as recentes. O que você parou de errar vai saindo dos pontos fracos; as
              setas comparam com {EVALUATION.trendLookback} conversas atrás.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function LevelSection({
  level,
  declared,
}: {
  level: LevelSummary;
  declared: LearnerProfile | undefined;
}) {
  const id = useId();
  const percent = Math.round(level.progress * 100);
  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Nível atual
      </h2>
      {level.promotedTo && (
        <p className="evaluation__promoted" role="status">
          Você subiu para {level.promotedTo}!
        </p>
      )}
      <p className="evaluation__level">{level.level}</p>
      <div
        className="evaluation__bar"
        role="progressbar"
        aria-label={level.next ? `Caminho até ${level.next}` : 'Nível máximo'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="evaluation__fill" style={{ width: `${String(percent)}%` }} />
      </div>
      <p className="evaluation__bar-label">
        <span>{level.level}</span>
        <span>{level.next ? `${String(percent)}% até ${level.next}` : 'nível máximo'}</span>
        <span>{level.next ?? ''}</span>
      </p>
      <p className="screen__text">
        Média das últimas {level.basedOn} {level.basedOn === 1 ? 'conversa' : 'conversas'} (
        {level.sessions} {level.sessions === 1 ? 'avaliada' : 'avaliadas'} no total).
        {declared && ` Nível que você declarou: ${LEVELS[declared.level]}.`}
      </p>
    </section>
  );
}
