import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renderiza a tela inicial com o nome e o idioma atual', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Arc AI' })).toBeInTheDocument();
    expect(screen.getByLabelText('Idioma atual')).toHaveTextContent('Inglês');
  });
});
