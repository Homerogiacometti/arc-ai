import { useCallback, useEffect, useState } from 'react';
import { produceFeedback } from '../../app/session-records';
import type { Services } from '../../app/services';
import type { FeedbackFailure } from '../../feedback/generate-feedback';
import { useServices } from '../../app/services-context';
import type { SessionDetail } from '../../storage/session-repository';

export type DetailState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'generating'; detail: SessionDetail }
  | { status: 'loaded'; detail: SessionDetail; failure?: FeedbackFailure };

/**
 * Carrega uma sessão. Com `autoGenerate`, gera o feedback pendente na hora (tela de
 * feedback, RF10); `generate()` tenta de novo quando falhou (histórico).
 */
export function useSessionDetail(sessionId: number, { autoGenerate = false } = {}) {
  const services = useServices();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void loadDetail(
      services,
      sessionId,
      (detail) => autoGenerate && detail.feedbackStatus === 'pending',
      (next) => {
        if (!controller.signal.aborted) setState(next);
      },
    );
    return () => {
      controller.abort();
    };
  }, [services, sessionId, autoGenerate]);

  const generate = useCallback(() => {
    void loadDetail(services, sessionId, (detail) => detail.feedbackStatus !== 'ready', setState);
  }, [services, sessionId]);

  return { state, generate };
}

async function loadDetail(
  services: Services,
  sessionId: number,
  shouldGenerate: (detail: SessionDetail) => boolean,
  update: (state: DetailState) => void,
): Promise<void> {
  const detail = await services.sessions.get(sessionId);
  if (!detail) {
    update({ status: 'missing' });
    return;
  }
  if (!shouldGenerate(detail)) {
    update({ status: 'loaded', detail });
    return;
  }
  update({ status: 'generating', detail });
  const failure = await produceFeedback(services, sessionId);
  const updated = await services.sessions.get(sessionId);
  update(
    updated
      ? { status: 'loaded', detail: updated, ...(failure ? { failure } : {}) }
      : { status: 'missing' },
  );
}
