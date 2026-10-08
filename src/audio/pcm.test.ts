import { base64ToPcm16, floatToPcm16, pcm16ToBase64, pcm16ToFloat, rms } from './pcm';

describe('pcm', () => {
  it('converte float em PCM 16-bit com saturação', () => {
    expect([...floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))]).toEqual([
      0, 32767, -32768, 32767, -32768, 16383,
    ]);
  });

  it('volta de PCM para float', () => {
    const back = pcm16ToFloat(new Int16Array([0, -32768, 16384]));
    expect([...back]).toEqual([0, -1, 0.5]);
  });

  it('base64 é little-endian e faz ida e volta', () => {
    const pcm = new Int16Array([1, -2, 32767, -32768]);
    const base64 = pcm16ToBase64(pcm);
    expect(atob(base64).charCodeAt(0)).toBe(1);
    expect(atob(base64).charCodeAt(1)).toBe(0);
    expect([...base64ToPcm16(base64)]).toEqual([...pcm]);
  });

  it('base64 aguenta blocos grandes', () => {
    const pcm = new Int16Array(100_000).map((_, i) => (i % 2000) - 1000);
    expect([...base64ToPcm16(pcm16ToBase64(pcm))]).toEqual([...pcm]);
  });

  it('calcula RMS', () => {
    expect(rms(new Float32Array([]))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
