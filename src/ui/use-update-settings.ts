import { useCallback } from 'react';
import { useServices } from '../app/services-context';
import type { Settings } from '../config/settings';
import { useSettingsStore } from '../store/settings';

/** Grava a alteração no banco e atualiza o espelho em memória. Vale a partir da próxima sessão. */
export function useUpdateSettings(): (changes: Partial<Settings>) => Promise<void> {
  const { settings } = useServices();
  const replace = useSettingsStore((state) => state.replace);
  return useCallback(
    async (changes) => {
      replace(await settings.update(changes));
    },
    [settings, replace],
  );
}
