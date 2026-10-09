import { useEffect } from 'react';
import { create } from 'zustand';
import type { LanguageCode } from '../config/languages';

export type Route =
  | { name: 'home' }
  | { name: 'menu' }
  | { name: 'history' }
  | { name: 'memory' }
  | { name: 'language' }
  | { name: 'profile'; languageCode: LanguageCode }
  | { name: 'response-mode' }
  | { name: 'settings' }
  | { name: 'api-key' }
  | { name: 'session'; id: number }
  | { name: 'feedback'; id: number };

interface NavigationState {
  route: Route;
  /** Abre uma tela nova (o botão voltar do Android volta para a anterior). */
  navigate: (route: Route) => void;
  back: () => void;
  /** Volta para a home descartando o histórico de telas. */
  home: () => void;
}

/**
 * Navegação sobre a History API do navegador: no Capacitor, o botão voltar do Android
 * chama `history.back()` enquanto houver histórico, então não precisa de plugin.
 */
export const useNavigation = create<NavigationState>()((set) => ({
  route: { name: 'home' },
  navigate: (route) => {
    window.history.pushState({ route, depth: currentDepth() + 1 }, '');
    set({ route });
  },
  back: () => {
    window.history.back();
  },
  home: () => {
    const depth = currentDepth();
    if (depth > 0) window.history.go(-depth);
    set({ route: { name: 'home' } });
  },
}));

function currentDepth(): number {
  return (window.history.state as { depth?: number } | null)?.depth ?? 0;
}

/** Liga o estado de navegação ao `popstate`. Montar uma vez, na raiz das telas. */
export function useHistorySync(): void {
  useEffect(() => {
    window.history.replaceState({ route: { name: 'home' }, depth: 0 }, '');
    useNavigation.setState({ route: { name: 'home' } });
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { route?: Route } | null;
      useNavigation.setState({ route: state?.route ?? { name: 'home' } });
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);
}
