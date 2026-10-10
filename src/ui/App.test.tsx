import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS } from '../config/settings';
import { useSettingsStore } from '../store/settings';
import { createTestServices } from '../test/services';
import { App } from './App';

beforeEach(() => {
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
});

describe('App', () => {
  it('conduz o onboarding: chave inválida, chave válida, perfil e home', async () => {
    const user = userEvent.setup();
    const { services, apiKeyStore, validateApiKey } = await createTestServices({ apiKey: null });
    validateApiKey.mockImplementation((apiKey) =>
      Promise.resolve(apiKey === 'AIzaGOOD' ? { ok: true } : { ok: false, reason: 'invalid' }),
    );
    render(<App loadServices={() => Promise.resolve(services)} />);

    const keyInput = await screen.findByLabelText('Chave de API');
    await user.type(keyInput, 'AIzaBAD');
    await user.click(screen.getByRole('button', { name: 'Validar e salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O Google não aceitou essa chave');
    expect(apiKeyStore.value).toBeNull();

    await user.clear(keyInput);
    await user.type(keyInput, ' AIzaGOOD ');
    await user.click(screen.getByRole('button', { name: 'Validar e salvar' }));

    expect(await screen.findByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument();
    expect(apiKeyStore.value).toBe('AIzaGOOD');
    expect(screen.queryByDisplayValue(/AIza/)).not.toBeInTheDocument();

    const start = screen.getByRole('button', { name: 'Começar' });
    expect(start).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Idioma que você quer praticar'), 'es-ES');
    await user.click(screen.getByLabelText('Avançado'));
    await user.type(screen.getByLabelText('Interesses (opcional)'), 'música');
    await user.click(start);

    expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Espanhol');
    expect(await services.profiles.get('es-ES')).toEqual({
      languageCode: 'es-ES',
      level: 'advanced',
    });
    expect(await services.learnerInfo.get()).toEqual({ interests: 'música', goals: '' });
    expect((await services.settings.get()).languageCode).toBe('es-ES');
  });

  it('vai direto para a home quando já há chave e perfil', async () => {
    const { services } = await createTestServices();
    await services.settings.update({ languageCode: 'fr-FR' });
    await services.profiles.save({
      languageCode: 'fr-FR',
      level: 'beginner',
    });

    render(<App loadServices={() => Promise.resolve(services)} />);
    expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Francês');
    expect(screen.getByRole('img', { name: 'Arc AI' })).toBeInTheDocument();
  });

  it('pede só o perfil quando a chave já existe', async () => {
    const { services } = await createTestServices();
    render(<App loadServices={() => Promise.resolve(services)} />);
    expect(await screen.findByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument();
  });

  it('mostra erro quando o app não consegue iniciar', async () => {
    render(<App loadServices={() => Promise.reject(new Error('sqlite'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar');
  });
});
