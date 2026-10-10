import type { SessionDetail } from '../../storage/session-repository';
import type { FeedbackFailure } from '../../feedback/generate-feedback';
import type { DetailState } from './use-session-detail';
import { FeedbackView } from './FeedbackView';

const END_NOTES: Record<string, string> = {
  disconnected: 'A conexão caiu e a sessão foi encerrada. O que foi conversado ficou salvo.',
  silence: 'A sessão foi encerrada depois de um tempo sem fala. O que foi conversado ficou salvo.',
  'resume-failed': 'Não deu para retomar depois da pausa. O que foi conversado ficou salvo.',
};

const FAILURE_MESSAGES: Record<FeedbackFailure, string> = {
  overloaded:
    'Os servidores do Google estão sobrecarregados agora. A sessão ficou salva; tente gerar de novo em alguns minutos.',
  quota:
    'Sua chave atingiu o limite de uso do Google por enquanto. A sessão ficou salva; tente de novo mais tarde.',
  network: 'Sem conexão com a internet. A sessão ficou salva; tente de novo quando estiver online.',
  auth: 'O Google recusou a chave de API. Confira a chave em Configurações; a sessão ficou salva.',
  invalid: 'Não foi possível gerar o feedback agora. A sessão ficou salva.',
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
          Gerando feedback… Se o Google estiver sobrecarregado, pode levar até um minuto.
        </p>
      ) : (
        <FeedbackContent detail={detail} failure={state.failure} onGenerate={onGenerate} />
      )}
    </>
  );
}

function FeedbackContent({
  detail,
  failure,
  onGenerate,
}: {
  detail: SessionDetail;
  failure: FeedbackFailure | undefined;
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
          ? FAILURE_MESSAGES[failure ?? 'invalid']
          : 'O feedback desta sessão ainda não foi gerado.'}
      </p>
      <button className="button" type="button" onClick={onGenerate}>
        Gerar feedback
      </button>
    </div>
  );
}
