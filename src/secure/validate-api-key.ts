const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1';

export type ApiKeyValidation =
  { ok: true } | { ok: false; reason: 'empty' | 'invalid' | 'network' | 'unexpected' };

/** Remove espaços e quebras de linha que costumam vir junto ao colar. */
export function normalizeApiKey(raw: string): string {
  return raw.replace(/\s+/g, '');
}

/**
 * Valida a chave listando os modelos (chamada leve, sem custo de geração).
 * A chave vai no cabeçalho, não na URL, e nunca é registrada em log.
 */
export async function validateApiKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiKeyValidation> {
  if (!apiKey) return { ok: false, reason: 'empty' };

  let response: Response;
  try {
    response = await fetchFn(MODELS_ENDPOINT, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  // 429 = cota estourada, mas a chave foi autenticada.
  if (response.ok || response.status === 429) return { ok: true };
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: false, reason: 'unexpected' };
}

export const API_KEY_ERROR_MESSAGES: Record<
  Exclude<ApiKeyValidation, { ok: true }>['reason'],
  string
> = {
  empty: 'Cole a sua chave de API.',
  invalid: 'O Google não aceitou essa chave. Confira se você copiou a chave inteira.',
  network: 'Não foi possível falar com o Google. Verifique a internet e tente de novo.',
  unexpected: 'O Google respondeu com um erro inesperado. Tente de novo em instantes.',
};
