import { useId, useState } from 'react';
import { buildReportMailto, REPORT_REASONS, type ReportReason } from '../../app/report';
import { useServices } from '../../app/services-context';
import type { SessionDetail } from '../../storage/session-repository';

const PREVIEW_LENGTH = 140;

/**
 * RF15: reportar resposta inadequada da IA. Abre o app de e-mail já preenchido com o trecho e
 * o motivo, e marca a sessão como reportada no aparelho.
 */
export function ReportContent({ detail }: { detail: SessionDetail }) {
  const { sessions, device } = useServices();
  const id = useId();
  const aiTurns = detail.transcript
    .map((turn, index) => ({ ...turn, index }))
    .filter((turn) => turn.speaker === 'ai');
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(detail.reported);
  const [sent, setSent] = useState(false);
  const [turnIndex, setTurnIndex] = useState(aiTurns.at(-1)?.index ?? -1);
  const [reason, setReason] = useState<ReportReason>('offensive');
  const [comment, setComment] = useState('');

  if (aiTurns.length === 0) return null;

  if (!open) {
    return (
      <section className="report">
        {sent && (
          <p className="screen__text" role="status">
            Obrigado. Envie o e-mail que abriu para concluir o reporte.
          </p>
        )}
        {reported && !sent && <p className="screen__text">Você já reportou esta conversa.</p>}
        <button
          className="report__open"
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Reportar resposta inadequada da IA
        </button>
      </section>
    );
  }

  const send = () => {
    const excerpt = detail.transcript[turnIndex]?.text ?? '';
    device.openUrl(buildReportMailto({ detail, excerpt, reason, comment }));
    setOpen(false);
    setSent(true);
    if (!reported) {
      setReported(true);
      void sessions.markReported(detail.id).catch(() => {
        // A marcação local é só referência; o reporte em si é o e-mail.
      });
    }
  };

  return (
    <section className="report report--open" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Reportar resposta da IA
      </h2>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-turn`}>
          Qual resposta
        </label>
        <select
          id={`${id}-turn`}
          className="input"
          value={turnIndex}
          onChange={(event) => {
            setTurnIndex(Number(event.target.value));
          }}
        >
          {aiTurns.map((turn) => (
            <option key={turn.index} value={turn.index}>
              {turn.text.length > PREVIEW_LENGTH
                ? `${turn.text.slice(0, PREVIEW_LENGTH)}…`
                : turn.text}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-reason`}>
          Motivo
        </label>
        <select
          id={`${id}-reason`}
          className="input"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value as ReportReason);
          }}
        >
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-comment`}>
          Comentário (opcional)
        </label>
        <textarea
          id={`${id}-comment`}
          className="input"
          maxLength={1_000}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
        />
      </div>
      <p className="screen__text">
        Abre seu app de e-mail com o trecho escolhido. Nada é enviado sem você confirmar o envio.
      </p>
      <div className="confirm__actions">
        <button className="button" type="button" onClick={send}>
          Abrir e-mail
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
