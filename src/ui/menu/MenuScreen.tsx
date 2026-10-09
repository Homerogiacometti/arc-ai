import { useNavigation, type Route } from '../navigation';
import { ScreenHeader } from '../ScreenHeader';

/** Itens do menu (SPEC §9). Idioma, modo, cronograma, memória e configurações chegam nos próximos marcos. */
const ITEMS: { label: string; route: Route }[] = [
  { label: 'Histórico', route: { name: 'history' } },
];

export function MenuScreen() {
  const navigate = useNavigation((state) => state.navigate);
  return (
    <main className="screen">
      <ScreenHeader title="Menu" />
      <nav>
        <ul className="list">
          {ITEMS.map((item) => (
            <li key={item.label}>
              <button
                className="list__item"
                type="button"
                onClick={() => {
                  navigate(item.route);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
