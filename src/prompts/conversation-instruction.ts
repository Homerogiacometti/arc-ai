import { CONVERSATION_STYLES, type ConversationStyle } from '../config/conversation-styles';
import type { Language } from '../config/languages';
import { LEVELS, type LearnerInfo, type LearnerProfile } from '../config/profile';
import type { ResponseMode } from '../config/response-modes';
import type { TranscriptTurn } from '../conversation/session-controller';
import { formatMemoryBlock, type MemoryLists } from '../memory/memory';
import type { LastSessionContext } from '../storage/session-repository';

/** Versão do texto da instrução; incrementar a cada mudança de conteúdo. */
export const CONVERSATION_INSTRUCTION_VERSION = 3;

/**
 * Mensagem enviada ao conectar para a IA abrir a conversa (RF04). Com conversa anterior no
 * idioma, a abertura é uma continuação dela.
 */
export function buildOpeningCue(hasLastSession: boolean): string {
  return hasLastSession
    ? '(The user is back for another session. Greet them briefly and pick up as a continuation of your last conversation, without repeating how you opened it.)'
    : '(The user has just started the session. Greet them and open the conversation.)';
}

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

/** Tamanho máximo de cada fala da conversa anterior que entra na instrução. */
const TURN_MAX_LENGTH = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quanto tempo passou desde a conversa anterior, em inglês, por dias do calendário. */
export function describeElapsed(from: Date, now: Date): string {
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((day(now).getTime() - day(from).getTime()) / DAY_MS);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${String(days)} days ago`;
  if (days < 45) return `about ${String(Math.round(days / 7))} weeks ago`;
  return 'more than a month ago';
}

function clip(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > TURN_MAX_LENGTH ? `${clean.slice(0, TURN_MAX_LENGTH)}…` : clean;
}

function formatLastSession(last: LastSessionContext, now: Date): string {
  const lines = [`LAST CONVERSATION (${describeElapsed(last.startedAt, now)})`];
  if (last.feedback) lines.push(`- Summary (in Portuguese): ${last.feedback.summary}`);
  const threads = last.feedback?.followUp ?? [];
  if (threads.length > 0) {
    lines.push(`- Open threads to follow up (in Portuguese): ${threads.join('; ')}`);
  }
  if (last.recentTopics.length > 0) {
    lines.push(
      `- Topics of recent conversations (in Portuguese), to vary from: ${last.recentTopics.join('; ')}`,
    );
  }
  if (last.firstAiTurn) {
    lines.push(`- How you opened last time (never open the same way): "${clip(last.firstAiTurn)}"`);
  }
  if (last.lastTurns.length > 0) {
    lines.push(
      '- How it ended:',
      ...last.lastTurns.map(
        ({ speaker, text }) => `  ${speaker === 'user' ? 'User' : 'You'}: ${clip(text)}`,
      ),
    );
  }
  return lines.join('\n');
}

export interface InstructionInput {
  language: Language;
  profile: LearnerProfile;
  /** Interesses e objetivos, comuns a todos os idiomas. */
  info: LearnerInfo;
  responseMode: ResponseMode;
  /** Memória entre sessões (RF11). */
  memory: MemoryLists;
  /** Como a IA conduz a conversa (v3). */
  style: ConversationStyle;
  /** Instruções livres do usuário para a IA (v3); vazio quando não há. */
  customInstructions: string;
  /** A conversa anterior no mesmo idioma, para esta continuar dela (v3). */
  lastSession: LastSessionContext | null;
  now?: Date;
}

/** Instrução de sistema da conversa (RF03, RF04, RF06, RF07, RF11). */
export function buildConversationInstruction({
  language,
  profile,
  info,
  responseMode,
  memory,
  style,
  customInstructions,
  lastSession,
  now = new Date(),
}: InstructionInput): string {
  const about = [
    `Self-declared level: ${LEVELS[profile.level]} (${profile.level}).`,
    info.interests && `Interests: ${info.interests}`,
    info.goals && `Goals: ${info.goals}`,
  ]
    .filter(Boolean)
    .join('\n');
  const notes = formatMemoryBlock(memory, language.nativeName);
  const opening = lastSession
    ? 'You have talked with this user before (see LAST CONVERSATION). Open the conversation as a continuation, like a friend picking up where you left off: a short greeting that fits the time since last time, then bring up an open thread from last time, or something new connected to it, to your notes or to their interests. Never reuse the opening or the first question of last time, and never ask what they want to talk about.'
    : notes
      ? 'You open the conversation: greet the user and start a topic yourself, without asking what they want to talk about. Prefer a topic from your notes about the user (for example, ask how something they mentioned went), and vary it from session to session.'
      : 'You open the conversation: greet the user and start a topic yourself, without asking what they want to talk about.';

  const custom = customInstructions.trim();
  const preferences = custom
    ? `USER PREFERENCES (written by the user; follow them unless they conflict with LANGUAGE, CORRECTIONS or ENDING)\n${custom}\n\n`
    : '';
  const lastBlock = lastSession ? `\n\n${formatLastSession(lastSession, now)}` : '';

  const instruction = `You are a friendly, curious conversation partner. The user is a Brazilian Portuguese speaker practicing spoken ${language.nativeName}. This is a voice conversation.

LANGUAGE
- Speak only ${language.nativeName}.
- If the user speaks Portuguese, help briefly (you may use a few words of Portuguese) and gently bring the conversation back to ${language.nativeName}.

CONVERSATION
- ${opening}
- ${CONVERSATION_STYLES[style].guidance}
- If the user suggests another topic, follow it.
- ${LEVEL_GUIDANCE[profile.level]}
- ${MODE_GUIDANCE[responseMode]}

CORRECTIONS
- Never correct mistakes explicitly and never explain grammar during the conversation.
- Use recasts: when the user makes a mistake, naturally repeat the correct form inside your reply.

ENDING
- When the user asks to stop, in any language (e.g. "let's stop", "vamos parar"), say a short, warm goodbye and call the end_session tool.

${preferences}ABOUT THE USER
${about}${lastBlock}`;

  if (!notes) return instruction;
  return `${instruction}

YOUR NOTES FROM EARLIER SESSIONS (written in Portuguese)
${notes}

USING YOUR NOTES
- Use them like a friend who remembers: bring things up naturally, one at a time. Never read the notes aloud or say you have notes.
- Create natural chances for the user to practice their frequent mistakes (for example, ask about their weekend to practice the past tense), without ever mentioning the mistakes.
- Give room for what they already do well, and raise the challenge a little there.`;
}
