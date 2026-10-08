/** Formatos da Live API: entrada PCM 16-bit 16 kHz, saída PCM 16-bit 24 kHz (little-endian). */
export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;
export const INPUT_MIME_TYPE = `audio/pcm;rate=${String(INPUT_SAMPLE_RATE)}`;

export function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

export function pcm16ToFloat(pcm: Int16Array): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    samples[i] = (pcm[i] ?? 0) / 0x8000;
  }
  return samples;
}

/** Bytes little-endian independentemente da plataforma. */
export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.length * 2);
  const view = new DataView(bytes.buffer);
  pcm.forEach((sample, i) => {
    view.setInt16(i * 2, sample, true);
  });
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    view.setUint8(i, binary.charCodeAt(i));
  }
  const pcm = new Int16Array(Math.floor(binary.length / 2));
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = view.getInt16(i * 2, true);
  }
  return pcm;
}

/** Energia RMS (0–1) de um bloco, usada para detectar voz e medir latência (RNF01). */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}
