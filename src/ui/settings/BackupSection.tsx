import { useId, useRef, useState, type ChangeEvent } from 'react';
import { useServices } from '../../app/services-context';
import { dateKey } from '../../plan/plan';
import { BackupError, describeBackup, parseBackup, type Backup } from '../../storage/backup';
import { useRestart } from '../app-flow';
import { formatDateTime } from '../format';

/** RF14: exportar para um arquivo e importar com confirmação antes de sobrescrever. */
export function BackupSection() {
  const { backup, device } = useServices();
  const restart = useRestart();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);

  const exportFile = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const data = await backup.export();
      await device.shareFile(`arc-ai-backup-${dateKey(new Date())}.json`, JSON.stringify(data));
      setMessage({ text: 'Backup gerado.', error: false });
    } catch {
      setMessage({ text: 'Não foi possível gerar o backup. Tente de novo.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      setPending(parseBackup(await file.text()));
    } catch (error) {
      setMessage({
        text: error instanceof BackupError ? error.message : 'Não foi possível ler o arquivo.',
        error: true,
      });
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await backup.import(pending);
      restart();
    } catch (error) {
      setPending(null);
      setBusy(false);
      setMessage({
        text: error instanceof BackupError ? error.message : 'Não foi possível importar o backup.',
        error: true,
      });
    }
  };

  const summary = pending ? describeBackup(pending) : null;

  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Backup
      </h2>
      <p className="screen__text">
        Perfil, memória, plano, histórico e feedbacks num arquivo. A chave de API não entra no
        backup.
      </p>
      {message && (
        <p
          className={message.error ? 'error' : 'screen__text'}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
      {summary ? (
        <div className="confirm" role="group" aria-label="Confirmar importação">
          <p className="confirm__question">
            Substituir todos os dados deste aparelho pelos do backup de{' '}
            {formatDateTime(summary.exportedAt)} ({summary.sessions}{' '}
            {summary.sessions === 1 ? 'conversa' : 'conversas'})? A chave de API continua a mesma.
          </p>
          <div className="confirm__actions">
            <button
              className="button button--danger"
              type="button"
              disabled={busy}
              onClick={() => void confirmImport()}
            >
              Substituir
            </button>
            <button
              className="button button--quiet"
              type="button"
              disabled={busy}
              onClick={() => {
                setPending(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="section__actions">
          <button
            className="button button--quiet"
            type="button"
            disabled={busy}
            onClick={() => void exportFile()}
          >
            Exportar backup
          </button>
          <button
            className="button button--quiet"
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Importar backup
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            aria-label="Arquivo de backup"
            tabIndex={-1}
            onChange={(event) => void chooseFile(event)}
          />
        </div>
      )}
    </section>
  );
}
