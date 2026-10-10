import { findLanguage } from '../config/languages';
import { estimateTokens, MEMORY } from '../config/limits';
import { EMPTY_MEMORY } from '../memory/memory';
import { buildConversationInstruction, buildRecapCue } from './conversation-instruction';

const spanish = findLanguage('es-ES');
if (!spanish) throw new Error('es-ES ausente');

describe('buildConversationInstruction', () => {
  it('inclui idioma, nível, modo, recast e encerramento por voz', () => {
    const text = buildConversationInstruction({
      language: spanish,
      profile: { languageCode: 'es-ES', level: 'beginner' },
      info: { interests: 'futebol', goals: '' },
      responseMode: 'quick',
      memory: EMPTY_MEMORY,
    });
    expect(text).toContain('Speak only Español');
    expect(text).toContain('simple vocabulary');
    expect(text).toContain('one or two sentences');
    expect(text).toContain('recast');
    expect(text).toContain('end_session');
    expect(text).toContain('Interests: futebol');
    expect(text).not.toContain('Goals:');
    expect(text).not.toContain('NOTES');
  });

  it('inclui a memória e pede para abrir a conversa a partir dela', () => {
    const text = buildConversationInstruction({
      language: spanish,
      profile: { languageCode: 'es-ES', level: 'intermediate' },
      info: { interests: '', goals: '' },
      responseMode: 'balanced',
      memory: {
        personal: ['Vai viajar para Madri em dezembro'],
        mistakes: ['Confunde ser e estar'],
        strengths: ['Usa bem o pretérito'],
      },
    });
    expect(text).toContain('- Vai viajar para Madri em dezembro');
    expect(text).toContain('Frequent mistakes in Español:\n- Confunde ser e estar');
    expect(text).toContain('Prefer a topic from your notes');
    expect(text).toContain('without ever mentioning the mistakes');
  });

  it('a memória injetada respeita o orçamento de tokens', () => {
    const item = (index: number) => `item ${String(index)} ${'x'.repeat(120)}`;
    const text = buildConversationInstruction({
      language: spanish,
      profile: { languageCode: 'es-ES', level: 'intermediate' },
      info: { interests: '', goals: '' },
      responseMode: 'balanced',
      memory: {
        personal: Array.from({ length: 15 }, (_, index) => item(index)),
        mistakes: Array.from({ length: 10 }, (_, index) => item(100 + index)),
        strengths: Array.from({ length: 10 }, (_, index) => item(200 + index)),
      },
    });
    const notes = text.slice(text.indexOf('NOTES'), text.indexOf('USING YOUR NOTES'));
    expect(estimateTokens(notes)).toBeLessThanOrEqual(MEMORY.tokenBudget + 20);
  });
});

describe('buildRecapCue', () => {
  it('traz os turnos recentes e pede para continuar sem cumprimentar de novo', () => {
    const turns = Array.from({ length: 40 }, (_, i) => ({
      speaker: i % 2 === 0 ? ('ai' as const) : ('user' as const),
      text: `turn ${String(i)} `,
    }));
    const cue = buildRecapCue(turns);
    expect(cue).toContain('You: turn 38\nUser: turn 39\n');
    expect(cue).toContain('User: turn 11');
    expect(cue).not.toContain('turn 9\n');
    expect(cue).toContain('Do not greet the user again');
  });

  it('funciona sem conversa anterior', () => {
    expect(buildRecapCue([])).not.toContain('Conversation so far');
  });
});
