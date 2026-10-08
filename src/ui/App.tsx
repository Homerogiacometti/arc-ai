import { findLanguage } from '../config/languages';
import { useSettingsStore } from '../store/settings';
import './App.css';

export function App() {
  const languageCode = useSettingsStore((state) => state.languageCode);
  const languageLabel = findLanguage(languageCode)?.label ?? languageCode;

  return (
    <main className="home">
      <header className="home__bar">
        <span className="home__language" aria-label="Idioma atual">
          {languageLabel}
        </span>
      </header>
      <section className="home__center">
        <h1 className="home__title">Arc AI</h1>
        <p className="home__subtitle">Conversação por voz em breve.</p>
      </section>
    </main>
  );
}
