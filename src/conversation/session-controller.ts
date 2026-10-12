import type { MicrophoneChunk } from '../audio/microphone';
import { SILENCE } from '../config/limits';
import {
  ResumeRejectedError,
  type ConnectOptions,
  type ConversationConnection,
  type ConversationProvider,
  type Speaker,
} from './provider';

export interface AudioInput {
  start(onChunk: (chunk: MicrophoneChunk) => void): Promise<void>;
  stop(): Promise<void>;
}

export interface AudioOutput {
  readonly isPlaying: boolean;
  resume(): Promise<void>;
  enqueue(pcm: Int16Array): void;
  interrupt(): void;
  close(): Promise<void>;
}

export type SessionStatus =
  'idle' | 'connecting' | 'active' | 'paused' | 'resuming' | 'reconnecting' | 'ending' | 'ended';

export type EndReason =
  'user' | 'voice' | 'silence' | 'resume-failed' | 'disconnected' | 'start-failed';

export interface TranscriptTurn {
  speaker: Speaker;
  text: string;
}

export interface SessionSnapshot {
  status: SessionStatus;
  /** Quem está falando agora, para o indicador sutil da home. */
  speaker: Speaker | null;
  endReason: EndReason | null;
  /** Detalhe técnico do erro, quando houver (nunca contém a chave). */
  error: string | null;
}

export interface SessionResult {
  startedAt: Date;
  endedAt: Date;
  /** Tempo de conversa, sem as pausas (ADR-006). */
  durationMs: number;
  endReason: EndReason;
  transcript: TranscriptTurn[];
  /** Fim da fala do usuário → primeiro áudio da IA, por turno (RNF01). */
  latenciesMs: number[];
  totalTokens: number;
}

export interface SessionControllerOptions {
  provider: ConversationProvider;
  createInput: () => AudioInput;
  createOutput: (onIdle: () => void) => AudioOutput;
  now?: () => number;
  /** RMS acima disto conta como voz do usuário. */
  voiceThreshold?: number;
  /** Tempo máximo esperando a despedida da IA depois de `end_session`. */
  goodbyeTimeoutMs?: number;
  /** Proteção por silêncio (RF07), em tempo de conversa. */
  silence?: { promptAfterMs: number; endAfterPromptMs: number };
  /** Tempo máximo para abrir uma conexão: sem rede, a abertura pode ficar parada sem falhar. */
  connectTimeoutMs?: number;
  /** Por quanto tempo tentar reconectar depois de uma queda antes de encerrar (RNF03). */
  reconnectWindowMs?: number;
  /** Espera entre tentativas de reconectar; o padrão volta antes se a rede voltar. */
  retryWait?: (ms: number) => Promise<void>;
}

type ConnectionOptions = Omit<ConnectOptions, 'resumeHandle'>;

export type StartOptions = ConnectionOptions & {
  /** Texto enviado ao conectar para a IA abrir a conversa. */
  openingCue: string;
  /** Texto enviado depois de um tempo sem fala, para a IA perguntar se o usuário está ali. */
  silenceCue: string;
  /** Texto para a sessão nova quando a retomada é recusada, com a conversa até ali. */
  recapCue: (transcript: TranscriptTurn[]) => string;
};

const VOICE_THRESHOLD = 0.02;
const GOODBYE_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_WINDOW_MS = 45_000;
const RETRY_INTERVAL_MS = 2_000;
/** Depois de falar, o indicador "usuário" fica aceso por este tempo. */
const SPEAKING_HOLD_MS = 400;
/** Prazo do goAway quando o servidor não informa `timeLeft`. */
const DEFAULT_GO_AWAY_MS = 10_000;
/** A troca forçada acontece este tempo antes do fim do prazo do goAway. */
const HAND_OVER_MARGIN_MS = 3_000;
/** Sem voz do usuário por este tempo (e a IA calada) conta como pausa para trocar. */
const HAND_OVER_QUIET_MS = 700;
/** Limite do áudio guardado durante a troca (~10 s em pacotes de 40 ms). */
const MAX_PENDING_CHUNKS = 250;

/**
 * Coordena uma sessão de conversa: microfone → provedor → alto-falante, cronômetro,
 * transcrição, pausa/retomada (ADR-006), encerramento por botão, voz ou silêncio (RF07),
 * troca de conexão antes do limite do servidor (RF08) e reconexão após quedas (RNF03).
 * Não depende de React; a UI assina `subscribe` e lê `snapshot`.
 */
export class SessionController {
  readonly #options: Required<SessionControllerOptions>;
  readonly #listeners = new Set<() => void>();
  #snapshot: SessionSnapshot = { status: 'idle', speaker: null, endReason: null, error: null };

  #connectOptions: ConnectionOptions | null = null;
  #connection: ConversationConnection | null = null;
  #input: AudioInput | null = null;
  #output: AudioOutput | null = null;
  #resumeHandle: string | null = null;
  #silenceCue = '';
  #recapCue: StartOptions['recapCue'] = () => '';
  /** Tempo de conversa na última fala do usuário ou da IA (proteção por silêncio). */
  #lastActivityMs = 0;
  #silencePrompted = false;
  #handingOver = false;
  /** Depois de um goAway: até quando esperar uma pausa na conversa para trocar de conexão. */
  #handOverDeadline: number | null = null;
  /** Áudio do microfone durante a troca, enviado à nova conexão quando ela abrir. */
  #pendingAudio: Int16Array[] = [];

  #startedAt = 0;
  #activeSince: number | null = null;
  #accumulatedMs = 0;

  #transcript: TranscriptTurn[] = [];
  #latencies: number[] = [];
  #totalTokens = 0;
  #lastVoiceAt = 0;
  #aiAudioStartedThisTurn = false;
  #endRequested = false;
  #goodbyeTimer: ReturnType<typeof setTimeout> | null = null;
  #result: SessionResult | null = null;
  #onEnded: ((result: SessionResult) => void) | null = null;

  constructor(options: SessionControllerOptions) {
    this.#options = {
      now: () => Date.now(),
      voiceThreshold: VOICE_THRESHOLD,
      goodbyeTimeoutMs: GOODBYE_TIMEOUT_MS,
      silence: SILENCE,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      reconnectWindowMs: RECONNECT_WINDOW_MS,
      retryWait: waitForNetworkOrTimeout,
      ...options,
    };
  }

  get snapshot(): SessionSnapshot {
    return this.#snapshot;
  }

  get result(): SessionResult | null {
    return this.#result;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Tempo de conversa até agora, sem pausas. */
  elapsedMs(): number {
    const running = this.#activeSince === null ? 0 : this.#options.now() - this.#activeSince;
    return this.#accumulatedMs + running;
  }

  /**
   * Inicia a sessão. Deve ser chamado direto do toque no botão: o áudio de saída é criado
   * de forma síncrona (antes de qualquer await) para o navegador liberar a reprodução;
   * por isso as opções (chave, instrução) chegam por `loadOptions`.
   */
  async start(
    loadOptions: () => Promise<StartOptions>,
    onEnded: (result: SessionResult) => void,
  ): Promise<void> {
    if (this.#isRunning()) return;
    this.#reset();
    this.#onEnded = onEnded;
    this.#output = this.#options.createOutput(() => {
      this.#updateSpeaker();
      this.#maybeFinishAfterGoodbye();
    });
    void this.#output.resume();
    this.#startedAt = this.#options.now();
    this.#set({ status: 'connecting' });

    try {
      const { openingCue, silenceCue, recapCue, ...connectOptions } = await loadOptions();
      this.#connectOptions = connectOptions;
      this.#silenceCue = silenceCue;
      this.#recapCue = recapCue;
      await this.#openConnection();
      this.#connection?.sendText(openingCue);
      this.#activeSince = this.#options.now();
      this.#set({ status: 'active' });
    } catch (error) {
      await this.#finish('start-failed', describe(error));
    }
  }

  /** Encerramento pelo botão. */
  async stop(): Promise<void> {
    if (this.#isRunning()) await this.#finish('user');
  }

  /** App foi para segundo plano ou a tela bloqueou (ADR-006). */
  async pause(): Promise<void> {
    if (this.#snapshot.status !== 'active') return;
    this.#stopClock();
    this.#set({ status: 'paused', speaker: null });
    this.#output?.interrupt();
    await this.#closeConnection();
  }

  /** App voltou para o primeiro plano: retoma com o handle da Live API. */
  async resume(): Promise<void> {
    if (this.#snapshot.status !== 'paused') return;
    if (!this.#resumeHandle) {
      await this.#finish('resume-failed', 'sem handle de retomada');
      return;
    }
    this.#set({ status: 'resuming' });
    try {
      await this.#openConnection();
      this.#activeSince = this.#options.now();
      this.#set({ status: 'active' });
    } catch (error) {
      await this.#finish('resume-failed', describe(error));
    }
  }

  /** Abre a conexão e liga o microfone (início e retomada). */
  async #openConnection(): Promise<void> {
    this.#connection = await this.#connect();
    this.#input = this.#options.createInput();
    await this.#input.start((chunk) => {
      this.#onMicChunk(chunk);
    });
  }

  /**
   * Abre uma conexão com o handle, se houver. Se o servidor recusar a retomada, abre uma
   * sessão nova e manda a conversa até ali, para a IA continuar de onde parou.
   */
  async #connect(): Promise<ConversationConnection> {
    try {
      return await this.#open();
    } catch (error) {
      if (!(error instanceof ResumeRejectedError)) throw error;
      log(`retomada recusada (${error.message}); abrindo sessão nova com o histórico`);
      this.#resumeHandle = null;
      const connection = await this.#open();
      connection.sendText(this.#recapCue(this.#transcript));
      return connection;
    }
  }

  /**
   * Abre uma conexão nova (com o handle, se houver). Eventos de uma conexão que deixou de ser
   * a atual (trocada ou fechada) são ignorados.
   */
  async #open(): Promise<ConversationConnection> {
    if (!this.#connectOptions) throw new Error('Sessão sem configuração');
    const options: ConnectOptions = {
      ...this.#connectOptions,
      ...(this.#resumeHandle ? { resumeHandle: this.#resumeHandle } : {}),
    };
    let connection: ConversationConnection | null = null;
    /** A conexão caiu enquanto ainda abria (ex.: o servidor recusou a retomada). */
    const opening: { lost: string | null } = { lost: null };
    const current = () => connection !== null && connection === this.#connection;
    const pending = this.#options.provider.connect(options, {
      onAudio: (pcm) => {
        if (current()) this.#onAiAudio(pcm);
      },
      onInterrupted: () => {
        if (!current()) return;
        this.#output?.interrupt();
        this.#aiAudioStartedThisTurn = false;
      },
      onTurnComplete: () => {
        if (!current()) return;
        this.#aiAudioStartedThisTurn = false;
        this.#maybeFinishAfterGoodbye();
      },
      onTranscript: (speaker, text) => {
        if (!current()) return;
        if (speaker === 'user') this.#markActivity();
        this.#appendTranscript(speaker, text);
      },
      onEndRequested: () => {
        if (current()) this.#onEndRequested();
      },
      onResumeHandle: (handle) => {
        this.#resumeHandle = handle;
      },
      onGoAway: (timeLeftMs) => {
        if (!current()) return;
        log(`aviso de fim de conexão (goAway, ${String(timeLeftMs ?? '?')} ms)`);
        this.#scheduleHandOver(timeLeftMs);
      },
      onUsage: (totalTokens) => {
        // Soma por mensagem: o total de cada geração (contexto + resposta), como é cobrado.
        this.#totalTokens += totalTokens;
      },
      onDisconnected: (reason) => {
        if (connection === null) {
          opening.lost = reason ?? 'sem motivo';
          return;
        }
        if (!current()) return;
        log(`queda: ${reason ?? 'sem motivo'}`);
        if (this.#snapshot.status === 'active') void this.#reconnect();
      },
    });
    const opened = await withTimeout(pending, this.#options.connectTimeoutMs);
    if (opening.lost !== null) {
      opened.close();
      throw new Error(`Conexão caiu ao abrir: ${opening.lost}`);
    }
    connection = opened;
    return connection;
  }

  /**
   * RF08: o servidor avisou que vai fechar a conexão (~10 min). A troca espera uma pausa na
   * conversa (ou o fim do prazo) e é feita em `#onMicChunk`, que roda a cada pacote do microfone.
   */
  #scheduleHandOver(timeLeftMs: number | null): void {
    if (this.#handOverDeadline !== null) return;
    const margin = (timeLeftMs ?? DEFAULT_GO_AWAY_MS) - HAND_OVER_MARGIN_MS;
    this.#handOverDeadline = this.#options.now() + Math.max(0, margin);
  }

  /** Troca quando ninguém está falando; no fim do prazo, troca de qualquer jeito. */
  #maybeHandOver(): void {
    if (this.#handOverDeadline === null || this.#handingOver) return;
    const now = this.#options.now();
    const quiet =
      !this.#output?.isPlaying &&
      !this.#aiAudioStartedThisTurn &&
      now - this.#lastVoiceAt >= HAND_OVER_QUIET_MS;
    if (quiet || now >= this.#handOverDeadline) void this.#handOver();
  }

  /**
   * Fecha a conexão atual e só então retoma com o handle numa nova, como a Live API documenta:
   * abrir a nova com a antiga ainda aberta deixava a sessão retomada surda ao microfone. O
   * microfone e o cronômetro seguem; o áudio do intervalo é guardado e enviado à nova conexão.
   */
  async #handOver(): Promise<void> {
    if (this.#handingOver || !this.#statusIs('active')) return;
    this.#handOverDeadline = null;
    if (!this.#resumeHandle) return;
    this.#handingOver = true;
    const previous = this.#connection;
    this.#connection = null;
    previous?.close();
    try {
      const next = await this.#connect();
      // O usuário pode ter parado ou pausado enquanto a conexão abria.
      if (!this.#statusIs('active')) {
        next.close();
        return;
      }
      this.#connection = next;
      for (const pcm of this.#pendingAudio) next.sendAudio(pcm);
      log('conexão trocada');
    } catch (error) {
      log(`troca falhou: ${describe(error)}`);
      if (this.#statusIs('active')) void this.#reconnect();
    } finally {
      this.#handingOver = false;
      this.#pendingAudio = [];
    }
  }

  /**
   * RNF03: a conexão caiu no meio da conversa. Tenta retomar com o handle até a rede voltar,
   * dentro de uma janela de tempo; se não der, encerra e salva o que houver.
   */
  async #reconnect(): Promise<void> {
    this.#handOverDeadline = null;
    const previous = this.#connection;
    this.#connection = null;
    previous?.close();
    if (!this.#resumeHandle) {
      await this.#finish('disconnected');
      return;
    }
    this.#stopClock();
    this.#output?.interrupt();
    this.#set({ status: 'reconnecting', speaker: null });
    const deadline = this.#options.now() + this.#options.reconnectWindowMs;
    while (this.#statusIs('reconnecting')) {
      try {
        const connection = await this.#connect();
        if (!this.#statusIs('reconnecting')) {
          connection.close();
          return;
        }
        this.#connection = connection;
        this.#activeSince = this.#options.now();
        this.#set({ status: 'active' });
        log('reconectada');
        return;
      } catch (error) {
        log(`tentativa de reconexão falhou: ${describe(error)}`);
        const left = deadline - this.#options.now();
        if (left <= 0) break;
        await this.#options.retryWait(Math.min(RETRY_INTERVAL_MS, left));
      }
    }
    if (this.#statusIs('reconnecting')) {
      log('reconexão desistiu');
      await this.#finish('disconnected');
    }
  }

  #onMicChunk({ pcm, level }: MicrophoneChunk): void {
    if (this.#snapshot.status !== 'active') return;
    if (level > this.#options.voiceThreshold) this.#lastVoiceAt = this.#options.now();
    if (this.#connection) {
      this.#connection.sendAudio(pcm);
    } else if (this.#handingOver && this.#pendingAudio.length < MAX_PENDING_CHUNKS) {
      this.#pendingAudio.push(pcm);
    }
    this.#updateSpeaker();
    this.#checkSilence();
    this.#maybeHandOver();
  }

  #markActivity(): void {
    this.#lastActivityMs = this.elapsedMs();
    this.#silencePrompted = false;
  }

  /**
   * RF07: sem fala por um tempo, a IA pergunta se o usuário está ali; sem fala depois da
   * pergunta, encerra e salva. Fala do usuário é o que a Live API transcreve (o volume do
   * microfone sobe com qualquer ruído); a IA falando também conta (o tempo corre depois que
   * ela termina). Usa o tempo de conversa, então pausas não contam.
   */
  #checkSilence(): void {
    const elapsed = this.elapsedMs();
    if (this.#output?.isPlaying) {
      this.#lastActivityMs = elapsed;
      return;
    }
    const silentMs = elapsed - this.#lastActivityMs;
    const { promptAfterMs, endAfterPromptMs } = this.#options.silence;
    if (!this.#silencePrompted && silentMs >= promptAfterMs) {
      this.#silencePrompted = true;
      this.#lastActivityMs = elapsed;
      this.#connection?.sendText(this.#silenceCue);
    } else if (this.#silencePrompted && silentMs >= endAfterPromptMs) {
      void this.#finish('silence');
    }
  }

  #onAiAudio(pcm: Int16Array): void {
    if (this.#snapshot.status !== 'active' && this.#snapshot.status !== 'ending') return;
    if (!this.#aiAudioStartedThisTurn) {
      this.#aiAudioStartedThisTurn = true;
      if (this.#lastVoiceAt > 0) {
        this.#latencies.push(this.#options.now() - this.#lastVoiceAt);
        this.#lastVoiceAt = 0;
      }
    }
    this.#output?.enqueue(pcm);
    this.#updateSpeaker();
  }

  #appendTranscript(speaker: Speaker, text: string): void {
    const last = this.#transcript.at(-1);
    if (last?.speaker === speaker) {
      last.text += text;
    } else {
      this.#transcript.push({ speaker, text });
    }
  }

  #onEndRequested(): void {
    if (this.#endRequested || !this.#isRunning()) return;
    this.#endRequested = true;
    this.#stopClock();
    this.#set({ status: 'ending' });
    void this.#input?.stop();
    this.#goodbyeTimer = setTimeout(() => {
      void this.#finish('voice');
    }, this.#options.goodbyeTimeoutMs);
  }

  /** Depois de `end_session`, encerra quando a despedida terminar de tocar. */
  #maybeFinishAfterGoodbye(): void {
    if (this.#endRequested && !this.#aiAudioStartedThisTurn && !this.#output?.isPlaying) {
      void this.#finish('voice');
    }
  }

  #updateSpeaker(): void {
    let speaker: Speaker | null = null;
    if (this.#output?.isPlaying) speaker = 'ai';
    else if (this.#options.now() - this.#lastVoiceAt < SPEAKING_HOLD_MS) speaker = 'user';
    if (speaker !== this.#snapshot.speaker) this.#set({ speaker });
  }

  async #finish(reason: EndReason, error: string | null = null): Promise<void> {
    if (this.#snapshot.status === 'ended' || this.#result) return;
    this.#stopClock();
    if (this.#goodbyeTimer) clearTimeout(this.#goodbyeTimer);
    const result: SessionResult = {
      startedAt: new Date(this.#startedAt),
      endedAt: new Date(this.#options.now()),
      durationMs: this.#accumulatedMs,
      endReason: reason,
      transcript: this.#transcript
        .map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() }))
        .filter((turn) => turn.text.length > 0),
      latenciesMs: [...this.#latencies],
      totalTokens: this.#totalTokens,
    };
    this.#result = result;
    if (error) log(`encerrada (${reason}): ${error}`);
    this.#set({ status: 'ended', speaker: null, endReason: reason, error });

    await this.#closeConnection();
    const output = this.#output;
    this.#output = null;
    await output?.close();
    this.#onEnded?.(result);
  }

  async #closeConnection(): Promise<void> {
    const input = this.#input;
    const connection = this.#connection;
    this.#input = null;
    this.#connection = null;
    connection?.close();
    await input?.stop();
  }

  #stopClock(): void {
    if (this.#activeSince !== null) {
      this.#accumulatedMs += this.#options.now() - this.#activeSince;
      this.#activeSince = null;
    }
  }

  /** Lê o estado atual sem o estreitamento de tipo de antes de um `await`. */
  #statusIs(status: SessionStatus): boolean {
    return this.#snapshot.status === status;
  }

  #isRunning(): boolean {
    const { status } = this.#snapshot;
    return status !== 'idle' && status !== 'ended';
  }

  #reset(): void {
    this.#connectOptions = null;
    this.#resumeHandle = null;
    this.#silenceCue = '';
    this.#recapCue = () => '';
    this.#lastActivityMs = 0;
    this.#silencePrompted = false;
    this.#handingOver = false;
    this.#handOverDeadline = null;
    this.#pendingAudio = [];
    this.#startedAt = 0;
    this.#activeSince = null;
    this.#accumulatedMs = 0;
    this.#transcript = [];
    this.#latencies = [];
    this.#totalTokens = 0;
    this.#lastVoiceAt = 0;
    this.#aiAudioStartedThisTurn = false;
    this.#endRequested = false;
    this.#goodbyeTimer = null;
    this.#result = null;
    this.#snapshot = { status: 'idle', speaker: null, endReason: null, error: null };
  }

  #set(changes: Partial<SessionSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...changes };
    for (const listener of this.#listeners) listener();
  }
}

/** Diagnóstico da conexão no console (logcat no aparelho): só eventos, nunca conteúdo. */
function log(message: string): void {
  console.info(`[conexão] ${message}`);
}

/** Rejeita se a promessa não resolver a tempo; uma conexão que abrir atrasada é fechada. */
function withTimeout(
  opening: Promise<ConversationConnection>,
  ms: number,
): Promise<ConversationConnection> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('Tempo esgotado ao conectar'));
    }, ms);
    opening.then(
      (connection) => {
        clearTimeout(timer);
        if (timedOut) connection.close();
        else resolve(connection);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Espera o intervalo, ou menos se o aparelho voltar a ficar online. */
function waitForNetworkOrTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('online', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('online', done);
  });
}

/** Mantém o nome do erro (ex.: `NotAllowedError` do microfone) para a UI explicar a causa. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
}
