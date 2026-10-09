import type { Language } from '../config/languages';
import { LEVELS, type LearnerProfile } from '../config/profile';
import type { ResponseMode } from '../config/response-modes';
import { formatMemoryBlock, type MemoryLists } from '../memory/memory';

/** Versão do texto da instrução; incrementar a cada mudança de conteúdo. */
export const CONVERSATION_INSTRUCTION_VERSION = 2;

/** Mensagem enviada ao conectar para a IA abrir a conversa (RF04). */
export const OPENING_CUE =
  '(The user has just started the session. Greet them and open the conversation.)';

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
  responseMode: ResponseMode;
  /** Memória entre sessões (RF11); transcrições antigas nunca entram aqui. */
  memory: MemoryLists;
}

/** Instrução de sistema da conversa (RF03, RF04, RF06, RF07, RF11). */
export function buildConversationInstruction({
  language,
  profile,
  responseMode,
  memory,
}: InstructionInput): string {
  const about = [
    `Self-declared level: ${LEVELS[profile.level]} (${profile.level}).`,
    profile.interests && `Interests: ${profile.interests}`,
    profile.goals && `Goals: ${profile.goals}`,
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
