import type { SessionDetail } from '../../storage/session-repository';
import type { DetailState } from './use-session-detail';
import { FeedbackView } from './FeedbackView';

const END_NOTES: Record<string, string> = {
  disconnected: 'A conexão caiu e a sessão foi encerrada. O que foi conversado ficou salvo.',
  'resume-failed': 'Não deu para retomar depois da pausa. O que foi conversado ficou salvo.',
};

/** Feedback de uma sessão em qualquer estado: gerando, pronto, falhou ou sem fala. */
export function FeedbackBody({
  state,
  onGenerate,
}: {
  state: Exclude<DetailState, { status: 'loading' } | { status: 'missing' }>;
  onGenerate: () => void;
}) {
  const { detail } = state;
  const note = END_NOTES[detail.endReason];
  return (
    <>
      {note && <p className="screen__text">{note}</p>}
      {state.status === 'generating' ? (
        <p className="screen__text" aria-busy="true">
          Gerando feedback…
        </p>
      ) : (
        <FeedbackContent detail={detail} onGenerate={onGenerate} />
      )}
    </>
  );
}

function FeedbackContent({
  detail,
  onGenerate,
}: {
  detail: SessionDetail;
  onGenerate: () => void;
}) {
  if (detail.feedback) return <FeedbackView feedback={detail.feedback} />;
  if (detail.feedbackStatus === 'skipped') {
    return <p className="screen__text">Não houve fala sua suficiente para gerar feedback.</p>;
  }
  return (
    <div className="form">
      <p className="error" role="alert">
        {detail.feedbackStatus === 'failed'
          ? 'Não foi possível gerar o feedback agora. A sessão ficou salva.'
          : 'O feedback desta sessão ainda não foi gerado.'}
      </p>
      <button className="button" type="button" onClick={onGenerate}>
        Gerar feedback
      </button>
    </div>
  );
}
