import type { Language } from '../config/languages';
import { LEVELS, type LearnerInfo, type LearnerProfile } from '../config/profile';
import type { ResponseMode } from '../config/response-modes';
import type { TranscriptTurn } from '../conversation/session-controller';
import { formatMemoryBlock, type MemoryLists } from '../memory/memory';

/** Versão do texto da instrução; incrementar a cada mudança de conteúdo. */
export const CONVERSATION_INSTRUCTION_VERSION = 2;

/** Mensagem enviada ao conectar para a IA abrir a conversa (RF04). */
export const OPENING_CUE =
  '(The user has just started the session. Greet them and open the conversation.)';

/** Enviada depois de 2 min sem fala (RF07): a IA pergunta se o usuário ainda está ali. */
export const SILENCE_CUE =
  '(The user has been silent for a while. In one short sentence, ask if they are still there.)';

/** Quantos turnos recentes vão no resumo para a sessão nova depois de uma queda. */
const RECAP_TURNS = 30;

/**
 * Enviada quando a retomada é recusada depois de uma queda (RNF03): a sessão nova não tem o
 * contexto, então recebe a conversa até ali e continua de onde parou.
 */
export function buildRecapCue(transcript: TranscriptTurn[]): string {
  const lines = transcript
    .slice(-RECAP_TURNS)
    .map(({ speaker, text }) => `${speaker === 'user' ? 'User' : 'You'}: ${text.trim()}`);
  const history = lines.length > 0 ? `\nConversation so far:\n${lines.join('\n')}\n` : ' ';
  return `(The connection dropped and the conversation continues in a new session.${history}Do not greet the user again. In one short sentence, say the connection dropped, then pick the conversation back up where it stopped.)`;
}

const LEVEL_GUIDANCE: Record<LearnerProfile['level'], string> = {
  beginner: 'Use simple vocabulary, short sentences and a slightly slower, clear pace.',
  intermediate: 'Use everyday vocabulary and natural speed, introducing some new expressions.',
  advanced: 'Speak naturally at native speed, with idioms and richer vocabulary.',
};

const MODE_GUIDANCE: Record<ResponseMode, string> = {
  verbose: 'Give complete, developed answers (around four to six sentences) when it fits.',
  balanced: 'Keep answers medium-sized (around two to four sentences).',
  quick:
    'Keep answers short and direct (one or two sentences) so the user speaks most of the time.',
};

export interface InstructionInput {
  language: Language;
  profile: LearnerProfile;
  /** Interesses e objetivos, comuns a todos os idiomas. */
  info: LearnerInfo;
  responseMode: ResponseMode;
  /** Memória entre sessões (RF11); transcrições antigas nunca entram aqui. */
  memory: MemoryLists;
}

/** Instrução de sistema da conversa (RF03, RF04, RF06, RF07, RF11). */
export function buildConversationInstruction({
  language,
  profile,
  info,
  responseMode,
  memory,
}: InstructionInput): string {
  const about = [
    `Self-declared level: ${LEVELS[profile.level]} (${profile.level}).`,
    info.interests && `Interests: ${info.interests}`,
    info.goals && `Goals: ${info.goals}`,
  ]
    .filter(Boolean)
    .join('\n');
  const notes = formatMemoryBlock(memory, language.nativeName);
  const opening = notes
    ? 'You open the conversation: greet the user and start a topic yourself, without asking what they want to talk about. Prefer a topic from your notes about the user (for example, ask how something they mentioned went), and vary it from session to session.'
    : 'You open the conversation: greet the user and start a topic yourself, without asking what they want to talk about.';

  const instruction = `You are a friendly, curious conversation partner. The user is a Brazilian Portuguese speaker practicing spoken ${language.nativeName}. This is a voice conversation.

LANGUAGE
- Speak only ${language.nativeName}.
- If the user speaks Portuguese, help briefly (you may use a few words of Portuguese) and gently bring the conversation back to ${language.nativeName}.

CONVERSATION
- ${opening}
- Lead the conversation like a real person: ask questions, react, share opinions and small stories.
- If the user suggests another topic, follow it.
- ${LEVEL_GUIDANCE[profile.level]}
- ${MODE_GUIDANCE[responseMode]}

CORRECTIONS
- Never correct mistakes explicitly and never explain grammar during the conversation.
- Use recasts: when the user makes a mistake, naturally repeat the correct form inside your reply.

ENDING
- When the user asks to stop, in any language (e.g. "let's stop", "vamos parar"), say a short, warm goodbye and call the end_session tool.

ABOUT THE USER
${about}`;

  if (!notes) return instruction;
  return `${instruction}

YOUR NOTES FROM EARLIER SESSIONS (written in Portuguese)
${notes}

USING YOUR NOTES
- Use them like a friend who remembers: bring things up naturally, one at a time. Never read the notes aloud or say you have notes.
- Create natural chances for the user to practice their frequent mistakes (for example, ask about their weekend to practice the past tense), without ever mentioning the mistakes.
- Give room for what they already do well, and raise the challenge a little there.`;
}
