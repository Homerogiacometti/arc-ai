import { RESPONSE_MODES, type ResponseMode } from '../config/response-modes';

/** mm:ss, ou h:mm:ss a partir de uma hora. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${String(hours)}:${mm}:${ss}` : `${mm}:${ss}`;
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Ex.: 08/10/2026, 20:52 */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

/** Rótulo do modo de resposta salvo na sessão. */
export function modeLabel(mode: string): string {
  return mode in RESPONSE_MODES ? RESPONSE_MODES[mode as ResponseMode].label : mode;
}
