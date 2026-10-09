import { findLanguage } from '../config/languages';
import { SAMPLE_FEEDBACK } from './fixtures';
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
  it('devolve o feedback validado', async () => {
    const fake = model(JSON.stringify(SAMPLE_FEEDBACK));
    expect(
      await generateFeedback(fake, 'key', { ...input, transcript: [...input.transcript] }),
    ).toEqual(SAMPLE_FEEDBACK);
    expect(fake.generateJson).toHaveBeenCalledWith(
      'key',
      expect.stringContaining('USER: Yesterday'),
      expect.any(Object),
    );
  });

  it('tenta de novo quando a resposta não valida no schema', async () => {
    const fake = model('{"summary": ""}', JSON.stringify(SAMPLE_FEEDBACK));
    await expect(
      generateFeedback(fake, 'key', { ...input, transcript: [...input.transcript] }),
    ).resolves.toEqual(SAMPLE_FEEDBACK);
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
});

describe('feedbackJsonSchema', () => {
  it('gera um schema de objeto sem $schema', () => {
    const schema = feedbackJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema).not.toHaveProperty('$schema');
    expect(JSON.stringify(schema)).toContain('"tense"');
  });
});

describe('hasUserSpeech', () => {
  it('exige ao menos duas palavras do usuário', () => {
    expect(hasUserSpeech([{ speaker: 'ai', text: 'Hello there' }])).toBe(false);
    expect(hasUserSpeech([{ speaker: 'user', text: 'Hi' }])).toBe(false);
    expect(hasUserSpeech([{ speaker: 'user', text: 'Hi there' }])).toBe(true);
  });
});
