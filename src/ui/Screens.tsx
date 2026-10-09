import { FeedbackScreen } from './feedback/FeedbackScreen';
import { LanguageScreen } from './language/LanguageScreen';
import { ProfileScreen } from './language/ProfileScreen';
import { HistoryScreen } from './history/HistoryScreen';
import { SessionScreen } from './history/SessionScreen';
import { Home } from './home/Home';
import { MemoryScreen } from './memory/MemoryScreen';
import { MenuScreen } from './menu/MenuScreen';
import { useHistorySync, useNavigation } from './navigation';
import { ApiKeyStep } from './onboarding/ApiKeyStep';
import { ResponseModeScreen } from './response-mode/ResponseModeScreen';
import { SettingsScreen } from './settings/SettingsScreen';

/** Telas do app depois do onboarding. */
export function Screens() {
  useHistorySync();
  const route = useNavigation((state) => state.route);
  const back = useNavigation((state) => state.back);

  switch (route.name) {
    case 'home':
      return <Home />;
    case 'menu':
      return <MenuScreen />;
    case 'history':
      return <HistoryScreen />;
    case 'memory':
      return <MemoryScreen />;
    case 'language':
      return <LanguageScreen />;
    case 'profile':
      return <ProfileScreen key={route.languageCode} languageCode={route.languageCode} />;
    case 'response-mode':
      return <ResponseModeScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'api-key':
      return <ApiKeyStep variant="settings" onSaved={back} />;
    case 'session':
      return <SessionScreen key={route.id} sessionId={route.id} />;
    case 'feedback':
      return <FeedbackScreen key={route.id} sessionId={route.id} />;
  }
}
