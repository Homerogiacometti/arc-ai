import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../app/services-context';
import { startPhase, type Phase } from '../app/start-phase';
import { useSettingsStore } from '../store/settings';
import { RestartContext } from './app-flow';
import { ApiKeyStep } from './onboarding/ApiKeyStep';
import { ProfileStep } from './onboarding/ProfileStep';
import { Screens } from './Screens';
import { Splash } from './Splash';
import { useApplyTheme } from './use-theme';

export function AppFlow() {
  const services = useServices();
  const replaceSettings = useSettingsStore((state) => state.replace);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [generation, setGeneration] = useState(0);
  useApplyTheme(phase !== null);
  const restart = useCallback(() => {
    setPhase(null);
    setGeneration((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const [apiKey, settings] = await Promise.all([
        services.apiKeyStore.get(),
        services.settings.get(),
      ]);
      const profile = await services.profiles.get(settings.languageCode);
      if (controller.signal.aborted) return;
      replaceSettings(settings);
      setHasProfile(profile !== null);
      setPhase(startPhase({ hasApiKey: apiKey !== null, hasProfile: profile !== null }));
    })();
    return () => {
      controller.abort();
    };
  }, [services, replaceSettings, generation]);

  switch (phase) {
    case null:
      return <Splash />;
    case 'api-key':
      return (
        <ApiKeyStep
          onSaved={() => {
            setPhase(startPhase({ hasApiKey: true, hasProfile }));
          }}
        />
      );
    case 'profile':
      return (
        <ProfileStep
          onSaved={() => {
            setHasProfile(true);
            setPhase('home');
          }}
        />
      );
    case 'home':
      return (
        <RestartContext value={restart}>
          <Screens />
        </RestartContext>
      );
  }
}
