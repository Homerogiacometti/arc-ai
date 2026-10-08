import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Services } from '../app/services';
import type { ApiKeyValidation } from '../secure/validate-api-key';
import { SqlProfileRepository } from '../storage/profile-repository';
import { SqlSettingsRepository } from '../storage/settings-repository';
import { createTestDatabase } from '../storage/test-database';
import { useSettingsStore } from '../store/settings';
import { DEFAULT_SETTINGS } from '../config/settings';
import { FakeInput, FakeOutput, FakeProvider } from '../conversation/fakes';
import { App } from './App';

class MemoryApiKeyStore {
  value: string | null = null;
  get = () => Promise.resolve(this.value);
  set = (apiKey: string) => {
    this.value = apiKey;
    return Promise.resolve();
  };
  remove = () => {
    this.value = null;
    return Promise.resolve();
  };
}

async function setup(validation: ApiKeyValidation = { ok: true }) {
  const db = await createTestDatabase();
  const apiKeyStore = new MemoryApiKeyStore();
  const validateApiKey = vi.fn((apiKey: string) =>
    Promise.resolve(apiKey === 'AIzaGOOD' ? { ok: true as const } : validation),
  );
  const services: Services = {
    apiKeyStore,
    profiles: new SqlProfileRepository(db),
    settings: new SqlSettingsRepository(db),
    validateApiKey,
    conversation: {
      provider: new FakeProvider(),
      createInput: () => new FakeInput(),
      createOutput: (onIdle) => new FakeOutput(onIdle),
    },
    screen: { keepAwake: () => Promise.resolve(), allowSleep: () => Promise.resolve() },
  };
  const loadServices = () => Promise.resolve(services);
  return { services, apiKeyStore, validateApiKey, loadServices };
}

beforeEach(() => {
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
});

describe('App', () => {
  it('conduz o onboarding: chave inválida, chave válida, perfil e home', async () => {
    const user = userEvent.setup();
    const { apiKeyStore, loadServices, services } = await setup({ ok: false, reason: 'invalid' });
    render(<App loadServices={loadServices} />);

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
      interests: 'música',
      goals: '',
    });
    expect((await services.settings.get()).languageCode).toBe('es-ES');
  });

  it('vai direto para a home quando já há chave e perfil', async () => {
    const { apiKeyStore, loadServices, services } = await setup();
    apiKeyStore.value = 'AIzaGOOD';
    await services.settings.update({ languageCode: 'fr-FR' });
    await services.profiles.save({
      languageCode: 'fr-FR',
      level: 'beginner',
      interests: '',
      goals: '',
    });

    render(<App loadServices={loadServices} />);
    expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Francês');
    expect(screen.getByRole('img', { name: 'Arc AI' })).toBeInTheDocument();
  });

  it('pede só o perfil quando a chave já existe', async () => {
    const { apiKeyStore, loadServices } = await setup();
    apiKeyStore.value = 'AIzaGOOD';
    render(<App loadServices={loadServices} />);
    expect(await screen.findByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument();
  });

  it('mostra erro quando o app não consegue iniciar', async () => {
    render(<App loadServices={() => Promise.reject(new Error('sqlite'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar');
  });
});
