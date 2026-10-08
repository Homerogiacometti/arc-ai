import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Services } from '../../app/services';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { FakeInput, FakeOutput, FakeProvider } from '../../conversation/fakes';
import { SqlProfileRepository } from '../../storage/profile-repository';
import { SqlSettingsRepository } from '../../storage/settings-repository';
import { createTestDatabase } from '../../storage/test-database';
import { useSettingsStore } from '../../store/settings';
import { Home } from './Home';

async function setup(options: { apiKey?: string | null } = {}) {
  const db = await createTestDatabase();
  const provider = new FakeProvider();
  const screenLock = {
    keepAwake: vi.fn(() => Promise.resolve()),
    allowSleep: vi.fn(() => Promise.resolve()),
  };
  const services: Services = {
    apiKeyStore: {
      get: () => Promise.resolve(options.apiKey === undefined ? 'AIzaKEY' : options.apiKey),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    },
    profiles: new SqlProfileRepository(db),
    settings: new SqlSettingsRepository(db),
    validateApiKey: () => Promise.resolve({ ok: true }),
    conversation: {
      provider,
      createInput: () => new FakeInput(),
      createOutput: (onIdle) => new FakeOutput(onIdle),
    },
    screen: screenLock,
  };
  await services.profiles.save({
    languageCode: 'en-US',
    level: 'intermediate',
    interests: 'música',
    goals: '',
  });
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={services}>
      <Home />
    </ServicesContext>,
  );
  return { provider, screenLock };
}

describe('Home', () => {
  it('inicia a conversa com a instrução do perfil, mostra cronômetro e encerra', async () => {
    const user = userEvent.setup();
    const { provider, screenLock } = await setup();

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(await screen.findByRole('timer')).toHaveTextContent('00:00');
    expect(provider.current.options.apiKey).toBe('AIzaKEY');
    expect(provider.current.options.systemInstruction).toContain('Speak only English');
    expect(provider.current.options.systemInstruction).toContain('Interests: música');
    expect(provider.current.options.silenceDurationMs).toBe(1300);
    expect(screenLock.keepAwake).toHaveBeenCalled();

    act(() => {
      provider.current.events.onAudio(new Int16Array(10));
    });
    expect(screen.getByText('IA falando')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Parar' }));
    expect(await screen.findByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(provider.current.closed).toBe(true);
    expect(screenLock.allowSleep).toHaveBeenCalled();
  });

  it('explica quando não consegue iniciar', async () => {
    const user = userEvent.setup();
    const { provider } = await setup();
    provider.failNext = new Error('offline');

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique a internet');
  });

  it('pausa ao ir para segundo plano e retoma ao voltar', async () => {
    const user = userEvent.setup();
    const { provider } = await setup();
    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByRole('timer');
    act(() => {
      provider.current.events.onResumeHandle('h1');
    });

    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    await act(async () => {
      setHidden(true);
      await Promise.resolve();
    });
    expect(await screen.findByText('Pausada')).toBeInTheDocument();

    await act(async () => {
      setHidden(false);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(provider.connections).toHaveLength(2);
    });
    expect(provider.current.options.resumeHandle).toBe('h1');
    expect(screen.queryByText('Pausada')).not.toBeInTheDocument();
  });
});
