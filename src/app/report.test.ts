import { buildReportMailto } from './report';

const detail = { id: 7, startedAt: new Date('2026-10-08T10:00:00Z'), languageCode: 'en-US' };

describe('buildReportMailto', () => {
  it('abre e-mail para o desenvolvedor com motivo, comentário e trecho', () => {
    const url = buildReportMailto({
      detail,
      excerpt: 'Something inappropriate',
      reason: 'offensive',
      comment: 'Muito grosseira',
    });
    expect(url.startsWith('mailto:contato@arctechnologies.co?subject=')).toBe(true);
    const body = decodeURIComponent(new URL(url).searchParams.get('body') ?? '');
    expect(body).toContain('Motivo: Ofensiva ou com discurso de ódio');
    expect(body).toContain('Comentário: Muito grosseira');
    expect(body).toContain('"Something inappropriate"');
    expect(body).toContain('Sessão 7 · 2026-10-08T10:00:00.000Z · Inglês');
  });

  it('omite o comentário vazio e corta trechos longos', () => {
    const url = buildReportMailto({
      detail,
      excerpt: 'x'.repeat(5_000),
      reason: 'other',
      comment: ' ',
    });
    const body = new URL(url).searchParams.get('body') ?? '';
    expect(body).not.toContain('Comentário');
    expect(body).toContain(`${'x'.repeat(1_000)}…`);
    expect(body).not.toContain('x'.repeat(1_001));
  });
});
