import { FeedbackScreen } from './feedback/FeedbackScreen';
import { HistoryScreen } from './history/HistoryScreen';
import { SessionScreen } from './history/SessionScreen';
import { Home } from './home/Home';
import { MemoryScreen } from './memory/MemoryScreen';
import { MenuScreen } from './menu/MenuScreen';
import { useHistorySync, useNavigation } from './navigation';

/** Telas do app depois do onboarding. */
export function Screens() {
  useHistorySync();
  const route = useNavigation((state) => state.route);

  switch (route.name) {
    case 'home':
      return <Home />;
    case 'menu':
      return <MenuScreen />;
    case 'history':
      return <HistoryScreen />;
    case 'memory':
      return <MemoryScreen />;
    case 'session':
      return <SessionScreen key={route.id} sessionId={route.id} />;
    case 'feedback':
      return <FeedbackScreen key={route.id} sessionId={route.id} />;
  }
}
