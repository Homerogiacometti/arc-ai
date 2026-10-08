import type { MicrophoneChunk } from '../audio/microphone';
import type {
  ConnectOptions,
  ConversationConnection,
  ConversationEvents,
  ConversationProvider,
} from './provider';
import type { AudioInput, AudioOutput } from './session-controller';

/** Provedor falso para testes: guarda as conexões e deixa o teste emitir eventos. */
export class FakeProvider implements ConversationProvider {
  readonly connections: FakeConnection[] = [];
  failNext: Error | null = null;

  connect(options: ConnectOptions, events: ConversationEvents): Promise<ConversationConnection> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      return Promise.reject(error);
    }
    const connection = new FakeConnection(options, events);
    this.connections.push(connection);
    return Promise.resolve(connection);
  }

  get current(): FakeConnection {
    const connection = this.connections.at(-1);
    if (!connection) throw new Error('Nenhuma conexão');
    return connection;
  }
}

export class FakeConnection implements ConversationConnection {
  readonly sentAudio: Int16Array[] = [];
  readonly sentText: string[] = [];
  closed = false;

  readonly options: ConnectOptions;
  readonly events: ConversationEvents;

  constructor(options: ConnectOptions, events: ConversationEvents) {
    this.options = options;
    this.events = events;
  }

  sendAudio(pcm: Int16Array): void {
    this.sentAudio.push(pcm);
  }

  sendText(text: string): void {
    this.sentText.push(text);
  }

  close(): void {
    this.closed = true;
  }
}

export class FakeInput implements AudioInput {
  onChunk: ((chunk: MicrophoneChunk) => void) | null = null;
  stopped = false;
  startError: Error | null = null;

  start(onChunk: (chunk: MicrophoneChunk) => void): Promise<void> {
    if (this.startError) return Promise.reject(this.startError);
    this.onChunk = onChunk;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.stopped = true;
    this.onChunk = null;
    return Promise.resolve();
  }

  speak(level = 0.1): void {
    this.onChunk?.({ pcm: new Int16Array(640), level });
  }
}

export class FakeOutput implements AudioOutput {
  readonly played: Int16Array[] = [];
  playing = false;
  interrupts = 0;
  closed = false;

  readonly onIdle: () => void;

  constructor(onIdle: () => void) {
    this.onIdle = onIdle;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  enqueue(pcm: Int16Array): void {
    this.played.push(pcm);
    this.playing = true;
  }

  interrupt(): void {
    this.interrupts++;
    const was = this.playing;
    this.playing = false;
    if (was) this.onIdle();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }

  /** Simula o fim natural da reprodução da fila. */
  finishPlaying(): void {
    this.playing = false;
    this.onIdle();
  }
}
