import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { HISTORY } from '../../config/limits';
import type { FeedbackStatus, SessionSummary } from '../../storage/session-repository';
import { formatDateTime, formatDuration, modeLabel } from '../format';
import { useNavigation } from '../navigation';
import { ScreenHeader } from '../ScreenHeader';

const STATUS_BADGE: Partial<Record<FeedbackStatus, string>> = {
  pending: 'feedback pendente',
  failed: 'feedback pendente',
};

/** RF12: as últimas sessões, com data, idioma, modo e duração. */
export function HistoryScreen() {
  const { sessions } = useServices();
  const navigate = useNavigation((state) => state.navigate);
  const [items, setItems] = useState<SessionSummary[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void sessions.list({ limit: HISTORY.visibleSessions }).then((list) => {
      if (!controller.signal.aborted) setItems(list);
    });
    return () => {
      controller.abort();
    };
  }, [sessions]);

  return (
    <main className="screen">
      <ScreenHeader title="Histórico" />
      {items === null && <p className="screen__text">Carregando…</p>}
      {items?.length === 0 && (
        <p className="screen__text">Nenhuma conversa ainda. Toque em Iniciar na tela principal.</p>
      )}
      {items && items.length > 0 && (
        <p className="screen__text">Suas últimas {HISTORY.visibleSessions} conversas.</p>
      )}
      {items && items.length > 0 && (
        <ul className="list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="list__item list__item--session"
                type="button"
                onClick={() => {
                  navigate({ name: 'session', id: item.id });
                }}
              >
                <span className="list__title">{formatDateTime(item.startedAt)}</span>
                <span className="list__meta">
                  {findLanguage(item.languageCode)?.label ?? item.languageCode} ·{' '}
                  {modeLabel(item.responseMode)} · {formatDuration(item.durationMs)}
                </span>
                {STATUS_BADGE[item.feedbackStatus] && (
                  <span className="list__badge">{STATUS_BADGE[item.feedbackStatus]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
