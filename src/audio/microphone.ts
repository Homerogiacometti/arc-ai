import { CAPTURE_PROCESSOR_NAME, captureWorkletUrl } from './capture-worklet';
import { floatToPcm16, INPUT_SAMPLE_RATE, rms } from './pcm';

/** 40 ms por pacote: equilíbrio entre latência e número de mensagens. */
const CHUNK_MS = 40;

export interface MicrophoneChunk {
  pcm: Int16Array;
  /** Energia RMS do pacote (0–1). */
  level: number;
}

/**
 * Captura o microfone em PCM 16-bit mono 16 kHz. O AudioContext é criado já em 16 kHz,
 * então o navegador faz a reamostragem. Cancelamento de eco, supressão de ruído e
 * controle de ganho ficam a cargo do sistema (getUserMedia).
 */
export class Microphone {
  #context: AudioContext | null = null;
  #stream: MediaStream | null = null;
  #node: AudioWorkletNode | null = null;

  async start(onChunk: (chunk: MicrophoneChunk) => void): Promise<void> {
    if (this.#context) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE, latencyHint: 'interactive' });
    const url = captureWorkletUrl();
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const node = new AudioWorkletNode(context, CAPTURE_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      processorOptions: { chunkSize: (INPUT_SAMPLE_RATE * CHUNK_MS) / 1000 },
    });
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      onChunk({ pcm: floatToPcm16(event.data), level: rms(event.data) });
    };
    context.createMediaStreamSource(stream).connect(node);

    this.#stream = stream;
    this.#context = context;
    this.#node = node;
  }

  async stop(): Promise<void> {
    this.#node?.port.close();
    this.#node?.disconnect();
    this.#stream?.getTracks().forEach((track) => {
      track.stop();
    });
    await this.#context?.close();
    this.#node = null;
    this.#stream = null;
    this.#context = null;
  }
}
