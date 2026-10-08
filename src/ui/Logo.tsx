import './Logo.css';

interface LogoProps {
  size?: 'medium' | 'large';
}

/** Nome do app: "Arc" em amarelo e "AI" em vermelho (SPEC §9.1). */
export function Logo({ size = 'large' }: LogoProps) {
  return (
    <span className={`logo logo--${size}`} role="img" aria-label="Arc AI">
      <span className="logo__arc">Arc</span> <span className="logo__ai">AI</span>
    </span>
  );
}
