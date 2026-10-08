import type { MicrophoneChunk } from '../audio/microphone';
import type {
  ConnectOptions,
  ConversationConnection,
  ConversationProvider,
  Speaker,
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
  'idle' | 'connecting' | 'active' | 'paused' | 'resuming' | 'ending' | 'ended';

export type EndReason = 'user' | 'voice' | 'resume-failed' | 'disconnected' | 'start-failed';

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
}

type ConnectionOptions = Omit<ConnectOptions, 'resumeHandle'>;

export type StartOptions = ConnectionOptions & {
  /** Texto enviado ao conectar para a IA abrir a conversa. */
  openingCue: string;
};

const VOICE_THRESHOLD = 0.02;
const GOODBYE_TIMEOUT_MS = 10_000;
/** Depois de falar, o indicador "usuário" fica aceso por este tempo. */
const SPEAKING_HOLD_MS = 400;

/**
 * Coordena uma sessão de conversa: microfone → provedor → alto-falante, cronômetro,
 * transcrição, pausa/retomada (ADR-006) e encerramento por botão ou voz (RF07).
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
      const { openingCue, ...connectOptions } = await loadOptions();
      this.#connectOptions = connectOptions;
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

  async #openConnection(): Promise<void> {
    if (!this.#connectOptions) throw new Error('Sessão sem configuração');
    const options: ConnectOptions = {
      ...this.#connectOptions,
      ...(this.#resumeHandle ? { resumeHandle: this.#resumeHandle } : {}),
    };
    this.#connection = await this.#options.provider.connect(options, {
      onAudio: (pcm) => {
        this.#onAiAudio(pcm);
      },
      onInterrupted: () => {
        this.#output?.interrupt();
        this.#aiAudioStartedThisTurn = false;
      },
      onTurnComplete: () => {
        this.#aiAudioStartedThisTurn = false;
        this.#maybeFinishAfterGoodbye();
      },
      onTranscript: (speaker, text) => {
        this.#appendTranscript(speaker, text);
      },
      onEndRequested: () => {
        this.#onEndRequested();
      },
      onResumeHandle: (handle) => {
        this.#resumeHandle = handle;
      },
      onGoAway: () => {
        // Reconexão transparente perto do limite de ~10 min: M8 (RF08).
      },
      onUsage: (totalTokens) => {
        // Soma por mensagem; a semântica exata do usageMetadata da Live API é conferida no M8 (RNF04).
        this.#totalTokens += totalTokens;
      },
      onDisconnected: () => {
        if (this.#snapshot.status === 'active') void this.#finish('disconnected');
      },
    });

    this.#input = this.#options.createInput();
    await this.#input.start((chunk) => {
      this.#onMicChunk(chunk);
    });
  }

  #onMicChunk({ pcm, level }: MicrophoneChunk): void {
    if (this.#snapshot.status !== 'active') return;
    if (level > this.#options.voiceThreshold) this.#lastVoiceAt = this.#options.now();
    this.#connection?.sendAudio(pcm);
    this.#updateSpeaker();
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

  #isRunning(): boolean {
    const { status } = this.#snapshot;
    return status !== 'idle' && status !== 'ended';
  }

  #reset(): void {
    this.#connectOptions = null;
    this.#resumeHandle = null;
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

/** Mantém o nome do erro (ex.: `NotAllowedError` do microfone) para a UI explicar a causa. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
}
