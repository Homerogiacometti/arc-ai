import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { PAUSE_LEVELS } from '../../config/pause-levels';
import {
  SessionController,
  type SessionResult,
  type StartOptions,
} from '../../conversation/session-controller';
import { buildConversationInstruction, OPENING_CUE } from '../../prompts/conversation-instruction';
import { useSettingsStore } from '../../store/settings';

const RUNNING = new Set(['connecting', 'active', 'paused', 'resuming', 'ending']);

/** Liga o SessionController à UI: estado, cronômetro, pausa em segundo plano e tela ligada. */
export function useConversation() {
  const services = useServices();
  const settings = useSettingsStore();
  const [controller] = useState(() => new SessionController(services.conversation));
  const snapshot = useSyncExternalStore(controller.subscribe, () => controller.snapshot);
  const [result, setResult] = useState<SessionResult | null>(null);
  const running = RUNNING.has(snapshot.status);
  const elapsedMs = useElapsed(controller, running);

  // ADR-006: segundo plano pausa, primeiro plano retoma.
  useEffect(() => {
    const onVisibilityChange = () => {
      void (document.hidden ? controller.pause() : controller.resume());
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void controller.stop();
    };
  }, [controller]);

  useEffect(() => {
    void (running ? services.screen.keepAwake() : services.screen.allowSleep()).catch(() => {
      // Tela ligada é conveniência; falhar aqui não deve afetar a conversa.
    });
  }, [running, services.screen]);

  const loadOptions = useCallback(async (): Promise<StartOptions> => {
    const { languageCode, responseMode, pauseLevel } = settings;
    const [apiKey, profile] = await Promise.all([
      services.apiKeyStore.get(),
      services.profiles.get(languageCode),
    ]);
    const language = findLanguage(languageCode);
    if (!apiKey) throw new Error('Chave de API ausente');
    if (!profile || !language) throw new Error('Perfil do idioma ausente');
    return {
      apiKey,
      systemInstruction: buildConversationInstruction({ language, profile, responseMode }),
      silenceDurationMs: PAUSE_LEVELS[pauseLevel].silenceDurationMs,
      openingCue: OPENING_CUE,
    };
  }, [services, settings]);

  const start = useCallback(() => {
    setResult(null);
    void controller.start(loadOptions, setResult);
  }, [controller, loadOptions]);

  const stop = useCallback(() => {
    void controller.stop();
  }, [controller]);

  return { snapshot, running, elapsedMs, result, start, stop };
}

function useElapsed(controller: SessionController, running: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setElapsedMs(controller.elapsedMs());
    };
    tick();
    const id = setInterval(tick, 250);
    return () => {
      clearInterval(id);
    };
  }, [controller, running]);
  return running ? elapsedMs : 0;
}
