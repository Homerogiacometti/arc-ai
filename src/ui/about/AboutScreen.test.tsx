import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { Screens } from '../Screens';

type TestServices = Awaited<ReturnType<typeof createTestServices>>['services'];

async function openAbout(
  fill: (services: TestServices) => Promise<void> = () => Promise.resolve(),
) {
  const user = userEvent.setup();
  const testServices = await createTestServices();
  const { services } = testServices;
  await services.profiles.save({ languageCode: 'en-US', level: 'intermediate' });
  await fill(services);
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={services}>
      <Screens />
    </ServicesContext>,
  );
  await user.click(await screen.findByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: 'Perfil e memória' }));
  await screen.findByRole('combobox', { name: 'Praticando agora' });
  return { user, ...testServices };
}

describe('Perfil e memória: idiomas', () => {
  it('adiciona um idioma com nível e passa a praticá-lo pela lista suspensa', async () => {
    const { user, services, provider } = await openAbout();

    const add = screen.getByRole('button', { name: 'Adicionar' });
    expect(add).toBeDisabled();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Idioma para adicionar' }),
      'es-ES',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Seu nível no idioma novo' }),
      'advanced',
    );
    await user.click(add);

    expect(await screen.findByRole('combobox', { name: 'Nível em Espanhol' })).toHaveValue(
      'advanced',
    );
    expect(await services.profiles.get('es-ES')).toEqual({
      languageCode: 'es-ES',
      level: 'advanced',
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Praticando agora' }), 'es-ES');
    expect((await services.settings.get()).languageCode).toBe('es-ES');

    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    expect(await screen.findByLabelText('Idioma atual')).toHaveTextContent('Espanhol');
    await user.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByRole('timer');
    expect(provider.current.options.systemInstruction).toContain('Speak only Español');
  });

  it('muda o nível de cada idioma e remove um idioma que não é o atual', async () => {
    const { user, services } = await openAbout((s) =>
      s.profiles.save({ languageCode: 'fr-FR', level: 'beginner' }),
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nível em Inglês' }), 'advanced');
    expect((await services.profiles.get('en-US'))?.level).toBe('advanced');

    expect(screen.queryByRole('button', { name: 'Remover Inglês' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover Francês' }));
    expect(await screen.findByRole('combobox', { name: 'Nível em Inglês' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Nível em Francês' })).not.toBeInTheDocument();
    expect(await services.profiles.get('fr-FR')).toBeNull();
  });
});

describe('Perfil e memória: interesses e objetivos', () => {
  it('salva para todos os idiomas e entra na conversa', async () => {
    const { user, services } = await openAbout((s) =>
      s.learnerInfo.save({ interests: 'música', goals: '' }),
    );

    const interests = await screen.findByLabelText('Interesses (opcional)');
    expect(interests).toHaveValue('música');
    await user.type(screen.getByLabelText('Objetivos (opcional)'), 'viajar');
    await user.click(screen.getByRole('button', { name: 'Salvar interesses e objetivos' }));

    expect(await screen.findByText('Salvo.')).toBeInTheDocument();
    expect(await services.learnerInfo.get()).toEqual({ interests: 'música', goals: 'viajar' });
  });
});

describe('Perfil e memória: memória', () => {
  it('explica quando a memória está vazia', async () => {
    await openAbout();
    expect(await screen.findByText(/A memória ainda está vazia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apagar toda a memória' })).not.toBeInTheDocument();
  });

  it('mostra os itens por grupo e idioma e apaga um item', async () => {
    const { user, services } = await openAbout(async (s) => {
      await s.memory.replace('en-US', {
        personal: ['Trabalha como engenheiro', 'Tem um cachorro chamado Thor'],
        mistakes: ['Usa presente no lugar do passado'],
        strengths: [],
      });
      await s.memory.replace('es-ES', {
        personal: ['Trabalha como engenheiro', 'Tem um cachorro chamado Thor'],
        mistakes: [],
        strengths: ['Usa bem o pretérito'],
      });
    });

    const personal = await screen.findByRole('region', { name: 'Sobre você' });
    expect(within(personal).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Erros frequentes · Inglês' })).toHaveTextContent(
      'Usa presente no lugar do passado',
    );
    expect(screen.getByRole('region', { name: 'Pontos fortes · Espanhol' })).toHaveTextContent(
      'Usa bem o pretérito',
    );

    await user.click(screen.getByRole('button', { name: 'Apagar: Tem um cachorro chamado Thor' }));
    expect(await screen.findByText('Trabalha como engenheiro')).toBeInTheDocument();
    expect(screen.queryByText('Tem um cachorro chamado Thor')).not.toBeInTheDocument();
    expect((await services.memory.forLanguage('es-ES')).personal).toEqual([
      'Trabalha como engenheiro',
    ]);
  });

  it('apagar toda a memória pede confirmação', async () => {
    const { user, services } = await openAbout((s) =>
      s.memory.replace('en-US', { personal: ['Mora em Recife'], mistakes: [], strengths: [] }),
    );

    await user.click(await screen.findByRole('button', { name: 'Apagar toda a memória' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await services.memory.list()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Apagar toda a memória' }));
    await user.click(screen.getByRole('button', { name: 'Apagar memória' }));
    expect(await screen.findByText(/A memória ainda está vazia/)).toBeInTheDocument();
    expect(await services.memory.list()).toEqual([]);
  });
});
