import { SAMPLE_FEEDBACK } from '../feedback/fixtures';
import type { Feedback } from '../feedback/schema';
import {
  EVALUATION,
  scoreSkills,
  sessionScore,
  skillEvidence,
  summarizeLevel,
  type EvaluatedSession,
} from './evaluation';

function feedback(
  cefr: Feedback['level']['cefr'],
  progress?: number,
  skills?: Feedback['skills'],
): Feedback {
  return {
    ...SAMPLE_FEEDBACK,
    mistakes: [],
    level: { cefr, progress, comment: 'ok' },
    skills,
  };
}

function sessions(list: Feedback[]): EvaluatedSession[] {
  return list.map((item, index) => ({ startedAt: new Date(2026, 9, index + 1), feedback: item }));
}

describe('sessionScore', () => {
  it('soma o índice CEFR e o progresso; feedback antigo conta como meio do nível', () => {
    expect(sessionScore(feedback('B1', 60))).toBeCloseTo(2.6);
    expect(sessionScore(feedback('A2'))).toBeCloseTo(1.5);
    expect(sessionScore(feedback('C2', 100))).toBeLessThan(6);
  });
});

describe('summarizeLevel', () => {
  it('devolve null sem conversas avaliadas', () => {
    expect(summarizeLevel([])).toBeNull();
  });

  it('usa a média das últimas conversas para o nível e a barra', () => {
    const summary = summarizeLevel(
      sessions([
        feedback('A1', 0), // fora da janela
        feedback('B1', 40),
        feedback('B1', 60),
        feedback('B1', 80),
        feedback('B2', 0),
        feedback('B1', 20),
      ]),
    );
    expect(summary?.level).toBe('B1');
    expect(summary?.next).toBe('B2');
    expect(summary?.score).toBeCloseTo(2.6);
    expect(summary?.progress).toBeCloseTo(0.6);
    expect(summary?.basedOn).toBe(EVALUATION.levelWindow);
    expect(summary?.sessions).toBe(6);
    expect(summary?.history).toHaveLength(6);
  });

  it('avisa quando a conversa mais recente faz a média subir de degrau', () => {
    const summary = summarizeLevel(sessions([feedback('B1', 90), feedback('B2', 30)]));
    expect(summary?.level).toBe('B2');
    expect(summary?.promotedTo).toBe('B2');
    const same = summarizeLevel(sessions([feedback('B1', 10), feedback('B1', 30)]));
    expect(same?.promotedTo).toBeNull();
  });

  it('no C2 a barra fica cheia e não há próximo nível', () => {
    const summary = summarizeLevel(sessions([feedback('C2', 10)]));
    expect(summary?.next).toBeNull();
    expect(summary?.progress).toBe(1);
  });
});

describe('skillEvidence', () => {
  it('usa as habilidades avaliadas; erro prevalece sobre acerto', () => {
    const evidence = skillEvidence(
      feedback('B1', 50, [
        { skill: 'past', evaluation: 'strong' },
        { skill: 'past', evaluation: 'weak' },
        { skill: 'articles', evaluation: 'strong' },
      ]),
    );
    expect(evidence.get('past')).toBe(-1);
    expect(evidence.get('articles')).toBe(1);
  });

  it('em feedback antigo, transforma as categorias dos erros em evidência fraca', () => {
    const evidence = skillEvidence({
      ...feedback('B1'),
      mistakes: [
        { original: 'a', correction: 'b', explanation: 'c', category: 'preposition' },
        { original: 'a', correction: 'b', explanation: 'c', category: 'grammar' },
      ],
    });
    expect([...evidence]).toEqual([['prepositions', -1]]);
  });
});

describe('scoreSkills', () => {
  const strong = (skill: 'past' | 'articles') => ({ skill, evaluation: 'strong' as const });
  const weak = (skill: 'past' | 'articles') => ({ skill, evaluation: 'weak' as const });

  it('classifica forte, fraco e em desenvolvimento pelo score acumulado', () => {
    const result = scoreSkills(
      sessions([
        feedback('B1', 50, [strong('articles'), weak('past')]),
        feedback('B1', 50, [strong('articles'), weak('past')]),
      ]),
    );
    expect(result.find((item) => item.skill === 'articles')?.status).toBe('strong');
    expect(result.find((item) => item.skill === 'past')?.status).toBe('weak');

    const once = scoreSkills(sessions([feedback('B1', 50, [strong('articles')])]));
    expect(once[0]?.status).toBe('developing');
  });

  it('o que parou de aparecer perde peso e some do mapa', () => {
    const list = [feedback('B1', 50, [weak('past')]), feedback('B1', 50, [weak('past')])];
    for (let index = 0; index < 15; index++) list.push(feedback('B1', 50, []));
    expect(scoreSkills(sessions(list))).toEqual([]);
  });

  it('mostra a evolução e destaca o fraco que virou forte', () => {
    const list = [
      feedback('B1', 50, [weak('past')]),
      feedback('B1', 50, [weak('past')]),
      feedback('B1', 50, [weak('past')]),
    ];
    for (let index = 0; index < 5; index++) list.push(feedback('B1', 50, [strong('past')]));
    const [past] = scoreSkills(sessions(list));
    expect(past?.status).toBe('strong');
    expect(past?.trend).toBe('up');
    expect(past?.turnedStrong).toBe(true);
  });

  it('sem conversas suficientes não mostra seta', () => {
    const [item] = scoreSkills(
      sessions([feedback('B1', 50, [weak('past')]), feedback('B1', 50, [weak('past')])]),
    );
    expect(item?.trend).toBeNull();
  });
});
