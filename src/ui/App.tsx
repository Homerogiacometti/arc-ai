import { useEffect, useState } from 'react';
import { createServices, type Services } from '../app/services';
import { ServicesContext } from '../app/services-context';
import { AppFlow } from './AppFlow';
import { Logo } from './Logo';
import { Splash } from './Splash';
import './theme.css';
import './ui.css';

interface AppProps {
  /** Monta as dependências do app; os testes passam versões falsas. */
  loadServices?: () => Promise<Services>;
}

export function App({ loadServices = createServices }: AppProps) {
  const [services, setServices] = useState<Services | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadServices().then(
      (loaded) => {
        if (!cancelled) setServices(loaded);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadServices]);

  if (failed) {
    return (
      <main className="screen screen--center">
        <Logo size="medium" />
        <p className="screen__text" role="alert">
          Não foi possível iniciar o app. Feche e abra de novo.
        </p>
      </main>
    );
  }
  if (!services) return <Splash />;

  return (
    <ServicesContext value={services}>
      <AppFlow />
    </ServicesContext>
  );
}
