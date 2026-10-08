import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formata mm:ss e h:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65_999)).toBe('01:05');
    expect(formatDuration(3_600_000 + 61_000)).toBe('1:01:01');
  });
});
