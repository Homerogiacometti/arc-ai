import { lazy, Suspense, useState } from 'react';
import { findLanguage } from '../../config/languages';
import { useSettingsStore } from '../../store/settings';
import { Logo } from '../Logo';
import { Splash } from '../Splash';
import './Home.css';

const AudioPrototype = lazy(async () => ({
  default: (await import('../dev/AudioPrototype')).AudioPrototype,
}));

export function Home() {
  const languageCode = useSettingsStore((state) => state.languageCode);
  const languageLabel = findLanguage(languageCode)?.label ?? languageCode;
  const [prototype, setPrototype] = useState(false);

  if (prototype) {
    return (
      <Suspense fallback={<Splash />}>
        <AudioPrototype
          onExit={() => {
            setPrototype(false);
          }}
        />
      </Suspense>
    );
  }

  return (
    <main className="home">
      <header className="home__bar">
        <span className="home__language" aria-label="Idioma atual">
          {languageLabel}
        </span>
      </header>
      <section className="home__center">
        <h1 className="home__title">
          <Logo />
        </h1>
        <p className="home__subtitle">Conversação por voz em breve.</p>
        {/* Temporário (início do M3): acesso ao protótipo de áudio. */}
        <button
          className="home__dev"
          type="button"
          onClick={() => {
            setPrototype(true);
          }}
        >
          Protótipo de áudio
        </button>
      </section>
    </main>
  );
}
