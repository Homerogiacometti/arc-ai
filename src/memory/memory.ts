import { z } from 'zod';
import { estimateTokens, MEMORY } from '../config/limits';

/** As três listas da memória (RF11), do item mais importante ao menos importante. */
export interface MemoryLists {
  /** Informações pessoais, compartilhadas entre idiomas. */
  personal: string[];
  /** Principais erros no idioma. */
  mistakes: string[];
  /** Principais acertos no idioma. */
  strengths: string[];
}

export type MemoryListName = keyof MemoryLists;

export const EMPTY_MEMORY: MemoryLists = { personal: [], mistakes: [], strengths: [] };

const LIMITS: Record<MemoryListName, number> = {
  personal: MEMORY.maxPersonalItems,
  mistakes: MEMORY.maxMistakesPerLanguage,
  strengths: MEMORY.maxStrengthsPerLanguage,
};

const LIST_NAMES = Object.keys(LIMITS) as MemoryListName[];

/** Atualização devolvida pela chamada de feedback: as três listas completas, já mescladas. */
export const memoryUpdateSchema = z.object({
  personal: z
    .array(z.string())
    .describe(
      `Fatos da vida do aluno úteis para puxar assunto, em português. Máximo ${String(MEMORY.maxPersonalItems)}.`,
    ),
  mistakes: z
    .array(z.string())
    .describe(
      `Erros recorrentes no idioma praticado, em português. Máximo ${String(MEMORY.maxMistakesPerLanguage)}.`,
    ),
  strengths: z
    .array(z.string())
    .describe(
      `O que o aluno já domina no idioma praticado, em português. Máximo ${String(MEMORY.maxStrengthsPerLanguage)}.`,
    ),
});

/** Chave de comparação: ignora maiúsculas, acentos, espaços repetidos e pontuação final. */
export function memoryKey(item: string): string {
  return item
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s.;,!]+$/u, '')
    .trim();
}

/** Limpa as listas: tira vazios e repetidos (mantém o primeiro) e aplica os limites (D8). */
export function normalizeMemory(lists: MemoryLists): MemoryLists {
  const result = { ...EMPTY_MEMORY };
  for (const name of LIST_NAMES) {
    const seen = new Set<string>();
    const items: string[] = [];
    for (const raw of lists[name]) {
      const item = raw.trim().replace(/\s+/g, ' ');
      const key = memoryKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    result[name] = items.slice(0, LIMITS[name]);
  }
  return result;
}

export function isMemoryEmpty(lists: MemoryLists): boolean {
  return LIST_NAMES.every((name) => lists[name].length === 0);
}

/**
 * Texto da memória injetado na instrução de sistema, dentro do orçamento de tokens (RF11).
 * Se passar do orçamento, tira o último item (o menos importante) da lista mais longa até caber.
 * Devolve string vazia quando não há memória.
 */
export function formatMemoryBlock(lists: MemoryLists, languageName: string): string {
  const fitted = normalizeMemory(lists);
  let text = render(fitted, languageName);
  while (estimateTokens(text) > MEMORY.tokenBudget) {
    const longest = LIST_NAMES.reduce((a, b) => (fitted[b].length > fitted[a].length ? b : a));
    fitted[longest] = fitted[longest].slice(0, -1);
    text = render(fitted, languageName);
  }
  return text;
}

function render(lists: MemoryLists, languageName: string): string {
  const sections: [string, string[]][] = [
    ['About the user', lists.personal],
    [`Frequent mistakes in ${languageName}`, lists.mistakes],
    [`What the user already does well in ${languageName}`, lists.strengths],
  ];
  return sections
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}:\n${items.map((item) => `- ${item}`).join('\n')}`)
    .join('\n\n');
}
