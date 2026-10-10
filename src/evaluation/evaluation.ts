import { SKILL_KEYS, type Skill } from '../config/skills';
import { CEFR_LEVELS, type Feedback, type MistakeCategory } from '../feedback/schema';

/**
 * Avaliação (M9.1): nível e mapa de pontos fortes e fracos, calculados a partir dos feedbacks
 * salvos de um idioma, do mais antigo ao mais recente. Nada disso fica gravado: muda o método,
 * muda o resultado de todo o histórico.
 */

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export interface EvaluatedSession {
  startedAt: Date;
  feedback: Feedback;
}

export const EVALUATION = {
  /** Conversas que entram na média do nível atual. */
  levelWindow: 5,
  /** Conversas mostradas no gráfico de evolução. */
  historySize: 20,
  /** Peso que o score de uma habilidade mantém a cada conversa nova. */
  skillDecay: 0.85,
  /** A partir deste score (em módulo), a habilidade é ponto forte ou fraco. */
  skillThreshold: 1.5,
  /** Comparação para as setas de evolução: o score de tantas conversas atrás. */
  trendLookback: 5,
  /** Diferença mínima de score para mostrar seta. */
  trendDelta: 0.5,
  /** Habilidade com score menor que isto (em módulo) sai do mapa: ficou sem evidência recente. */
  skillMinimum: 0.3,
  /** Progresso usado nos feedbacks antigos, que só têm o degrau CEFR. */
  defaultProgress: 50,
} as const;

const MAX_SCORE = CEFR_LEVELS.length - 0.01;

/** Nota da conversa: índice do CEFR (A1 = 0 … C2 = 5) mais o progresso dentro do nível. */
export function sessionScore(feedback: Feedback): number {
  const index = CEFR_LEVELS.indexOf(feedback.level.cefr);
  const progress = feedback.level.progress ?? EVALUATION.defaultProgress;
  return Math.min(MAX_SCORE, index + progress / 100);
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function levelOf(score: number): CefrLevel {
  const index = Math.min(CEFR_LEVELS.length - 1, Math.max(0, Math.floor(score)));
  return CEFR_LEVELS[index] ?? 'A1';
}

export interface LevelPoint {
  date: Date;
  /** Nota da conversa. */
  score: number;
  /** Média móvel até esta conversa. */
  average: number;
}

export interface LevelSummary {
  /** Média das últimas conversas. */
  score: number;
  level: CefrLevel;
  /** Próximo nível, ou null no C2. */
  next: CefrLevel | null;
  /** Fração do caminho até o próximo nível, de 0 a 1. */
  progress: number;
  /** Conversas que entraram na média. */
  basedOn: number;
  /** Total de conversas avaliadas. */
  sessions: number;
  /** Nível alcançado com a conversa mais recente, quando ela fez a média subir de degrau. */
  promotedTo: CefrLevel | null;
  /** Últimas conversas, da mais antiga à mais recente. */
  history: LevelPoint[];
}

export function summarizeLevel(sessions: readonly EvaluatedSession[]): LevelSummary | null {
  if (sessions.length === 0) return null;
  const scores = sessions.map((session) => sessionScore(session.feedback));
  const movingAverage = (end: number) =>
    average(scores.slice(Math.max(0, end - EVALUATION.levelWindow), end));

  const score = movingAverage(scores.length);
  const level = levelOf(score);
  const index = CEFR_LEVELS.indexOf(level);
  const previous = scores.length > 1 ? movingAverage(scores.length - 1) : null;
  const promoted = previous !== null && Math.floor(score) > Math.floor(previous);

  const history = sessions
    .map((session, position) => ({
      date: session.startedAt,
      score: scores[position] ?? 0,
      average: movingAverage(position + 1),
    }))
    .slice(-EVALUATION.historySize);

  return {
    score,
    level,
    next: CEFR_LEVELS[index + 1] ?? null,
    progress: index === CEFR_LEVELS.length - 1 ? 1 : score - index,
    basedOn: Math.min(scores.length, EVALUATION.levelWindow),
    sessions: scores.length,
    promotedTo: promoted ? level : null,
    history,
  };
}

/** Feedbacks antigos não avaliam habilidades: os erros viram evidência fraca. */
const SKILL_BY_MISTAKE: Partial<Record<MistakeCategory, Skill>> = {
  preposition: 'prepositions',
  tense: 'past',
  'word-order': 'word-order',
  vocabulary: 'vocabulary',
};

/** Evidência de cada habilidade numa conversa: +1 usou bem, −1 errou. Erro prevalece. */
export function skillEvidence(feedback: Feedback): Map<Skill, 1 | -1> {
  const evidence = new Map<Skill, 1 | -1>();
  if (feedback.skills) {
    for (const { skill, evaluation } of feedback.skills) {
      if (evaluation === 'weak') evidence.set(skill, -1);
      else if (!evidence.has(skill)) evidence.set(skill, 1);
    }
    return evidence;
  }
  for (const mistake of feedback.mistakes) {
    const skill = SKILL_BY_MISTAKE[mistake.category];
    if (skill) evidence.set(skill, -1);
  }
  return evidence;
}

export type SkillStatus = 'strong' | 'weak' | 'developing';

export interface SkillScore {
  skill: Skill;
  score: number;
  status: SkillStatus;
  /** Comparado com algumas conversas atrás; null quando ainda não há base ou mudou pouco. */
  trend: 'up' | 'down' | null;
  /** Era ponto fraco e virou ponto forte. */
  turnedStrong: boolean;
}

export function skillStatus(score: number): SkillStatus {
  if (score >= EVALUATION.skillThreshold) return 'strong';
  if (score <= -EVALUATION.skillThreshold) return 'weak';
  return 'developing';
}

/**
 * Score por habilidade: a cada conversa, o score anterior perde peso (decaimento) e soma a
 * evidência nova. Assim o mapa acompanha a evolução: um erro antigo que parou de acontecer
 * vai sumindo, e o que o aluno passou a acertar sobe.
 */
export function scoreSkills(sessions: readonly EvaluatedSession[]): SkillScore[] {
  const seen = new Set<Skill>();
  let scores = new Map<Skill, number>();
  const snapshots: Map<Skill, number>[] = [scores];
  for (const session of sessions) {
    const evidence = skillEvidence(session.feedback);
    const next = new Map<Skill, number>();
    for (const skill of SKILL_KEYS) {
      const value = (scores.get(skill) ?? 0) * EVALUATION.skillDecay + (evidence.get(skill) ?? 0);
      if (value !== 0) next.set(skill, value);
      if (evidence.has(skill)) seen.add(skill);
    }
    scores = next;
    snapshots.push(scores);
  }

  const past =
    sessions.length > EVALUATION.trendLookback
      ? snapshots[snapshots.length - 1 - EVALUATION.trendLookback]
      : undefined;

  return [...seen]
    .map((skill): SkillScore => {
      const score = scores.get(skill) ?? 0;
      const before = past?.get(skill) ?? 0;
      const delta = score - before;
      return {
        skill,
        score,
        status: skillStatus(score),
        trend:
          past && Math.abs(delta) >= EVALUATION.trendDelta ? (delta > 0 ? 'up' : 'down') : null,
        turnedStrong:
          past !== undefined && skillStatus(before) === 'weak' && skillStatus(score) === 'strong',
      };
    })
    .filter((item) => Math.abs(item.score) >= EVALUATION.skillMinimum)
    .toSorted((a, b) => Math.abs(b.score) - Math.abs(a.score));
}
