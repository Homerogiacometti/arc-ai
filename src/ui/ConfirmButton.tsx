import { useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  /** Pergunta mostrada antes de confirmar. */
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

/** Ação destrutiva em dois toques, sem diálogo nativo (que travaria a WebView). */
export function ConfirmButton({ label, question, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!asking) {
    return (
      <button
        className="button button--quiet"
        type="button"
        onClick={() => {
          setFailed(false);
          setAsking(true);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="confirm" role="group" aria-label={question}>
      <p className="confirm__question">{question}</p>
      {failed && (
        <p className="error" role="alert">
          Não deu certo. Tente de novo.
        </p>
      )}
      <div className="confirm__actions">
        <button
          className="button button--danger"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onConfirm().then(
              () => {
                setBusy(false);
                setAsking(false);
              },
              () => {
                setBusy(false);
                setFailed(true);
              },
            );
          }}
        >
          {confirmLabel}
        </button>
        <button
          className="button button--quiet"
          type="button"
          disabled={busy}
          onClick={() => {
            setAsking(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
