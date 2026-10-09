import type { SessionResult } from '../conversation/session-controller';
import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import type { JsonModel } from '../feedback/generate-feedback';
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
    const deps = await setup(vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_FEEDBACK))));
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    expect(await deps.sessions.get(id)).toMatchObject({
      feedbackStatus: 'ready',
      feedback: SAMPLE_FEEDBACK,
    });
  });

  it('marca como falha quando não consegue gerar', async () => {
    const deps = await setup(vi.fn(() => Promise.reject(new Error('offline'))));
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    expect((await deps.sessions.get(id))?.feedbackStatus).toBe('failed');
  });

  it('chamadas simultâneas para a mesma sessão geram uma vez só', async () => {
    const generateJson = vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_FEEDBACK)));
    const deps = await setup(generateJson);
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await Promise.all([produceFeedback(deps, id), produceFeedback(deps, id)]);
    expect(generateJson).toHaveBeenCalledOnce();
    expect((await deps.sessions.get(id))?.feedbackStatus).toBe('ready');
  });

  it('não chama o modelo de novo se o feedback já existe', async () => {
    const generateJson = vi.fn(() => Promise.resolve(JSON.stringify(SAMPLE_FEEDBACK)));
    const deps = await setup(generateJson);
    const id = (await recordSession(deps, talk, settings)) ?? -1;
    await produceFeedback(deps, id);
    await produceFeedback(deps, id);
    expect(generateJson).toHaveBeenCalledOnce();
  });
});
