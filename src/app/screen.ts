import { KeepAwake } from '@capacitor-community/keep-awake';

/** Mantém a tela ligada durante a conversa (ADR-006). */
export interface Screen {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

export function createScreen(): Screen {
  return {
    keepAwake: async () => {
      if ((await KeepAwake.isSupported()).isSupported) await KeepAwake.keepAwake();
    },
    allowSleep: async () => {
      if ((await KeepAwake.isSupported()).isSupported) await KeepAwake.allowSleep();
    },
  };
}
