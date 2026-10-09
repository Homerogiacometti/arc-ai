import { findLanguage } from '../config/languages';
import { EMPTY_MEMORY } from '../memory/memory';
import { SAMPLE_FEEDBACK, SAMPLE_RESPONSE } from './fixtures';
import {
  classify,
  FeedbackError,
  generateFeedback,
  hasUserSpeech,
  type JsonModel,
} from './generate-feedback';
import { buildFeedbackPrompt } from './prompt';
import { feedbackJsonSchema } from './schema';

const english = findLanguage('en-US');
if (!english) throw new Error('en-US ausente');

const input = {
  language: english,
  profile: { languageCode: 'en-US', level: 'intermediate', interests: '', goals: '' } as const,
  transcript: [
    { speaker: 'ai', text: 'How was your weekend?' },
    { speaker: 'user', text: 'Yesterday I go to the beach' },
  ] as const,
  memory: EMPTY_MEMORY,
};

function model(name: string, ...responses: (string | Error)[]) {
  const generateJson = vi.fn<JsonModel['generateJson']>();
  for (const response of responses) {
    if (response instanceof Error) generateJson.mockRejectedValueOnce(response);
    else generateJson.mockResolvedValueOnce(response);
  }
  return { name, generateJson } satisfies JsonModel;
}

/** Erro como o do SDK: mensagem e status HTTP. */
const apiError = (status: number, message = 'erro') =>
  Object.assign(new Error(message), { status });

const transcript = [...input.transcript];
const noWait = vi.fn(() => Promise.resolve());

beforeEach(() => {
  noWait.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('generateFeedback', () => {
  it('devolve o feedback, a memória e o modelo que gerou', async () => {
    const primary = model('principal', JSON.stringify(SAMPLE_RESPONSE));
    expect(await generateFeedback([primary], 'key', { ...input, transcript })).toEqual({
      response: SAMPLE_RESPONSE,
      model: 'principal',
    });
    expect(primary.generateJson).toHaveBeenCalledWith(
      'key',
      expect.stringContaining('USER: Yesterday'),
      expect.any(Object),
    );
  });

  it('com o principal sobrecarregado, usa o reserva depois de esperar', async () => {
    const primary = model('principal', apiError(503, 'high demand'));
    const fallback = model('reserva', JSON.stringify(SAMPLE_RESPONSE));
    const result = await generateFeedback(
      [primary, fallback],
      'key',
      { ...input, transcript },
      { wait: noWait },
    );
    expect(result.model).toBe('reserva');
    expect(noWait).toHaveBeenCalledWith(1_500);
  });

  it('tenta de novo quando a resposta não valida no schema (sem a memória, por exemplo)', async () => {
    const primary = model(
      'principal',
      JSON.stringify(SAMPLE_FEEDBACK),
      JSON.stringify(SAMPLE_RESPONSE),
    );
    const result = await generateFeedback(
      [primary],
      'key',
      { ...input, transcript },
      { wait: noWait },
    );
    expect(result.response).toEqual(SAMPLE_RESPONSE);
    expect(primary.generateJson).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de todas as tentativas, alternando os modelos, com o motivo', async () => {
    const primary = model('principal', apiError(503), apiError(503));
    const fallback = model('reserva', apiError(503), apiError(503));
    const failure = generateFeedback(
      [primary, fallback],
      'key',
      { ...input, transcript },
      { wait: noWait },
    );
    await expect(failure).rejects.toBeInstanceOf(FeedbackError);
    await expect(failure).rejects.toMatchObject({ reason: 'overloaded' });
    expect(primary.generateJson).toHaveBeenCalledTimes(2);
    expect(fallback.generateJson).toHaveBeenCalledTimes(2);
    expect(noWait.mock.calls).toEqual([[1_500], [5_000], [5_000]]);
  });

  it('chave recusada encerra na hora, sem novas tentativas', async () => {
    const primary = model('principal', apiError(400, 'API_KEY_INVALID'));
    const fallback = model('reserva');
    await expect(
      generateFeedback([primary, fallback], 'key', { ...input, transcript }, { wait: noWait }),
    ).rejects.toMatchObject({ reason: 'auth' });
    expect(fallback.generateJson).not.toHaveBeenCalled();
  });
});

describe('classify', () => {
  it('traduz status e tipo do erro no motivo', () => {
    expect(classify(apiError(503))).toBe('overloaded');
    expect(classify(apiError(500))).toBe('overloaded');
    expect(classify(apiError(429))).toBe('quota');
    expect(classify(apiError(403))).toBe('auth');
    expect(classify(apiError(400, 'API_KEY_INVALID'))).toBe('auth');
    expect(classify(apiError(400, 'schema não suportado'))).toBe('invalid');
    expect(classify(new TypeError('Failed to fetch'))).toBe('network');
    expect(classify(new SyntaxError('JSON'))).toBe('invalid');
  });
});

describe('buildFeedbackPrompt', () => {
  it('avalia só o usuário, ignora erros de transcrição e pede português', () => {
    const prompt = buildFeedbackPrompt({ ...input, transcript });
    expect(prompt).toContain('Avalie apenas as falas do USER');
    expect(prompt).toContain('Ignore prováveis erros da transcrição automática');
    expect(prompt).toContain('português do Brasil');
    expect(prompt).toContain('AI: How was your weekend?');
  });

  it('manda a memória atual para ser mesclada', () => {
    const prompt = buildFeedbackPrompt({
      ...input,
      transcript: [...input.transcript],
      memory: { personal: ['Tem um gato chamado Mingau'], mistakes: [], strengths: [] },
    });
    expect(prompt).toContain('Tem um gato chamado Mingau');
    expect(prompt).toContain('junte itens repetidos');
    expect(prompt).toContain('Não guarde dados sensíveis');
  });
});

describe('feedbackJsonSchema', () => {
  it('gera um schema de objeto sem $schema', () => {
    const schema = feedbackJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema).not.toHaveProperty('$schema');
    expect(JSON.stringify(schema)).toContain('"tense"');
    expect(schema.required).toContain('memory');
  });
});

describe('hasUserSpeech', () => {
  it('exige ao menos duas palavras do usuário', () => {
    expect(hasUserSpeech([{ speaker: 'ai', text: 'Hello there' }])).toBe(false);
    expect(hasUserSpeech([{ speaker: 'user', text: 'Hi' }])).toBe(false);
    expect(hasUserSpeech([{ speaker: 'user', text: 'Hi there' }])).toBe(true);
  });
});
