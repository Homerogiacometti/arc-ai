import { createContext, useContext } from 'react';

/** Reinicia o fluxo do app (onboarding ou home), ex.: depois de remover a chave ou apagar tudo. */
export const RestartContext = createContext<() => void>(() => undefined);

export function useRestart(): () => void {
  return useContext(RestartContext);
}
