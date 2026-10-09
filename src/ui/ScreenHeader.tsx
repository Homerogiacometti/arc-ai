import { useNavigation } from './navigation';

interface ScreenHeaderProps {
  title: string;
  /** Ação do botão de voltar; padrão: tela anterior. */
  onBack?: () => void;
  backLabel?: string;
}

export function ScreenHeader({ title, onBack, backLabel = 'Voltar' }: ScreenHeaderProps) {
  const back = useNavigation((state) => state.back);
  return (
    <header className="screen-header">
      <button className="screen-header__back" type="button" onClick={onBack ?? back}>
        ← {backLabel}
      </button>
      <h1 className="screen-header__title">{title}</h1>
    </header>
  );
}
