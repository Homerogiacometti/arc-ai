import { formatDuration } from '../format';
import { useNavigation } from '../navigation';
import { ScreenHeader } from '../ScreenHeader';
import { FeedbackBody } from './FeedbackBody';
import { ReportContent } from './ReportContent';
import { useSessionDetail } from './use-session-detail';

/** Aparece sozinha ao encerrar a sessão (RF10); ao fechar, volta à home. */
export function FeedbackScreen({ sessionId }: { sessionId: number }) {
  const home = useNavigation((state) => state.home);
  const { state, generate } = useSessionDetail(sessionId, { autoGenerate: true });

  return (
    <main className="screen">
      <ScreenHeader title="Feedback" onBack={home} backLabel="Fechar" />
      {state.status === 'loading' && <p className="screen__text">Carregando…</p>}
      {state.status === 'missing' && <p className="screen__text">Sessão não encontrada.</p>}
      {(state.status === 'generating' || state.status === 'loaded') && (
        <>
          <p className="screen__text">Conversa de {formatDuration(state.detail.durationMs)}</p>
          <FeedbackBody state={state} onGenerate={generate} />
          <ReportContent detail={state.detail} />
          <button className="button screen__footer" type="button" onClick={home}>
            Fechar
          </button>
        </>
      )}
    </main>
  );
}
