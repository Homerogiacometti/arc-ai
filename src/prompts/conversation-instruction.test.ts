import { findLanguage } from '../config/languages';
import { estimateTokens, MEMORY } from '../config/limits';
import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import { EMPTY_MEMORY } from '../memory/memory';
import {
  buildConversationInstruction,
  buildOpeningCue,
  buildRecapCue,
  describeElapsed,
  type InstructionInput,
} from './conversation-instruction';

const spanish = findLanguage('es-ES');
if (!spanish) throw new Error('es-ES ausente');

/** Campos da v3 com os valores de quem nunca mexeu neles. */
const defaults = {
  style: 'balanced',
  customInstructions: '',
  lastSession: null,
} satisfies Partial<InstructionInput>;

describe('buildConversationInstruction', () => {
  it('inclui idioma, nível, modo, recast e encerramento por voz', () => {
    const text = buildConversationInstruction({
      language: spanish,
      profile: { languageCode: 'es-ES', level: 'beginner' },
      info: { interests: 'futebol', goals: '' },
      responseMode: 'quick',
      memory: EMPTY_MEMORY,
      ...defaults,
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
      ...defaults,
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
      ...defaults,
    });
    const notes = text.slice(text.indexOf('NOTES'), text.indexOf('USING YOUR NOTES'));
    expect(estimateTokens(notes)).toBeLessThanOrEqual(MEMORY.tokenBudget + 20);
  });
});

describe('estilo e instruções livres', () => {
  const base = {
    language: spanish,
    profile: { languageCode: 'es-ES', level: 'intermediate' },
    info: { interests: '', goals: '' },
    responseMode: 'balanced',
    memory: EMPTY_MEMORY,
    ...defaults,
  } satisfies InstructionInput;

  it('o estilo troca a orientação de condução', () => {
    expect(buildConversationInstruction(base)).toContain(
      'Lead the conversation like a real person',
    );
    const text = buildConversationInstruction({ ...base, style: 'interviewer' });
    expect(text).toContain('always end your turn with a question');
    expect(text).not.toContain('Lead the conversation like a real person');
  });

  it('inclui as instruções livres só quando existem', () => {
    expect(buildConversationInstruction(base)).not.toContain('USER PREFERENCES');
    const text = buildConversationInstruction({
      ...base,
      customInstructions: '  Me chame de Ho.  ',
    });
    expect(text).toContain('USER PREFERENCES');
    expect(text).toContain('\nMe chame de Ho.\n');
  });
});

describe('continuidade', () => {
  const base = {
    language: spanish,
    profile: { languageCode: 'es-ES', level: 'intermediate' },
    info: { interests: '', goals: '' },
    responseMode: 'balanced',
    memory: EMPTY_MEMORY,
    ...defaults,
    now: new Date(2026, 9, 14, 20),
  } satisfies InstructionInput;

  it('sem conversa anterior, abre do zero', () => {
    const text = buildConversationInstruction(base);
    expect(text).not.toContain('LAST CONVERSATION');
    expect(text).toContain('start a topic yourself');
    expect(buildOpeningCue(false)).toContain('just started');
  });

  it('com conversa anterior, continua dela sem repetir a abertura', () => {
    const text = buildConversationInstruction({
      ...base,
      lastSession: {
        startedAt: new Date(2026, 9, 12, 9),
        feedback: SAMPLE_FEEDBACK,
        firstAiTurn: '¡Hola! ¿Qué tal tu fin de semana?',
        lastTurns: [
          { speaker: 'user', text: 'Tengo que irme.' },
          { speaker: 'ai', text: '¡Hasta luego!' },
        ],
        recentTopics: ['viagem à praia', 'trabalho'],
      },
    });
    expect(text).toContain('LAST CONVERSATION (2 days ago)');
    expect(text).toContain(`Summary (in Portuguese): ${SAMPLE_FEEDBACK.summary}`);
    expect(text).toContain('vai voltar à praia no próximo feriado');
    expect(text).toContain('viagem à praia; trabalho');
    expect(text).toContain('never open the same way): "¡Hola! ¿Qué tal tu fin de semana?"');
    expect(text).toContain('  User: Tengo que irme.\n  You: ¡Hasta luego!');
    expect(text).toContain('Open the conversation as a continuation');
    expect(buildOpeningCue(true)).toContain('continuation');
  });

  it('descreve o tempo desde a última conversa', () => {
    const now = new Date(2026, 9, 14, 8);
    expect(describeElapsed(new Date(2026, 9, 14, 7), now)).toBe('earlier today');
    expect(describeElapsed(new Date(2026, 9, 13, 23), now)).toBe('yesterday');
    expect(describeElapsed(new Date(2026, 9, 9), now)).toBe('5 days ago');
    expect(describeElapsed(new Date(2026, 8, 23), now)).toBe('about 3 weeks ago');
    expect(describeElapsed(new Date(2026, 6, 1), now)).toBe('more than a month ago');
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
