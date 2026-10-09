import type { Language } from '../config/languages';
import type { LearnerProfile } from '../config/profile';
import type { TranscriptEntry } from '../storage/session-repository';

/** Versão do prompt de feedback; incrementar a cada mudança de conteúdo. */
export const FEEDBACK_PROMPT_VERSION = 1;

export interface FeedbackInput {
  language: Language;
  profile: LearnerProfile;
  transcript: TranscriptEntry[];
}

export function buildFeedbackPrompt({ language, profile, transcript }: FeedbackInput): string {
  const lines = transcript
    .map((turn) => `${turn.speaker === 'user' ? 'USER' : 'AI'}: ${turn.text}`)
    .join('\n');

  return `Você é um professor experiente de ${language.label} (${language.nativeName}) para brasileiros.
Analise a conversa por voz abaixo entre um aluno (USER) e uma IA (AI) e produza o feedback em JSON, seguindo o schema.

Regras:
- Avalie apenas as falas do USER. As falas da AI são só contexto.
- A conversa foi transcrita automaticamente a partir de áudio. Ignore prováveis erros da transcrição automática (palavras trocadas por outras de som parecido, pontuação, maiúsculas, frases cortadas) e não os aponte como erros do aluno.
- Não avalie pronúncia.
- Explicações, resumo, pontos fortes e comentários em português do Brasil, curtos e claros.
- Frases originais, correções e sugestões no idioma praticado (${language.nativeName}).
- Em "mistakes", liste só erros reais e relevantes, do mais importante ao menos importante, no máximo 8. Se não houver erros, devolva a lista vazia.
- Em "vocabulary", sugira até 5 formas mais naturais para o que o aluno disse.
- Em "strengths", de 1 a 4 itens concretos.
- Estime o nível CEFR só com base nesta conversa. Nível autodeclarado pelo aluno: ${profile.level}.

Conversa:
${lines}`;
}
