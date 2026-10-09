import { FakeInput, FakeOutput, FakeProvider } from './fakes';
import { SessionController, type SessionResult } from './session-controller';

function setup() {
  let now = 1_000_000;
  const provider = new FakeProvider();
  const inputs: FakeInput[] = [];
  let output: FakeOutput | null = null;
  const controller = new SessionController({
    provider,
    createInput: () => {
      const input = new FakeInput();
      inputs.push(input);
      return input;
    },
    createOutput: (onIdle) => (output = new FakeOutput(onIdle)),
    now: () => now,
    goodbyeTimeoutMs: 5_000,
  });
  const ended = vi.fn<(result: SessionResult) => void>();
  const start = () =>
    controller.start(
      () =>
        Promise.resolve({
          apiKey: 'k',
          systemInstruction: 'sys',
          silenceDurationMs: 800,
          voiceName: 'Puck',
          openingCue: 'cue',
        }),
      ended,
    );
  return {
    controller,
    provider,
    ended,
    start,
    advance: (ms: number) => (now += ms),
    input: () => {
      const input = inputs.at(-1);
      if (!input) throw new Error('sem microfone');
      return input;
    },
    output: () => {
      if (!output) throw new Error('sem saída');
      return output;
    },
  };
}

describe('SessionController', () => {
  it('conecta, pede a abertura da IA e envia o áudio do microfone', async () => {
    const t = setup();
    await t.start();

    expect(t.controller.snapshot.status).toBe('active');
    expect(t.provider.current.options).toMatchObject({ apiKey: 'k', silenceDurationMs: 800 });
    expect(t.provider.current.sentText).toEqual(['cue']);

    t.input().speak();
    expect(t.provider.current.sentAudio).toHaveLength(1);
    expect(t.controller.snapshot.speaker).toBe('user');
  });

  it('toca o áudio da IA e corta tudo na interrupção', async () => {
    const t = setup();
    await t.start();
    t.provider.current.events.onAudio(new Int16Array(10));
    expect(t.output().played).toHaveLength(1);
    expect(t.controller.snapshot.speaker).toBe('ai');

    t.provider.current.events.onInterrupted();
    expect(t.output().interrupts).toBe(1);
    expect(t.output().isPlaying).toBe(false);
  });

  it('mede a latência do fim da fala até o primeiro áudio da IA, uma vez por turno', async () => {
    const t = setup();
    await t.start();
    t.input().speak();
    t.advance(700);
    t.provider.current.events.onAudio(new Int16Array(10));
    t.advance(100);
    t.provider.current.events.onAudio(new Int16Array(10));
    t.provider.current.events.onTurnComplete();
    await t.controller.stop();

    expect(t.ended.mock.calls[0]?.[0].latenciesMs).toEqual([700]);
  });

  it('junta os fragmentos de transcrição por turno', async () => {
    const t = setup();
    await t.start();
    const { events } = t.provider.current;
    events.onTranscript('ai', 'Hi! How ');
    events.onTranscript('ai', 'are you?');
    events.onTranscript('user', ' I am fine ');
    events.onTranscript('ai', 'Great.');
    await t.controller.stop();

    expect(t.ended.mock.calls[0]?.[0].transcript).toEqual([
      { speaker: 'ai', text: 'Hi! How are you?' },
      { speaker: 'user', text: 'I am fine' },
      { speaker: 'ai', text: 'Great.' },
    ]);
  });

  it('encerra pelo botão com a duração e fecha tudo', async () => {
    const t = setup();
    await t.start();
    t.advance(90_000);
    expect(t.controller.elapsedMs()).toBe(90_000);
    await t.controller.stop();

    expect(t.controller.snapshot).toMatchObject({ status: 'ended', endReason: 'user' });
    expect(t.provider.current.closed).toBe(true);
    expect(t.input().stopped).toBe(true);
    expect(t.output().closed).toBe(true);
    expect(t.ended).toHaveBeenCalledOnce();
    expect(t.ended.mock.calls[0]?.[0].durationMs).toBe(90_000);
  });

  describe('encerramento por voz (end_session)', () => {
    it('espera a despedida terminar de tocar', async () => {
      const t = setup();
      await t.start();
      const { events } = t.provider.current;
      events.onAudio(new Int16Array(10));
      events.onEndRequested();
      expect(t.controller.snapshot.status).toBe('ending');
      expect(t.input().stopped).toBe(true);

      events.onTurnComplete();
      expect(t.ended).not.toHaveBeenCalled();
      t.output().finishPlaying();
      await vi.waitFor(() => {
        expect(t.ended).toHaveBeenCalledOnce();
      });
      expect(t.controller.snapshot.endReason).toBe('voice');
    });

    it('encerra pelo tempo limite se a despedida não terminar', async () => {
      vi.useFakeTimers();
      try {
        const t = setup();
        await t.start();
        t.provider.current.events.onAudio(new Int16Array(10));
        t.provider.current.events.onEndRequested();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(t.ended).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('pausa e retomada (ADR-006)', () => {
    it('pausa o cronômetro e fecha a conexão, retomando com o handle', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onResumeHandle('handle-1');
      t.advance(10_000);

      await t.controller.pause();
      expect(t.controller.snapshot.status).toBe('paused');
      expect(t.provider.current.closed).toBe(true);
      expect(t.input().stopped).toBe(true);
      t.advance(60_000);
      expect(t.controller.elapsedMs()).toBe(10_000);

      await t.controller.resume();
      expect(t.controller.snapshot.status).toBe('active');
      expect(t.provider.connections).toHaveLength(2);
      expect(t.provider.current.options.resumeHandle).toBe('handle-1');
      expect(t.provider.current.sentText).toEqual([]);
      t.advance(5_000);
      expect(t.controller.elapsedMs()).toBe(15_000);
    });

    it('a queda da conexão durante a pausa não encerra a sessão', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onResumeHandle('h');
      const first = t.provider.current;
      await t.controller.pause();
      first.events.onDisconnected();
      expect(t.controller.snapshot.status).toBe('paused');
    });

    it('encerra e salva se a retomada falhar', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onResumeHandle('h');
      t.provider.current.events.onTranscript('ai', 'Hello');
      await t.controller.pause();
      t.provider.failNext = new Error('expired');
      await t.controller.resume();

      expect(t.controller.snapshot).toMatchObject({
        status: 'ended',
        endReason: 'resume-failed',
      });
      expect(t.ended.mock.calls[0]?.[0].transcript).toEqual([{ speaker: 'ai', text: 'Hello' }]);
    });

    it('encerra se não houver handle para retomar', async () => {
      const t = setup();
      await t.start();
      await t.controller.pause();
      await t.controller.resume();
      expect(t.controller.snapshot.endReason).toBe('resume-failed');
    });
  });

  it('encerra quando a conexão cai durante a conversa', async () => {
    const t = setup();
    await t.start();
    t.provider.current.events.onDisconnected();
    await vi.waitFor(() => {
      expect(t.controller.snapshot.endReason).toBe('disconnected');
    });
  });

  it('falha ao iniciar se as opções não carregam (ex.: sem chave)', async () => {
    const t = setup();
    await t.controller.start(() => Promise.reject(new Error('sem chave')), t.ended);
    expect(t.controller.snapshot).toMatchObject({ endReason: 'start-failed', error: 'sem chave' });
    expect(t.provider.connections).toHaveLength(0);
  });

  it('informa falha ao iniciar (ex.: sem conexão)', async () => {
    const t = setup();
    t.provider.failNext = new Error('offline');
    await t.start();
    expect(t.controller.snapshot).toMatchObject({
      status: 'ended',
      endReason: 'start-failed',
      error: 'offline',
    });
    expect(t.output().closed).toBe(true);
  });
});
