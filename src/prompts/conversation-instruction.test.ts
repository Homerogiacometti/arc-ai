import { findLanguage } from '../config/languages';
import { buildConversationInstruction } from './conversation-instruction';

const spanish = findLanguage('es-ES');
if (!spanish) throw new Error('es-ES ausente');

describe('buildConversationInstruction', () => {
  it('inclui idioma, nível, modo, recast e encerramento por voz', () => {
    const text = buildConversationInstruction({
      language: spanish,
      profile: { languageCode: 'es-ES', level: 'beginner', interests: 'futebol', goals: '' },
      responseMode: 'quick',
    });
    expect(text).toContain('Speak only Español');
    expect(text).toContain('simple vocabulary');
    expect(text).toContain('one or two sentences');
    expect(text).toContain('recast');
    expect(text).toContain('end_session');
    expect(text).toContain('Interests: futebol');
    expect(text).not.toContain('Goals:');
  });
});
