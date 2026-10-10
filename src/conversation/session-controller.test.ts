import { FakeInput, FakeOutput, FakeProvider } from './fakes';
import { ResumeRejectedError } from './provider';
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
    silence: { promptAfterMs: 120_000, endAfterPromptMs: 30_000 },
    connectTimeoutMs: 1_000,
    reconnectWindowMs: 45_000,
    retryWait: (ms: number) => {
      now += ms;
      return Promise.resolve();
    },
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
          silenceCue: 'silence-cue',
          recapCue: (transcript) => `recap:${transcript.map((turn) => turn.text).join('|')}`,
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

  describe('proteção por silêncio (RF07)', () => {
    it('ruído no microfone não conta como fala', async () => {
      const t = setup();
      await t.start();
      t.advance(120_000);
      t.input().speak(0.5);
      expect(t.provider.current.sentText).toEqual(['cue', 'silence-cue']);
    });

    it('pergunta após 2 min sem fala e encerra 30 s depois da pergunta', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onTranscript('user', 'Hi there');
      t.advance(119_000);
      t.input().speak(0);
      expect(t.provider.current.sentText).toEqual(['cue']);

      t.advance(1_000);
      t.input().speak(0);
      expect(t.provider.current.sentText).toEqual(['cue', 'silence-cue']);

      t.advance(29_000);
      t.input().speak(0);
      expect(t.controller.snapshot.status).toBe('active');
      t.advance(1_000);
      t.input().speak(0);
      await vi.waitFor(() => {
        expect(t.ended).toHaveBeenCalled();
      });
      expect(t.controller.snapshot.endReason).toBe('silence');
      expect(t.ended.mock.calls[0]?.[0].transcript).toEqual([
        { speaker: 'user', text: 'Hi there' },
      ]);
    });

    it('a fala transcrita do usuário e a IA falando zeram a contagem', async () => {
      const t = setup();
      await t.start();
      t.advance(100_000);
      t.provider.current.events.onTranscript('user', 'I am here');
      t.advance(100_000);
      t.input().speak(0);
      t.provider.current.events.onAudio(new Int16Array(10));
      t.advance(100_000);
      t.input().speak(0);
      t.output().finishPlaying();
      t.advance(100_000);
      t.input().speak(0);
      expect(t.provider.current.sentText).toEqual(['cue']);
    });

    it('depois da pergunta, a resposta da IA e a fala do usuário mantêm a sessão', async () => {
      const t = setup();
      await t.start();
      t.advance(120_000);
      t.input().speak(0);
      t.provider.current.events.onAudio(new Int16Array(10));
      t.advance(10_000);
      t.input().speak(0);
      t.output().finishPlaying();
      t.advance(20_000);
      t.provider.current.events.onTranscript('user', 'Yes, sorry');
      t.advance(60_000);
      t.input().speak(0);
      expect(t.controller.snapshot.status).toBe('active');
    });

    it('tempo em pausa não conta como silêncio', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onResumeHandle('h');
      t.advance(100_000);
      await t.controller.pause();
      t.advance(600_000);
      await t.controller.resume();
      t.advance(10_000);
      t.input().speak(0);
      expect(t.provider.current.sentText).toEqual([]);
    });
  });

  describe('troca de conexão antes do limite (RF08)', () => {
    it('abre a próxima com o handle e fecha a anterior, sem parar microfone nem cronômetro', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      const mic = t.input();
      first.events.onResumeHandle('h1');
      first.events.onTranscript('user', 'Hello');
      t.advance(9 * 60_000);

      first.events.onGoAway();
      await vi.waitFor(() => {
        expect(first.closed).toBe(true);
      });
      const second = t.provider.current;
      expect(second).not.toBe(first);
      expect(second.options.resumeHandle).toBe('h1');
      expect(second.sentText).toEqual([]);
      expect(t.input()).toBe(mic);
      expect(t.controller.snapshot.status).toBe('active');

      // Eventos atrasados da conexão antiga são ignorados; a nova continua a transcrição.
      first.events.onDisconnected();
      first.events.onTranscript('ai', 'stale');
      second.events.onTranscript('user', ' world');
      mic.speak(0.1);
      expect(second.sentAudio).toHaveLength(1);
      expect(t.controller.snapshot.status).toBe('active');

      t.advance(60_000);
      await t.controller.stop();
      expect(t.ended.mock.calls[0]?.[0]).toMatchObject({
        durationMs: 10 * 60_000,
        transcript: [{ speaker: 'user', text: 'Hello world' }],
      });
    });

    it('se a troca falhar, segue na conexão atual', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      first.events.onResumeHandle('h1');
      t.provider.failNext = new Error('busy');
      first.events.onGoAway();
      await vi.waitFor(() => {
        expect(t.provider.failNext).toBeNull();
      });
      expect(first.closed).toBe(false);
      expect(t.controller.snapshot.status).toBe('active');
    });
  });

  describe('queda de conexão (RNF03)', () => {
    it('reconecta com o handle e o tempo reconectando não conta', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      first.events.onResumeHandle('h1');
      t.advance(30_000);
      t.provider.failNext = new Error('offline');

      first.events.onDisconnected();
      expect(t.controller.snapshot.status).toBe('reconnecting');
      t.advance(5_000);
      await vi.waitFor(() => {
        expect(t.controller.snapshot.status).toBe('active');
      });
      expect(t.provider.current).not.toBe(first);
      expect(t.provider.current.options.resumeHandle).toBe('h1');
      expect(t.controller.elapsedMs()).toBe(30_000);
    });

    it('continua tentando até a rede voltar, dentro da janela', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      first.events.onResumeHandle('h1');
      const real = t.provider.connect.bind(t.provider);
      let failures = 0;
      vi.spyOn(t.provider, 'connect').mockImplementation((options, events) => {
        if (failures < 5) {
          failures++;
          return Promise.reject(new Error('offline'));
        }
        return real(options, events);
      });

      first.events.onDisconnected();
      await vi.waitFor(() => {
        expect(t.controller.snapshot.status).toBe('active');
      });
      expect(failures).toBe(5);
    });

    it('conexão que cai enquanto abre (retomada recusada) conta como falha e tenta de novo', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      first.events.onResumeHandle('h1');
      const real = t.provider.connect.bind(t.provider);
      let refused = 0;
      vi.spyOn(t.provider, 'connect').mockImplementation(async (options, events) => {
        const connection = await real(options, events);
        if (refused < 2) {
          refused++;
          events.onDisconnected('fechada (1008) handle inválido');
        }
        return connection;
      });

      first.events.onDisconnected('fechada (1006)');
      await vi.waitFor(() => {
        expect(t.controller.snapshot.status).toBe('active');
      });
      expect(refused).toBe(2);
      expect(t.provider.connections.slice(-3).map((connection) => connection.closed)).toEqual([
        true,
        true,
        false,
      ]);
    });

    it('retomada recusada: abre sessão nova sem handle e manda a conversa até ali', async () => {
      const t = setup();
      await t.start();
      const first = t.provider.current;
      first.events.onResumeHandle('h1');
      first.events.onTranscript('ai', 'How was your weekend?');
      first.events.onTranscript('user', 'Great');
      t.provider.failNext = new ResumeRejectedError('already connected');

      first.events.onDisconnected('fechada (1006)');
      await vi.waitFor(() => {
        expect(t.controller.snapshot.status).toBe('active');
      });
      expect(t.provider.current).not.toBe(first);
      expect(t.provider.current.options.resumeHandle).toBeUndefined();
      expect(t.provider.current.sentText).toEqual(['recap:How was your weekend?|Great']);

      t.input().speak();
      expect(t.provider.current.sentAudio).toHaveLength(1);
    });

    it('sem rede, a abertura que fica parada esgota o tempo e conta como falha', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const t = setup();
        await t.start();
        t.provider.current.events.onResumeHandle('h1');
        vi.spyOn(t.provider, 'connect').mockReturnValue(new Promise(() => undefined));
        t.provider.current.events.onDisconnected();
        expect(t.controller.snapshot.status).toBe('reconnecting');
        for (let i = 0; i < 30 && t.controller.snapshot.status === 'reconnecting'; i++) {
          await vi.advanceTimersByTimeAsync(1_000);
        }
        expect(t.controller.snapshot.endReason).toBe('disconnected');
      } finally {
        vi.useRealTimers();
      }
    });

    it('encerra e salva quando a janela de reconexão acaba', async () => {
      const t = setup();
      await t.start();
      t.provider.current.events.onResumeHandle('h1');
      t.provider.current.events.onTranscript('user', 'Hello there');
      const failing = vi.spyOn(t.provider, 'connect').mockRejectedValue(new Error('offline'));

      t.provider.current.events.onDisconnected();
      await vi.waitFor(() => {
        expect(t.ended).toHaveBeenCalled();
      });
      expect(t.controller.snapshot.endReason).toBe('disconnected');
      // Uma tentativa a cada 2 s (0 a 44 s) e a última no fim da janela (45 s).
      expect(failing).toHaveBeenCalledTimes(24);
      expect(t.ended.mock.calls[0]?.[0].transcript).toEqual([
        { speaker: 'user', text: 'Hello there' },
      ]);
    });
  });
});
