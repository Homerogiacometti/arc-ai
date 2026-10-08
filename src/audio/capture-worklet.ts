/**
 * Código do AudioWorkletProcessor, carregado via Blob URL (roda em outro escopo, sem
 * imports). Junta os blocos de 128 amostras em pacotes de `chunkSize` e envia à thread
 * principal como Float32Array transferível.
 */
export const CAPTURE_PROCESSOR_NAME = 'arc-capture';

const source = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options.processorOptions.chunkSize;
    this.buffer = new Float32Array(this.chunkSize);
    this.length = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let offset = 0;
    while (offset < channel.length) {
      const n = Math.min(channel.length - offset, this.chunkSize - this.length);
      this.buffer.set(channel.subarray(offset, offset + n), this.length);
      this.length += n;
      offset += n;
      if (this.length === this.chunkSize) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(this.chunkSize);
        this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor(${JSON.stringify(CAPTURE_PROCESSOR_NAME)}, CaptureProcessor);
`;

export function captureWorkletUrl(): string {
  return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
}
