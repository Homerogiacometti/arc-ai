import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';

describe('Logo', () => {
  it('escreve "Arc" em amarelo e "AI" em vermelho', () => {
    render(<Logo />);
    const logo = screen.getByRole('img', { name: 'Arc AI' });
    expect(logo).toHaveTextContent('Arc AI');
    expect(logo.querySelector('.logo__arc')).toHaveTextContent(/^Arc$/);
    expect(logo.querySelector('.logo__ai')).toHaveTextContent(/^AI$/);
  });
});
