import type { LiveServerMessage } from '@google/genai';
import { pcm16ToBase64 } from '../audio/pcm';
import type { ConversationEvents } from './provider';
import {
  buildLiveConfig,
  dispatchServerMessage,
  END_SESSION_TOOL,
  parseDurationMs,
} from './gemini-live-provider';

function events() {
  return {
    onAudio: vi.fn(),
    onInterrupted: vi.fn(),
    onTurnComplete: vi.fn(),
    onTranscript: vi.fn(),
    onEndRequested: vi.fn(),
    onResumeHandle: vi.fn(),
    onGoAway: vi.fn(),
    onUsage: vi.fn(),
    onDisconnected: vi.fn(),
  } satisfies ConversationEvents;
}

const dispatch = (message: object, handlers: ConversationEvents, respond = vi.fn()) => {
  dispatchServerMessage(message as LiveServerMessage, handlers, respond);
  return respond;
};

describe('buildLiveConfig', () => {
  it('liga voz, transcrição, VAD, compressão, retomada e a ferramenta end_session', () => {
    const config = buildLiveConfig({
      apiKey: 'k',
      systemInstruction: 'sys',
      silenceDurationMs: 1300,
      voiceName: 'Kore',
      resumeHandle: 'h1',
    });
    expect(config).toMatchObject({
      systemInstruction: 'sys',
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 1300 } },
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: { handle: 'h1' },
    });
    expect(JSON.stringify(config.tools)).toContain(END_SESSION_TOOL);
    expect(JSON.stringify(config)).not.toContain('"k"');
  });

  it('pede handles de retomada mesmo numa conexão nova', () => {
    const config = buildLiveConfig({
      apiKey: 'k',
      systemInstruction: '',
      silenceDurationMs: 800,
      voiceName: 'Puck',
    });
    expect(config.sessionResumption).toEqual({});
  });
});

describe('dispatchServerMessage', () => {
  it('traduz áudio, transcrições, interrupção e fim de turno', () => {
    const handlers = events();
    dispatch(
      {
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: pcm16ToBase64(new Int16Array([1, 2])) } }],
          },
          inputTranscription: { text: 'hi' },
          outputTranscription: { text: 'hello' },
          interrupted: true,
          turnComplete: true,
        },
      },
      handlers,
    );
    expect(handlers.onAudio).toHaveBeenCalledWith(new Int16Array([1, 2]));
    expect(handlers.onTranscript).toHaveBeenCalledWith('user', 'hi');
    expect(handlers.onTranscript).toHaveBeenCalledWith('ai', 'hello');
    expect(handlers.onInterrupted).toHaveBeenCalledOnce();
    expect(handlers.onTurnComplete).toHaveBeenCalledOnce();
  });

  it('responde à ferramenta end_session e avisa o app', () => {
    const handlers = events();
    const respond = dispatch(
      { toolCall: { functionCalls: [{ id: 'c1', name: END_SESSION_TOOL, args: {} }] } },
      handlers,
    );
    expect(respond).toHaveBeenCalledWith('c1', END_SESSION_TOOL);
    expect(handlers.onEndRequested).toHaveBeenCalledOnce();
  });

  it('guarda só handles retomáveis e repassa goAway e uso', () => {
    const handlers = events();
    dispatch({ sessionResumptionUpdate: { newHandle: 'x', resumable: false } }, handlers);
    dispatch({ sessionResumptionUpdate: { newHandle: 'y', resumable: true } }, handlers);
    dispatch({ goAway: { timeLeft: '10s' }, usageMetadata: { totalTokenCount: 42 } }, handlers);
    expect(handlers.onResumeHandle).toHaveBeenCalledExactlyOnceWith('y');
    expect(handlers.onGoAway).toHaveBeenCalledWith(10_000);
    expect(handlers.onUsage).toHaveBeenCalledWith(42);
  });

  it('converte o prazo do goAway em milissegundos', () => {
    expect(parseDurationMs('10s')).toBe(10_000);
    expect(parseDurationMs('9.5s')).toBe(9_500);
    expect(parseDurationMs(undefined)).toBeNull();
    expect(parseDurationMs('abc')).toBeNull();
  });
});
