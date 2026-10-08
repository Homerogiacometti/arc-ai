import { findLanguage } from '../../config/languages';
import type { SessionSnapshot } from '../../conversation/session-controller';
import { useSettingsStore } from '../../store/settings';
import { Logo } from '../Logo';
import { formatDuration } from './format';
import { useConversation } from './use-conversation';
import './Home.css';

const STATUS_TEXT: Partial<Record<SessionSnapshot['status'], string>> = {
  connecting: 'Conectando…',
  paused: 'Pausada',
  resuming: 'Retomando…',
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
      return 'A conexão caiu e a sessão foi encerrada.';
    default:
      return null;
  }
}

/** Home ultra simples (SPEC §9): botão único, cronômetro e indicador de quem fala. */
export function Home() {
  const languageCode = useSettingsStore((state) => state.languageCode);
  const languageLabel = findLanguage(languageCode)?.label ?? languageCode;
  const { snapshot, running, elapsedMs, result, start, stop } = useConversation();
  const statusText = STATUS_TEXT[snapshot.status];
  const failure = snapshot.status === 'ended' ? endMessage(snapshot) : null;

  return (
    <main className="home">
      <header className="home__bar">
        <span className="home__language" aria-label="Idioma atual">
          {languageLabel}
        </span>
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

function SpeakerIndicator({ speaker }: { speaker: SessionSnapshot['speaker'] }) {
  if (!speaker) return <span className="speaker">&nbsp;</span>;
  return (
    <span className={`speaker speaker--${speaker}`}>
      <span className="speaker__dot" aria-hidden="true" />
      {speaker === 'ai' ? 'IA falando' : 'Você está falando'}
    </span>
  );
}
