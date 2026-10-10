import type { Language } from '../config/languages';
import { MEMORY } from '../config/limits';
import type { LearnerProfile } from '../config/profile';
import { SKILLS } from '../config/skills';
import type { MemoryLists } from '../memory/memory';
import type { TranscriptEntry } from '../storage/session-repository';

/** Versão do prompt de feedback; incrementar a cada mudança de conteúdo. */
export const FEEDBACK_PROMPT_VERSION = 3;

const SKILL_LIST = Object.entries(SKILLS)
  .map(([key, label]) => `${key} (${label})`)
  .join(', ');

export interface FeedbackInput {
  language: Language;
  profile: LearnerProfile;
  transcript: TranscriptEntry[];
  /** Memória atual do aluno nesse idioma (RF11), para ser mesclada com esta conversa. */
  memory: MemoryLists;
}

export function buildFeedbackPrompt({
  language,
  profile,
  transcript,
  memory,
}: FeedbackInput): string {
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
- Em "level.progress", diga de 0 a 100 quanto o aluno já avançou dentro desse nível CEFR (0 = acabou de chegar nele, 50 = no meio, 100 = pronto para o próximo).
- Em "skills", avalie de 2 a 6 habilidades da lista abaixo que tiveram evidência clara nesta conversa: "strong" quando o aluno usou bem e com segurança, "weak" quando errou de forma relevante. Não inclua habilidades que não apareceram. Cada erro de "mistakes" deve aparecer como "weak" na habilidade correspondente, e uma habilidade não pode ser "strong" e "weak" ao mesmo tempo.
  Habilidades: ${SKILL_LIST}.

Memória:
A IA da conversa usa uma memória curta do aluno para conduzir as próximas conversas: puxar assunto da vida dele, criar oportunidades de praticar os erros frequentes e reforçar o que ele já faz bem. Devolva em "memory" as três listas atualizadas e completas, partindo da memória atual:
- "personal": fatos da vida do aluno úteis para puxar assunto (trabalho, estudos, família, hobbies, planos, acontecimentos recentes ou próximos). Vale para todos os idiomas. No máximo ${String(MEMORY.maxPersonalItems)}.
- "mistakes": padrões de erro recorrentes em ${language.nativeName}, não frases isoladas, do mais importante ao menos importante. No máximo ${String(MEMORY.maxMistakesPerLanguage)}.
- "strengths": o que o aluno já faz bem em ${language.nativeName}, do mais importante ao menos importante. No máximo ${String(MEMORY.maxStrengthsPerLanguage)}.
- Mantenha os itens atuais que continuam válidos, junte itens repetidos ou parecidos em um só, atualize fatos que mudaram e acrescente o que esta conversa trouxe de novo. Quando a lista estiver cheia, fique com os mais úteis.
- Um erro da memória que o aluno usou corretamente nesta conversa pode sair de "mistakes" e virar acerto.
- Em "personal", só o que o aluno contou sobre si mesmo. Não guarde dados sensíveis (saúde, religião, política, vida sexual, finanças, documentos, endereços).
- Cada item em português, curto (até 15 palavras); exemplos no idioma praticado entre aspas.

Memória atual:
${JSON.stringify(memory, null, 2)}

Conversa:
${lines}`;
}
