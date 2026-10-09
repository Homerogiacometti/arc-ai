import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { Screens } from '../Screens';

async function setup() {
  const testServices = await createTestServices();
  await testServices.services.profiles.save({
    languageCode: 'en-US',
    level: 'intermediate',
    interests: 'música',
    goals: '',
  });
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={testServices.services}>
      <Screens />
    </ServicesContext>,
  );
  return testServices;
}

describe('Home', () => {
  it('inicia a conversa com a instrução do perfil, mostra cronômetro e encerra', async () => {
    const user = userEvent.setup();
    const { provider, screen: screenLock } = await setup();

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(await screen.findByRole('timer')).toHaveTextContent('00:00');
    expect(provider.current.options.apiKey).toBe('AIzaKEY');
    expect(provider.current.options.systemInstruction).toContain('Speak only English');
    expect(provider.current.options.systemInstruction).toContain('Interests: música');
    expect(provider.current.options.silenceDurationMs).toBe(1300);
    expect(screenLock.keepAwake).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();

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

  it('ao encerrar, salva a sessão, mostra o feedback e o histórico', async () => {
    const user = userEvent.setup();
    const { provider, services, generateJson } = await setup();

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByRole('timer');
    act(() => {
      provider.current.events.onTranscript('ai', 'How was your weekend?');
      provider.current.events.onTranscript('user', 'Yesterday I go to the beach');
    });
    await user.click(screen.getByRole('button', { name: 'Parar' }));

    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument();
    expect(await screen.findByText('Yesterday I went to the beach')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(generateJson).toHaveBeenCalledOnce();
    const [saved] = await services.sessions.list();
    expect(saved?.feedbackStatus).toBe('ready');

    await user.click(screen.getAllByRole('button', { name: /Fechar/ })[0] as HTMLElement);
    await user.click(await screen.findByRole('button', { name: 'Menu' }));
    await user.click(await screen.findByRole('button', { name: 'Histórico' }));
    await user.click(await screen.findByRole('button', { name: /Inglês · Equilibrada/ }));

    expect(await screen.findByRole('heading', { name: 'Sessão' })).toBeInTheDocument();
    expect(
      screen.getByText('Yesterday I go to the beach', { selector: 'p.transcript__text' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Yesterday I went to the beach')).toBeInTheDocument();
  });

  it('feedback que falhou pode ser gerado de novo', async () => {
    const user = userEvent.setup();
    const { provider, generateJson } = await setup();
    generateJson.mockRejectedValue(new Error('offline'));

    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByRole('timer');
    act(() => {
      provider.current.events.onTranscript('user', 'I like music a lot');
    });
    await user.click(screen.getByRole('button', { name: 'Parar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gerar o feedback');
    expect(generateJson).toHaveBeenCalledTimes(2);

    generateJson.mockReset();
    generateJson.mockResolvedValue(
      JSON.stringify((await import('../../feedback/fixtures')).SAMPLE_FEEDBACK),
    );
    await user.click(screen.getByRole('button', { name: 'Gerar feedback' }));
    expect(await screen.findByText('Yesterday I went to the beach')).toBeInTheDocument();
  });

  it('sessão sem fala do usuário não abre feedback', async () => {
    const user = userEvent.setup();
    const { provider, services } = await setup();
    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByRole('timer');
    act(() => {
      provider.current.events.onTranscript('ai', 'Hi there!');
    });
    await user.click(screen.getByRole('button', { name: 'Parar' }));
    expect(await screen.findByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Feedback' })).not.toBeInTheDocument();
    await vi.waitFor(async () => {
      expect(await services.sessions.list()).toHaveLength(1);
    });
  });
});
