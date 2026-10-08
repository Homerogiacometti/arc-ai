export type Phase = 'api-key' | 'profile' | 'home';

/** Onboarding (RF01, RF02): primeiro a chave, depois o perfil do idioma atual. */
export function startPhase({
  hasApiKey,
  hasProfile,
}: {
  hasApiKey: boolean;
  hasProfile: boolean;
}): Phase {
  if (!hasApiKey) return 'api-key';
  if (!hasProfile) return 'profile';
  return 'home';
}
