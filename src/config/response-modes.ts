/** Modo de resposta (RF06), aplicado pela instrução de sistema a partir da próxima sessão. */
export const RESPONSE_MODES = {
  verbose: { label: 'Verbosa', description: 'Respostas completas e longas' },
  balanced: { label: 'Equilibrada', description: 'Respostas de tamanho médio' },
  quick: { label: 'Rápida', description: 'Respostas curtas e diretas (mais econômico)' },
} as const satisfies Record<string, { label: string; description: string }>;

export type ResponseMode = keyof typeof RESPONSE_MODES;

export const DEFAULT_RESPONSE_MODE: ResponseMode = 'balanced';
