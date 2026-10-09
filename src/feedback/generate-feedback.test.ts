import { findLanguage } from '../config/languages';
import { EMPTY_MEMORY } from '../memory/memory';
import { SAMPLE_FEEDBACK, SAMPLE_RESPONSE } from './fixtures';
import {
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

function model(...responses: (string | Error)[]) {
  const generateJson = vi.fn<JsonModel['generateJson']>();
  for (const response of responses) {
    if (response instanceof Error) generateJson.mockRejectedValueOnce(response);
    else generateJson.mockResolvedValueOnce(response);
  }
  return { name: 'fake', generateJson } satisfies JsonModel;
}

describe('generateFeedback', () => {
  it('devolve o feedback e a memória validados', async () => {
    const fake = model(JSON.stringify(SAMPLE_RESPONSE));
    expect(
      await generateFeedback(fake, 'key', { ...input, transcript: [...input.transcript] }),
    ).toEqual(SAMPLE_RESPONSE);
    expect(fake.generateJson).toHaveBeenCalledWith(
      'key',
      expect.stringContaining('USER: Yesterday'),
      expect.any(Object),
    );
  });

  it('tenta de novo quando a resposta não valida no schema', async () => {
    // Feedback sem a memória também não valida.
    const fake = model(JSON.stringify(SAMPLE_FEEDBACK), JSON.stringify(SAMPLE_RESPONSE));
    await expect(
      generateFeedback(fake, 'key', { ...input, transcript: [...input.transcript] }),
    ).resolves.toEqual(SAMPLE_RESPONSE);
    expect(fake.generateJson).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de duas falhas', async () => {
    const fake = model(new Error('offline'), 'não é json');
    await expect(
      generateFeedback(fake, 'key', { ...input, transcript: [...input.transcript] }),
    ).rejects.toBeInstanceOf(FeedbackError);
  });
});

describe('buildFeedbackPrompt', () => {
  it('avalia só o usuário, ignora erros de transcrição e pede português', () => {
    const prompt = buildFeedbackPrompt({ ...input, transcript: [...input.transcript] });
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
