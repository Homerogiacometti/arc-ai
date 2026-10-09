import { MEMORY } from '../config/limits';
import { SqlMemoryRepository } from './memory-repository';
import { createTestDatabase } from './test-database';

const english = {
  personal: ['Trabalha como engenheiro', 'Tem um cachorro chamado Thor'],
  mistakes: ['Usa presente no lugar do passado ("I go" por "I went")'],
  strengths: ['Faz perguntas com naturalidade'],
};

async function setup() {
  let now = new Date('2026-10-08T10:00:00Z');
  const db = await createTestDatabase();
  const repository = new SqlMemoryRepository(db, () => now);
  return {
    db,
    repository,
    setNow: (date: string) => {
      now = new Date(date);
    },
  };
}

describe('SqlMemoryRepository', () => {
  it('salva e lê as listas do idioma na ordem', async () => {
    const { repository } = await setup();
    expect(await repository.forLanguage('en-US')).toEqual({
      personal: [],
      mistakes: [],
      strengths: [],
    });
    await repository.replace('en-US', english);
    expect(await repository.forLanguage('en-US')).toEqual(english);
  });

  it('compartilha os itens pessoais entre idiomas e separa erros e acertos', async () => {
    const { repository } = await setup();
    await repository.replace('en-US', english);
    expect(await repository.forLanguage('es-ES')).toEqual({
      personal: english.personal,
      mistakes: [],
      strengths: [],
    });

    await repository.replace('es-ES', {
      personal: [...english.personal, 'Vai viajar para Madri em dezembro'],
      mistakes: ['Confunde ser e estar'],
      strengths: [],
    });
    expect(await repository.forLanguage('en-US')).toEqual({
      ...english,
      personal: [...english.personal, 'Vai viajar para Madri em dezembro'],
    });
    expect((await repository.forLanguage('es-ES')).mistakes).toEqual(['Confunde ser e estar']);
  });

  it('aplica limites e tira repetidos ao salvar', async () => {
    const { repository } = await setup();
    await repository.replace('en-US', {
      personal: Array.from({ length: 20 }, (_, index) => `fato ${String(index)}`),
      mistakes: ['Erro A', 'erro a.', ''],
      strengths: [],
    });
    const lists = await repository.forLanguage('en-US');
    expect(lists.personal).toHaveLength(MEMORY.maxPersonalItems);
    expect(lists.mistakes).toEqual(['Erro A']);
  });

  it('mantém a data dos itens que continuam e atualiza a dos novos', async () => {
    const { repository, setNow } = await setup();
    await repository.replace('en-US', english);
    setNow('2026-10-09T10:00:00Z');
    await repository.replace('en-US', { ...english, strengths: ['Usa bem o passado simples'] });

    const items = await repository.list();
    const dateOf = (content: string) =>
      items.find((item) => item.content === content)?.updatedAt.toISOString();
    expect(dateOf('Trabalha como engenheiro')).toBe('2026-10-08T10:00:00.000Z');
    expect(dateOf('Usa bem o passado simples')).toBe('2026-10-09T10:00:00.000Z');
    expect(dateOf('Faz perguntas com naturalidade')).toBeUndefined();
  });

  it('lista tudo com o idioma de cada item e apaga um item', async () => {
    const { repository } = await setup();
    await repository.replace('en-US', english);
    const items = await repository.list();
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ kind: 'personal', languageCode: null });
    expect(items.find((item) => item.kind === 'mistake')?.languageCode).toBe('en-US');

    const thor = items.find((item) => item.content.includes('Thor'));
    await repository.remove(thor?.id ?? -1);
    expect((await repository.forLanguage('en-US')).personal).toEqual(['Trabalha como engenheiro']);
  });

  it('apaga toda a memória', async () => {
    const { repository } = await setup();
    await repository.replace('en-US', english);
    await repository.clear();
    expect(await repository.list()).toEqual([]);
  });

  it('o banco recusa item pessoal com idioma e erro sem idioma', async () => {
    const { db } = await setup();
    const insert = (kind: string, language: string | null) =>
      db.run(
        "INSERT INTO memory (kind, language_code, position, content, updated_at) VALUES (?, ?, 0, 'x', 'x')",
        [kind, language],
      );
    await expect(insert('personal', 'en-US')).rejects.toThrow();
    await expect(insert('mistake', null)).rejects.toThrow();
  });
});
