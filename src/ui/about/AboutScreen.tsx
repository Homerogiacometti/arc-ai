import { ScreenHeader } from '../ScreenHeader';
import { InfoSection } from './InfoSection';
import { LanguagesSection } from './LanguagesSection';
import { MemorySection } from './MemorySection';

/**
 * Perfil e memória: idiomas com o nível de cada um (RF02, RF03), interesses e objetivos e o
 * que a IA lembra do usuário (RF11).
 */
export function AboutScreen() {
  return (
    <main className="screen">
      <ScreenHeader title="Perfil e memória" />
      <LanguagesSection />
      <InfoSection />
      <MemorySection />
    </main>
  );
}
