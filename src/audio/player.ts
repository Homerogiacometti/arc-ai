import { OUTPUT_SAMPLE_RATE, pcm16ToFloat } from './pcm';

/**
 * Reproduz PCM 16-bit 24 kHz em fila contínua (cada bloco começa quando o anterior
 * termina). `interrupt()` corta o som na hora e descarta a fila (RF04).
 */
export class PcmPlayer {
  readonly #context: AudioContext;
  readonly #sources = new Set<AudioBufferSourceNode>();
  readonly #onIdle: (() => void) | undefined;
  #nextStartTime = 0;

  constructor(options: { onIdle?: () => void } = {}) {
    this.#context = new AudioContext({
      sampleRate: OUTPUT_SAMPLE_RATE,
      latencyHint: 'interactive',
    });
    this.#onIdle = options.onIdle;
  }

  get isPlaying(): boolean {
    return this.#sources.size > 0;
  }

  /** Deve ser chamado num gesto do usuário (política de autoplay). */
  async resume(): Promise<void> {
    if (this.#context.state === 'suspended') await this.#context.resume();
  }

  enqueue(pcm: Int16Array): void {
    if (pcm.length === 0) return;
    const samples = pcm16ToFloat(pcm);
    const buffer = this.#context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#context.destination);
    const startAt = Math.max(this.#nextStartTime, this.#context.currentTime);
    source.start(startAt);
    this.#nextStartTime = startAt + buffer.duration;

    this.#sources.add(source);
    source.onended = () => {
      this.#sources.delete(source);
      if (this.#sources.size === 0) this.#onIdle?.();
    };
  }

  interrupt(): void {
    const wasPlaying = this.isPlaying;
    for (const source of this.#sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.#sources.clear();
    this.#nextStartTime = 0;
    if (wasPlaying) this.#onIdle?.();
  }

  async close(): Promise<void> {
    this.interrupt();
    await this.#context.close();
  }
}
