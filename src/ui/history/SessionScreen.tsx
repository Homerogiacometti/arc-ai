import { findLanguage } from '../../config/languages';
import { FeedbackBody } from '../feedback/FeedbackBody';
import { ReportContent } from '../feedback/ReportContent';
import { useSessionDetail } from '../feedback/use-session-detail';
import { formatDateTime, formatDuration, modeLabel } from '../format';
import { ScreenHeader } from '../ScreenHeader';

/** Detalhe da sessão (RF12): feedback e transcrição. */
export function SessionScreen({ sessionId }: { sessionId: number }) {
  const { state, generate } = useSessionDetail(sessionId);

  return (
    <main className="screen">
      <ScreenHeader title="Sessão" />
      {state.status === 'loading' && <p className="screen__text">Carregando…</p>}
      {state.status === 'missing' && <p className="screen__text">Sessão não encontrada.</p>}
      {(state.status === 'generating' || state.status === 'loaded') && (
        <>
          <p className="screen__text">
            {formatDateTime(state.detail.startedAt)} ·{' '}
            {findLanguage(state.detail.languageCode)?.label ?? state.detail.languageCode} ·{' '}
            {modeLabel(state.detail.responseMode)} · {formatDuration(state.detail.durationMs)}
          </p>
          <FeedbackBody state={state} onGenerate={generate} />
          <section className="transcript">
            <h2 className="feedback__heading">Transcrição</h2>
            <ol className="transcript__list">
              {state.detail.transcript.map((turn, index) => (
                <li key={index} className={`transcript__turn transcript__turn--${turn.speaker}`}>
                  <span className="transcript__who">{turn.speaker === 'ai' ? 'IA' : 'Você'}</span>
                  <p className="transcript__text">{turn.text}</p>
                </li>
              ))}
            </ol>
          </section>
          <ReportContent detail={state.detail} />
        </>
      )}
    </main>
  );
}
