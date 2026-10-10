import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage, type Language, type LanguageCode } from '../../config/languages';
import type { SessionSnapshot } from '../../conversation/session-controller';
import { useSettingsStore } from '../../store/settings';
import { Logo } from '../Logo';
import { formatDuration } from '../format';
import { useNavigation } from '../navigation';
import { useUpdateSettings } from '../use-update-settings';
import { useConversation } from './use-conversation';
import './Home.css';

const STATUS_TEXT: Partial<Record<SessionSnapshot['status'], string>> = {
  connecting: 'Conectando…',
  paused: 'Pausada',
  resuming: 'Retomando…',
  reconnecting: 'Conexão instável, reconectando…',
  ending: 'Encerrando…',
};

function endMessage({ endReason, error }: SessionSnapshot): string | null {
  switch (endReason) {
    case 'start-failed':
      return error?.startsWith('NotAllowedError')
        ? 'Permita o uso do microfone para conversar.'
        : 'Não foi possível iniciar a conversa. Verifique a internet e tente de novo.';
    case 'resume-failed':
      return 'Não deu para retomar a conversa depois da pausa. A sessão foi encerrada.';
    case 'disconnected':
      return 'A conexão caiu e não voltou. O que foi conversado ficou salvo.';
    case 'silence':
      return 'Sessão encerrada depois de um tempo sem fala. O que foi conversado ficou salvo.';
    default:
      return null;
  }
}

/** Home ultra simples (SPEC §9): botão único, cronômetro e indicador de quem fala. */
export function Home() {
  const { snapshot, running, elapsedMs, result, start, stop } = useConversation();
  const navigate = useNavigation((state) => state.navigate);
  const statusText = STATUS_TEXT[snapshot.status];
  const failure = snapshot.status === 'ended' ? endMessage(snapshot) : null;

  return (
    <main className="home">
      <header className="home__bar">
        <LanguageFlags disabled={running} />
        {!running && (
          <button
            className="home__menu"
            type="button"
            aria-label="Menu"
            onClick={() => {
              navigate({ name: 'menu' });
            }}
          >
            <span aria-hidden="true">☰</span>
          </button>
        )}
      </header>

      <section className="home__center">
        {running ? (
          <>
            <p className="home__timer" role="timer" aria-label="Tempo de conversa">
              {formatDuration(elapsedMs)}
            </p>
            <p className="home__status" aria-live="polite">
              {statusText ?? <SpeakerIndicator speaker={snapshot.speaker} />}
            </p>
          </>
        ) : (
          <>
            <h1 className="home__title">
              <Logo />
            </h1>
            {failure && (
              <p className="home__message home__message--error" role="alert">
                {failure}
              </p>
            )}
            {!failure && result && result.durationMs > 0 && (
              <p className="home__message">
                Sessão encerrada · {formatDuration(result.durationMs)}
              </p>
            )}
          </>
        )}

        <button
          className={`home__action ${running ? 'home__action--stop' : ''}`}
          type="button"
          onClick={running ? stop : start}
          disabled={snapshot.status === 'ending'}
        >
          {running ? 'Parar' : 'Iniciar'}
        </button>
      </section>
    </main>
  );
}

/**
 * Bandeiras dos idiomas que o usuário aprende; a do idioma atual fica em destaque e tocar em
 * outra troca o idioma da próxima conversa.
 */
function LanguageFlags({ disabled }: { disabled: boolean }) {
  const { profiles } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const updateSettings = useUpdateSettings();
  const [learning, setLearning] = useState<Language[]>([]);
  const current = findLanguage(languageCode);

  useEffect(() => {
    let active = true;
    void profiles.list().then((list) => {
      if (!active) return;
      setLearning(list.flatMap((profile) => findLanguage(profile.languageCode) ?? []));
    });
    return () => {
      active = false;
    };
  }, [profiles]);

  const languages = learning.some((language) => language.code === languageCode)
    ? learning
    : [...(current ? [current] : []), ...learning];

  return (
    <div className="flags" role="group" aria-label="Idioma atual">
      <span className="visually-hidden">{current?.label}</span>
      {languages.map((language) => {
        const selected = language.code === languageCode;
        return (
          <button
            key={language.code}
            className={`flags__flag${selected ? ' flags__flag--current' : ''}`}
            type="button"
            aria-label={`Praticar ${language.label}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => {
              if (selected) return;
              updateSettings({ languageCode: language.code as LanguageCode }).catch(() => {
                // Se não salvar, continua no idioma atual.
              });
            }}
          >
            <span aria-hidden="true">{language.flag}</span>
          </button>
        );
      })}
    </div>
  );
}

function SpeakerIndicator({ speaker }: { speaker: SessionSnapshot['speaker'] }) {
  if (!speaker) return <span className="speaker">&nbsp;</span>;
  return (
    <span className={`speaker speaker--${speaker}`}>
      <span className="speaker__dot" aria-hidden="true" />
      {speaker === 'ai' ? 'IA falando' : 'Você está falando'}
    </span>
  );
}
