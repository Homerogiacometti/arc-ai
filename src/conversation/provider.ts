/**
 * Contrato entre o app e o serviço de conversa por voz (ADR-005). A UI e o controlador da
 * sessão só conhecem esta interface; a Live API fica em `GeminiLiveProvider`.
 */

export type Speaker = 'user' | 'ai';

export interface ConnectOptions {
  apiKey: string;
  systemInstruction: string;
  /** Silêncio antes de a IA responder (RF05). */
  silenceDurationMs: number;
  /** Voz pré-definida da IA (RF16). */
  voiceName: string;
  /** Handle de retomada de uma conexão anterior (ADR-006, RF08). */
  resumeHandle?: string;
}

export interface ConversationEvents {
  /** Bloco de áudio da IA, PCM 16-bit 24 kHz. */
  onAudio(pcm: Int16Array): void;
  /** O usuário começou a falar por cima da IA: parar e descartar o áudio (RF04). */
  onInterrupted(): void;
  onTurnComplete(): void;
  /** Fragmento de transcrição (RF09); fragmentos do mesmo turno chegam em sequência. */
  onTranscript(speaker: Speaker, text: string): void;
  /** A IA chamou a ferramenta `end_session` (RF07). */
  onEndRequested(): void;
  /** Novo handle para retomar a conversa depois. */
  onResumeHandle(handle: string): void;
  /**
   * O servidor avisou que vai encerrar a conexão em breve (limite de ~10 min); `timeLeftMs` é o
   * prazo informado, quando vier.
   */
  onGoAway(timeLeftMs: number | null): void;
  /** Total de tokens informado pelo servidor (RNF04). */
  onUsage(totalTokens: number): void;
  /** A conexão caiu sem `close()` do app; `reason` traz o código e o motivo, para diagnóstico. */
  onDisconnected(reason?: string): void;
}

export interface ConversationConnection {
  sendAudio(pcm: Int16Array): void;
  /** Envia um texto como turno do usuário (ex.: pedir que a IA abra a conversa). */
  sendText(text: string): void;
  close(): void;
}

/**
 * O servidor recusou a retomada pelo handle. Acontece depois de uma queda brusca (ex.: modo
 * avião): o servidor ainda vê a conexão antiga e responde "already connected".
 */
export class ResumeRejectedError extends Error {}

export interface ConversationProvider {
  connect(options: ConnectOptions, events: ConversationEvents): Promise<ConversationConnection>;
}
