import { LanguageFlags } from './LanguageFlags';
import { useNavigation } from './navigation';

interface ScreenHeaderProps {
  title: string;
  /** Ação do botão de voltar; padrão: tela anterior. */
  onBack?: () => void;
  backLabel?: string;
  /** Mostra as bandeiras para trocar o idioma: a tela mostra só os dados do idioma atual. */
  languageSwitch?: boolean;
}

export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Voltar',
  languageSwitch = false,
}: ScreenHeaderProps) {
  const back = useNavigation((state) => state.back);
  const heading = <h1 className="screen-header__title">{title}</h1>;
  return (
    <header className="screen-header">
      <button className="screen-header__back" type="button" onClick={onBack ?? back}>
        ← {backLabel}
      </button>
      {languageSwitch ? (
        <div className="screen-header__row">
          {heading}
          <LanguageFlags />
        </div>
      ) : (
        heading
      )}
    </header>
  );
}
