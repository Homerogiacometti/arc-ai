import { estimateTokens, MEMORY } from '../config/limits';
import { EMPTY_MEMORY, formatMemoryBlock, isMemoryEmpty, normalizeMemory } from './memory';

const many = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix} ${String(index + 1)}`);

describe('normalizeMemory', () => {
  it('tira vazios e repetidos, ignorando maiúsculas, acentos e pontuação final', () => {
    expect(
      normalizeMemory({
        personal: ['Trabalha como médico', '  trabalha  como medico. ', '', '   '],
        mistakes: ['Usa "I go" no passado'],
        strengths: [],
      }),
    ).toEqual({
      personal: ['Trabalha como médico'],
      mistakes: ['Usa "I go" no passado'],
      strengths: [],
    });
  });

  it('aplica os limites de cada lista mantendo os primeiros', () => {
    const result = normalizeMemory({
      personal: many('fato', 20),
      mistakes: many('erro', 12),
      strengths: many('acerto', 11),
    });
    expect(result.personal).toHaveLength(MEMORY.maxPersonalItems);
    expect(result.mistakes).toHaveLength(MEMORY.maxMistakesPerLanguage);
    expect(result.strengths).toHaveLength(MEMORY.maxStrengthsPerLanguage);
    expect(result.personal[0]).toBe('fato 1');
  });
});

describe('formatMemoryBlock', () => {
  it('fica vazio sem memória e mostra só as listas com itens', () => {
    expect(formatMemoryBlock(EMPTY_MEMORY, 'English')).toBe('');
    expect(isMemoryEmpty(EMPTY_MEMORY)).toBe(true);
    const text = formatMemoryBlock(
      { personal: ['Tem um cachorro chamado Thor'], mistakes: [], strengths: ['Bom vocabulário'] },
      'English',
    );
    expect(text).toContain('About the user:\n- Tem um cachorro chamado Thor');
    expect(text).toContain('What the user already does well in English:\n- Bom vocabulário');
    expect(text).not.toContain('Frequent mistakes');
  });

  it('respeita o orçamento de tokens tirando os itens menos importantes', () => {
    const padding = 'x'.repeat(80);
    const lists = {
      personal: many(`fato ${padding}`, 15),
      mistakes: many(`erro ${padding}`, 10),
      strengths: many(`acerto ${padding}`, 10),
    };
    const text = formatMemoryBlock(lists, 'English');
    expect(estimateTokens(text)).toBeLessThanOrEqual(MEMORY.tokenBudget);
    expect(text).toContain(lists.personal[0]);
    expect(text).toContain(lists.mistakes[0]);
    expect(text).not.toContain(lists.personal[14]);
  });
});
