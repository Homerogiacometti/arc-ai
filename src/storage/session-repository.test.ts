import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import { SqlSessionRepository, type NewSession } from './session-repository';
import { createTestDatabase } from './test-database';

const session = (overrides: Partial<NewSession> = {}): NewSession => ({
  languageCode: 'en-US',
  responseMode: 'balanced',
  instructionVersion: 1,
  startedAt: new Date('2026-10-08T10:00:00Z'),
  endedAt: new Date('2026-10-08T10:05:00Z'),
  durationMs: 290_000.4,
  endReason: 'user',
  totalTokens: 1234,
  latenciesMs: [700.6, 900],
  feedbackStatus: 'pending',
  transcript: [
    { speaker: 'ai', text: 'Hi!' },
    { speaker: 'user', text: 'Hello' },
  ],
  ...overrides,
});

describe('SqlSessionRepository', () => {
  it('salva a sessão com a transcrição e lê o detalhe', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    const id = await repository.create(session());

    expect(await repository.get(id)).toMatchObject({
      id,
      languageCode: 'en-US',
      durationMs: 290_000,
      latenciesMs: [701, 900],
      totalTokens: 1234,
      feedbackStatus: 'pending',
      reported: false,
      transcript: [
        { speaker: 'ai', text: 'Hi!' },
        { speaker: 'user', text: 'Hello' },
      ],
      feedback: null,
    });
    expect(await repository.get(999)).toBeNull();
  });

  it('lista da mais recente para a mais antiga', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    await repository.create(session());
    await repository.create(session({ startedAt: new Date('2026-10-09T10:00:00Z') }));
    const list = await repository.list();
    expect(list.map((item) => item.startedAt.toISOString())).toEqual([
      '2026-10-09T10:00:00.000Z',
      '2026-10-08T10:00:00.000Z',
    ]);
  });

  it('salva o feedback e marca como pronto; salvar de novo substitui', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    const id = await repository.create(session());
    await repository.saveFeedback(id, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 1 });
    await repository.saveFeedback(
      id,
      { ...SAMPLE_FEEDBACK, summary: 'Outro resumo.' },
      { model: 'm', promptVersion: 2 },
    );
    const detail = await repository.get(id);
    expect(detail?.feedbackStatus).toBe('ready');
    expect(detail?.feedback?.summary).toBe('Outro resumo.');
  });

  it('atualiza o status do feedback', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    const id = await repository.create(session());
    await repository.setFeedbackStatus(id, 'failed');
    expect((await repository.get(id))?.feedbackStatus).toBe('failed');
  });

  it('não grava nada se a transcrição falhar no meio', async () => {
    const db = await createTestDatabase();
    const repository = new SqlSessionRepository(db);
    await expect(
      repository.create(session({ transcript: [{ speaker: 'robot' as 'ai', text: 'x' }] })),
    ).rejects.toThrow();
    expect(await repository.list()).toEqual([]);
  });

  it('feedback salvo que não valida mais vira falha', async () => {
    const db = await createTestDatabase();
    const repository = new SqlSessionRepository(db);
    const id = await repository.create(session({ feedbackStatus: 'ready' }));
    await db.run(
      "INSERT INTO feedbacks (session_id, data, model, prompt_version, created_at) VALUES (?, '{}', 'm', 1, 'x')",
      [id],
    );
    expect(await repository.get(id)).toMatchObject({ feedbackStatus: 'failed', feedback: null });
  });

  it('limita a lista às mais recentes', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    for (let day = 1; day <= 4; day++) {
      await repository.create(session({ startedAt: new Date(2026, 9, day, 10) }));
    }
    const list = await repository.list({ limit: 2 });
    expect(list.map((item) => item.startedAt.getDate())).toEqual([4, 3]);
    expect(await repository.list()).toHaveLength(4);
  });

  it('poda a transcrição das antigas com feedback pronto, mantendo as pendentes', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    const ready = await repository.create(session({ startedAt: new Date(2026, 9, 1, 10) }));
    await repository.saveFeedback(ready, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 3 });
    const pending = await repository.create(session({ startedAt: new Date(2026, 9, 2, 10) }));
    const recent = await repository.create(session({ startedAt: new Date(2026, 9, 3, 10) }));
    await repository.saveFeedback(recent, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 3 });

    await repository.pruneTranscripts(1);

    expect((await repository.get(ready))?.transcript).toEqual([]);
    expect((await repository.get(ready))?.feedback).toEqual(SAMPLE_FEEDBACK);
    expect((await repository.get(ready))?.durationMs).toBe(290_000);
    expect((await repository.get(pending))?.transcript).toHaveLength(2);
    expect((await repository.get(recent))?.transcript).toHaveLength(2);
  });

  it('lista os feedbacks de um idioma em ordem cronológica', async () => {
    const repository = new SqlSessionRepository(await createTestDatabase());
    const second = await repository.create(session({ startedAt: new Date(2026, 9, 2, 10) }));
    const first = await repository.create(session({ startedAt: new Date(2026, 9, 1, 10) }));
    const spanish = await repository.create(session({ languageCode: 'es-ES' }));
    await repository.create(session({ startedAt: new Date(2026, 9, 3, 10) })); // sem feedback
    for (const id of [first, second, spanish]) {
      await repository.saveFeedback(id, SAMPLE_FEEDBACK, { model: 'm', promptVersion: 3 });
    }

    const list = await repository.listFeedbacks('en-US');
    expect(list.map((item) => item.sessionId)).toEqual([first, second]);
    expect(list[0]?.feedback).toEqual(SAMPLE_FEEDBACK);
  });
});
