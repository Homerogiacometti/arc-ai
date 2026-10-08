import { normalizeApiKey, validateApiKey } from './validate-api-key';

const respond = (status: number) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }));

describe('validateApiKey', () => {
  it('recusa chave vazia sem chamar a rede', async () => {
    const fetchFn = respond(200);
    expect(await validateApiKey('', fetchFn)).toEqual({ ok: false, reason: 'empty' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('envia a chave no cabeçalho e não na URL', async () => {
    const fetchFn = respond(200);
    expect(await validateApiKey('AIzaSECRET', fetchFn)).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toEqual(expect.not.stringContaining('AIzaSECRET'));
    expect(init?.headers).toEqual({ 'x-goog-api-key': 'AIzaSECRET' });
  });

  it.each([400, 401, 403])('trata %i como chave inválida', async (status) => {
    expect(await validateApiKey('k', respond(status))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('aceita a chave quando a cota estourou (429)', async () => {
    expect(await validateApiKey('k', respond(429))).toEqual({ ok: true });
  });

  it('distingue falha de rede de erro inesperado', async () => {
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await validateApiKey('k', offline)).toEqual({ ok: false, reason: 'network' });
    expect(await validateApiKey('k', respond(500))).toEqual({ ok: false, reason: 'unexpected' });
  });
});

describe('normalizeApiKey', () => {
  it('remove espaços e quebras de linha colados junto', () => {
    expect(normalizeApiKey('  AIza abc\n123 ')).toBe('AIzaabc123');
  });
});
