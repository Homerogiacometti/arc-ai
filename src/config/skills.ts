/**
 * Habilidades avaliadas em cada feedback (M9.1): a mesma lista para todos os idiomas. O mapa
 * de pontos fortes e fracos da Avaliação soma essas avaliações ao longo das conversas.
 */
export const SKILLS = {
  articles: 'Artigos',
  nouns: 'Substantivos e plural',
  pronouns: 'Pronomes',
  prepositions: 'Preposições',
  present: 'Presente',
  past: 'Passado',
  future: 'Futuro',
  conditional: 'Condicional e hipóteses',
  'irregular-verbs': 'Verbos irregulares',
  agreement: 'Concordância',
  'word-order': 'Ordem das palavras',
  questions: 'Perguntas',
  negation: 'Negação',
  connectors: 'Conectivos',
  comparisons: 'Comparações',
  vocabulary: 'Vocabulário',
  expressions: 'Expressões',
  fluency: 'Fluência',
} as const;

export type Skill = keyof typeof SKILLS;

export const SKILL_KEYS = Object.keys(SKILLS) as [Skill, ...Skill[]];
