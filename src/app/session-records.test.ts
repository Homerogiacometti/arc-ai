import type { SessionResult } from '../conversation/session-controller';
import { SAMPLE_FEEDBACK, SAMPLE_RESPONSE } from '../feedback/fixtures';
import type { JsonModel } from '../feedback/generate-feedback';
import { SqlMemoryRepository } from '../storage/memory-repository';
import { SqlProfileRepository } from '../storage/profile-repository';
import { SqlSessionRepository } from '../storage/session-repository';
import { createTestDatabase } from '../storage/test-database';
import { produceFeedback, recordSession } from './session-records';

const result = (transcript: SessionResult['transcript']): SessionResult => ({
  startedAt: new Date('2026-10-08T10:00:00Z'),
  endedAt: new Date('2026-10-08T10:03:00Z'),
  durationMs: 180_000,
  endReason: 'user',
  transcript,
  latenciesMs: [800],
  totalTokens: 10,
});

const settings = { languageCode: 'en-US', responseMode: 'balanced' } as const;

async function setup(generateJson: JsonModel['generateJson']) {
  const db = await createTestDatabase();
  return {
    sessions: new SqlSessionRepository(db),
    profiles: new SqlProfileRepository(db),
    memory: new SqlMemoryRepository(db),
    apiKeyStore: {
      get: () => Promise.resolve('key'),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
    feedbackModel: { name: 'fake-model', generateJson },
  };
}

describe('recordSession', () => {
  it('não salva sessão sem fala', async () => {
    const deps = await setup(vi.fn());
    expect(await recordSession(deps, result([]), settings)).toBeNull();
  });

  it('marca o feedback como pendente quando o usuário falou', async () => {
    const deps = await setup(vi.fn());
    const id = await recordSession(
      deps,
      result([
        { speaker: 'ai', text: 'Hi!' },
        { speaker: 'user', text: 'Hello, I am fine' },
      ]),
      settings,
    );
    expect((await deps.sessions.get(id ?? -1))?.feedbackStatus).toBe('pending');
  });

  it('pula o feedback quando só a IA falou', async () => {
    const deps = await setup(vi.fn());
    const id = await recordSession(deps, result([{ speaker: 'ai', text: 'Hi!' }]), settings);
    expect((await deps.sessions.get(id ?? -1))?.feedbackStatus).toBe('skipped');
  });
});

describe('produceFeedback', () => {
  const talk = result([
    { speaker: 'ai', text: 'How was your weekend?' },
    { speaker: 'user', text: 'Yesterday I go to the beach' },
  ]);

  it('gera e salva o feedback', async () => {
    const deps = await setup(vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_RESPONSE))));
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    expect(await deps.sessions.get(id)).toMatchObject({
      feedbackStatus: 'ready',
      feedback: SAMPLE_FEEDBACK,
    });
  });

  it('atualiza a memória do idioma a partir da memória atual', async () => {
    const generateJson = vi.fn<JsonModel['generateJson']>(() =>
      Promise.resolve(JSON.stringify(SAMPLE_RESPONSE)),
    );
    const deps = await setup(generateJson);
    await deps.memory.replace('en-US', {
      personal: ['Trabalha como engenheiro'],
      mistakes: [],
      strengths: [],
    });
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);

    expect(generateJson.mock.calls[0]?.[1]).toContain('Trabalha como engenheiro');
    expect(await deps.memory.forLanguage('en-US')).toEqual(SAMPLE_RESPONSE.memory);
    // O feedback salvo não leva a memória junto.
    expect((await deps.sessions.get(id))?.feedback).toEqual(SAMPLE_FEEDBACK);
  });

  it('falha ao salvar a memória não invalida o feedback', async () => {
    const deps = await setup(vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_RESPONSE))));
    vi.spyOn(deps.memory, 'replace').mockRejectedValueOnce(new Error('disco cheio'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    expect((await deps.sessions.get(id))?.feedbackStatus).toBe('ready');
  });

  it('marca como falha quando não consegue gerar', async () => {
    const deps = await setup(vi.fn(() => Promise.reject(new Error('offline'))));
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    expect((await deps.sessions.get(id))?.feedbackStatus).toBe('failed');
  });

  it('chamadas simultâneas para a mesma sessão geram uma vez só', async () => {
    const generateJson = vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_RESPONSE)));
    const deps = await setup(generateJson);
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await Promise.all([produceFeedback(deps, id), produceFeedback(deps, id)]);
    expect(generateJson).toHaveBeenCalledOnce();
    expect((await deps.sessions.get(id))?.feedbackStatus).toBe('ready');
  });

  it('não chama o modelo de novo se o feedback já existe', async () => {
    const generateJson = vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_RESPONSE)));
    const deps = await setup(generateJson);
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    await produceFeedback(deps, id);
    expect(generateJson).toHaveBeenCalledOnce();
  });
});
