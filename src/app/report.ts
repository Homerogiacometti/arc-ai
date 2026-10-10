import { DEVELOPER_EMAIL } from '../config/contact';
import { findLanguage } from '../config/languages';
import { MODELS } from '../config/models';
import type { SessionDetail } from '../storage/session-repository';

/** Motivos do reporte de conteúdo (RF15, política do Google Play para IA generativa). */
export const REPORT_REASONS = {
  offensive: 'Ofensiva ou com discurso de ódio',
  sexual: 'Conteúdo sexual',
  dangerous: 'Perigosa ou ilegal',
  wrong: 'Informação falsa ou enganosa',
  other: 'Outro motivo',
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

/** Trechos longos são cortados para o link caber no app de e-mail. */
const MAX_EXCERPT = 1_000;
const MAX_COMMENT = 1_000;

export interface Report {
  detail: Pick<SessionDetail, 'id' | 'startedAt' | 'languageCode'>;
  excerpt: string;
  reason: ReportReason;
  comment: string;
}

/** Link `mailto:` já preenchido com o trecho da transcrição e o motivo. */
export function buildReportMailto({ detail, excerpt, reason, comment }: Report): string {
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
  const body = [
    `Motivo: ${REPORT_REASONS[reason]}`,
    ...(comment.trim() ? [`Comentário: ${clip(comment.trim(), MAX_COMMENT)}`] : []),
    '',
    'Trecho da IA:',
    `"${clip(excerpt, MAX_EXCERPT)}"`,
    '',
    `Sessão ${String(detail.id)} · ${detail.startedAt.toISOString()} · ${findLanguage(detail.languageCode)?.label ?? detail.languageCode}`,
    `Modelo: ${MODELS.live}`,
  ].join('\n');
  const subject = 'Arc AI: reporte de conteúdo da IA';
  return `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
