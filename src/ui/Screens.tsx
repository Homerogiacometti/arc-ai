import { AboutScreen } from './about/AboutScreen';
import { EvaluationScreen } from './evaluation/EvaluationScreen';
import { FeedbackScreen } from './feedback/FeedbackScreen';
import { HistoryScreen } from './history/HistoryScreen';
import { SessionScreen } from './history/SessionScreen';
import { Home } from './home/Home';
import { MenuScreen } from './menu/MenuScreen';
import { useHistorySync, useNavigation } from './navigation';
import { ApiKeyStep } from './onboarding/ApiKeyStep';
import { PlanScreen } from './plan/PlanScreen';
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
    case 'about':
      return <AboutScreen />;
    case 'plan':
      return <PlanScreen />;
    case 'evaluation':
      return <EvaluationScreen />;
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
