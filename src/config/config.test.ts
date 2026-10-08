import { DEFAULT_LANGUAGE, findLanguage, LANGUAGES } from './languages';
import { estimateTokens, MEMORY, SILENCE } from './limits';
import { PAUSE_LEVELS } from './pause-levels';
import { settingsSchema } from '../store/settings';

describe('config', () => {
  it('não tem códigos de idioma repetidos e o padrão existe', () => {
    const codes = LANGUAGES.map((language) => language.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(findLanguage(DEFAULT_LANGUAGE)).toBeDefined();
  });

  it('níveis de pausa crescem e ficam até 2000 ms', () => {
    const values = Object.values(PAUSE_LEVELS).map((level) => level.silenceDurationMs);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(Math.max(...values)).toBeLessThanOrEqual(2000);
  });

  it('aplica as decisões D7 e D8', () => {
    expect(SILENCE).toEqual({ promptAfterMs: 120_000, endAfterPromptMs: 30_000 });
    expect(MEMORY.tokenBudget).toBe(600);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('valida configurações com Zod', () => {
    expect(
      settingsSchema.safeParse({ languageCode: 'en-US', responseMode: 'quick', pauseLevel: 'long' })
        .success,
    ).toBe(true);
    expect(
      settingsSchema.safeParse({ languageCode: 'xx', responseMode: 'quick', pauseLevel: 'long' })
        .success,
    ).toBe(false);
  });
});
