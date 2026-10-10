import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { recordSession } from '../../app/session-records';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import { PAUSE_LEVELS } from '../../config/pause-levels';
import {
  SessionController,
  type SessionResult,
  type StartOptions,
} from '../../conversation/session-controller';
import {
  buildConversationInstruction,
  buildRecapCue,
  OPENING_CUE,
  SILENCE_CUE,
} from '../../prompts/conversation-instruction';
import { hasUserSpeech } from '../../feedback/generate-feedback';
import type { Settings } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { useNavigation } from '../navigation';

const RUNNING = new Set(['connecting', 'active', 'paused', 'resuming', 'reconnecting', 'ending']);

/** Liga o SessionController à UI: estado, cronômetro, pausa em segundo plano e tela ligada. */
export function useConversation() {
  const services = useServices();
  const settings = useSettingsStore();
  const [controller] = useState(() => new SessionController(services.conversation));
  const snapshot = useSyncExternalStore(controller.subscribe, () => controller.snapshot);
  const [result, setResult] = useState<SessionResult | null>(null);
  const navigate = useNavigation((state) => state.navigate);
  /** Idioma e modo com que a sessão começou (o usuário pode mudá-los depois). */
  const startedWith = useRef<Pick<Settings, 'languageCode' | 'responseMode'> | null>(null);
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
    const { languageCode, responseMode, pauseLevel, voice } = settings;
    const [apiKey, profile, info, memory] = await Promise.all([
      services.apiKeyStore.get(),
      services.profiles.get(languageCode),
      services.learnerInfo.get(),
      services.memory.forLanguage(languageCode),
    ]);
    const language = findLanguage(languageCode);
    if (!apiKey) throw new Error('Chave de API ausente');
    if (!profile || !language) throw new Error('Perfil do idioma ausente');
    startedWith.current = { languageCode, responseMode };
    return {
      apiKey,
      systemInstruction: buildConversationInstruction({
        language,
        profile,
        info,
        responseMode,
        memory,
      }),
      silenceDurationMs: PAUSE_LEVELS[pauseLevel].silenceDurationMs,
      voiceName: voice,
      openingCue: OPENING_CUE,
      silenceCue: SILENCE_CUE,
      recapCue: buildRecapCue,
    };
  }, [services, settings]);

  /** Ao encerrar: salva a sessão e abre o feedback automaticamente (RF10). */
  const onEnded = useCallback(
    async (ended: SessionResult) => {
      setResult(ended);
      if (!startedWith.current) return;
      try {
        const id = await recordSession(services, ended, startedWith.current);
        if (id !== null && hasUserSpeech(ended.transcript)) navigate({ name: 'feedback', id });
      } catch {
        // Falha ao salvar não pode travar a home; a mensagem de duração continua visível.
      }
    },
    [services, navigate],
  );

  const start = useCallback(() => {
    setResult(null);
    startedWith.current = null;
    void controller.start(loadOptions, (ended) => void onEnded(ended));
  }, [controller, loadOptions, onEnded]);

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
