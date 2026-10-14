import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { HISTORY } from '../../config/limits';
import type { FeedbackStatus, SessionSummary } from '../../storage/session-repository';
import { useSettingsStore } from '../../store/settings';
import { formatDateTime, formatDuration, modeLabel } from '../format';
import { useNavigation } from '../navigation';
import { ScreenHeader } from '../ScreenHeader';

const STATUS_BADGE: Partial<Record<FeedbackStatus, string>> = {
  pending: 'feedback pendente',
  failed: 'feedback pendente',
};

interface Loaded {
  languageCode: string;
  items: SessionSummary[];
}

/** RF12: as últimas sessões do idioma atual (v3), com data, modo e duração. */
export function HistoryScreen() {
  const { sessions } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const navigate = useNavigation((state) => state.navigate);
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void sessions.list({ limit: HISTORY.visibleSessions, languageCode }).then((list) => {
      if (!controller.signal.aborted) setData({ languageCode, items: list });
    });
    return () => {
      controller.abort();
    };
  }, [sessions, languageCode]);

  const items = data?.languageCode === languageCode ? data.items : null;
  const label = findLanguage(languageCode)?.label ?? 'este idioma';

  return (
    <main className="screen">
      <ScreenHeader title="Histórico" languageSwitch />
      {items === null && <p className="screen__text">Carregando…</p>}
      {items?.length === 0 && (
        <p className="screen__text">
          Nenhuma conversa em {label} ainda. Toque em Iniciar na tela principal.
        </p>
      )}
      {items && items.length > 0 && (
        <p className="screen__text">
          Suas últimas {HISTORY.visibleSessions} conversas em {label}.
        </p>
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
