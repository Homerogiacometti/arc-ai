import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { App } from '../App';

async function setup() {
  const user = userEvent.setup();
  const testServices = await createTestServices();
  await testServices.services.profiles.save({
    languageCode: 'en-US',
    level: 'intermediate',
  });
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(<App loadServices={() => Promise.resolve(testServices.services)} />);
  await screen.findByLabelText('Idioma atual');
  return { user, ...testServices };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(await screen.findByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: item }));
}

async function startConversation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Iniciar' }));
  await screen.findByRole('timer');
}

describe('Configurações', () => {
  it('modo de resposta vale a partir da próxima conversa', async () => {
    const { user, services, provider } = await setup();
    await openMenu(user, 'Configurações');
    expect(await screen.findByText(/a IA fala mais e você fala menos/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Equilibrada/)).toBeChecked();

    await user.click(screen.getByLabelText(/^Rápida/));
    expect((await services.settings.get()).responseMode).toBe('quick');

    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await startConversation(user);
    expect(provider.current.options.systemInstruction).toContain('one or two sentences');
  });

  it('estilo de conversa e instruções livres entram na próxima conversa', async () => {
    const { user, services, provider } = await setup();
    await openMenu(user, 'Configurações');
    expect(await screen.findByLabelText(/^Bate-papo/)).toBeChecked();

    await user.click(screen.getByLabelText(/^Entrevistador/));
    await user.type(
      screen.getByLabelText('Instruções para a IA (opcional)'),
      'Me chame de Ho e fale de tecnologia',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar instruções' }));
    expect(await screen.findByText('Salvo.')).toBeInTheDocument();
    expect(await services.settings.get()).toMatchObject({
      conversationStyle: 'interviewer',
      customInstructions: 'Me chame de Ho e fale de tecnologia',
    });

    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await startConversation(user);
    const instruction = provider.current.options.systemInstruction;
    expect(instruction).toContain('always end your turn with a question');
    expect(instruction).toContain('USER PREFERENCES');
    expect(instruction).toContain('Me chame de Ho e fale de tecnologia');
  });

  it('aparência troca o tema na hora e fica salva', async () => {
    const { user, services } = await setup();
    await openMenu(user, 'Configurações');
    expect(await screen.findByLabelText('Escuro')).toBeChecked();

    await user.click(screen.getByLabelText('Claro'));
    expect((await services.settings.get()).theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('arc-theme')).toBe('light');

    await user.click(screen.getByLabelText('Escuro'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('não tem mais a seção de memória', async () => {
    const { user } = await setup();
    await openMenu(user, 'Configurações');
    await screen.findByRole('heading', { name: 'Configurações' });
    expect(screen.queryByRole('button', { name: 'Ver memória' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apagar toda a memória' })).not.toBeInTheDocument();
  });

  it('voz e tolerância a pausas vão para a próxima conversa', async () => {
    const { user, services, provider } = await setup();
    await openMenu(user, 'Configurações');

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Voz da IA' }), 'Kore');
    await user.click(screen.getByLabelText(/^Longa/));
    expect(await services.settings.get()).toMatchObject({ voice: 'Kore', pauseLevel: 'long' });

    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await startConversation(user);
    expect(provider.current.options).toMatchObject({
      voiceName: 'Kore',
      silenceDurationMs: 2000,
    });
  });

  it('troca a chave validando antes de salvar', async () => {
    const { user, apiKeyStore, validateApiKey } = await setup();
    validateApiKey.mockImplementation((apiKey) =>
      Promise.resolve(apiKey === 'AIzaNEW' ? { ok: true } : { ok: false, reason: 'invalid' }),
    );
    await openMenu(user, 'Configurações');
    await user.click(await screen.findByRole('button', { name: 'Trocar chave' }));

    const input = await screen.findByLabelText('Chave de API');
    await user.type(input, 'AIzaBAD');
    await user.click(screen.getByRole('button', { name: 'Validar e salvar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(apiKeyStore.value).toBe('AIzaKEY');

    await user.clear(input);
    await user.type(input, 'AIzaNEW');
    await user.click(screen.getByRole('button', { name: 'Validar e salvar' }));
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(apiKeyStore.value).toBe('AIzaNEW');
  });

  it('remover a chave volta para o passo da chave, sem perder o perfil', async () => {
    const { user, apiKeyStore } = await setup();
    await openMenu(user, 'Configurações');
    await user.click(await screen.findByRole('button', { name: 'Remover chave' }));
    await user.click(screen.getByRole('button', { name: 'Remover' }));

    expect(await screen.findByRole('heading', { name: 'Sua chave do Gemini' })).toBeInTheDocument();
    expect(apiKeyStore.value).toBeNull();
    await user.type(screen.getByLabelText('Chave de API'), 'AIzaOTHER');
    await user.click(screen.getByRole('button', { name: 'Validar e salvar' }));
    expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Inglês');
  });

  it('apagar todos os dados limpa o banco e a chave e volta ao onboarding', async () => {
    const { user, services, apiKeyStore } = await setup();
    await services.memory.replace('en-US', {
      personal: ['Mora em Recife'],
      mistakes: [],
      strengths: [],
    });
    await services.settings.update({ voice: 'Kore' });
    await openMenu(user, 'Configurações');

    const section = (await screen.findByRole('heading', { name: 'Apagar todos os dados' }))
      .parentElement as HTMLElement;
    await user.click(within(section).getByRole('button', { name: 'Apagar todos os dados' }));
    await user.click(screen.getByRole('button', { name: 'Apagar tudo' }));

    expect(await screen.findByRole('heading', { name: 'Sua chave do Gemini' })).toBeInTheDocument();
    expect(apiKeyStore.value).toBeNull();
    expect(await services.profiles.list()).toEqual([]);
    expect(await services.memory.list()).toEqual([]);
    expect(await services.settings.get()).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().voice).toBe(DEFAULT_SETTINGS.voice);
  });

  describe('Backup', () => {
    it('exporta um arquivo JSON sem a chave', async () => {
      const { user, services, device } = await setup();
      await services.memory.replace('en-US', {
        personal: ['Mora em Recife'],
        mistakes: [],
        strengths: [],
      });
      await openMenu(user, 'Configurações');
      await user.click(await screen.findByRole('button', { name: 'Exportar backup' }));

      expect(await screen.findByRole('status')).toHaveTextContent('Backup gerado.');
      const [fileName, text] = device.shareFile.mock.calls[0] ?? [];
      expect(fileName).toMatch(/^arc-ai-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(text).toContain('Mora em Recife');
      expect(text).not.toContain('AIza');
    });

    it('importa com confirmação, substitui os dados e mantém a chave', async () => {
      const { user, services, apiKeyStore } = await setup();
      const backup = await services.backup.export();
      await services.memory.replace('en-US', {
        personal: ['Será apagado'],
        mistakes: [],
        strengths: [],
      });
      await openMenu(user, 'Configurações');
      await screen.findByRole('button', { name: 'Importar backup' });

      const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
      await user.upload(screen.getByLabelText('Arquivo de backup'), file);
      expect(await screen.findByRole('group', { name: 'Confirmar importação' })).toHaveTextContent(
        '(0 conversas)',
      );
      await user.click(screen.getByRole('button', { name: 'Substituir' }));

      expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Inglês');
      expect(await services.memory.list()).toEqual([]);
      expect(apiKeyStore.value).toBe('AIzaKEY');
    });

    it('avisa quando o arquivo não é um backup', async () => {
      const { user } = await setup();
      await openMenu(user, 'Configurações');
      await screen.findByRole('button', { name: 'Importar backup' });
      await user.upload(
        screen.getByLabelText('Arquivo de backup'),
        new File(['{"oi": 1}'], 'x.json', { type: 'application/json' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('não é um backup do Arc AI');
    });
  });
});
