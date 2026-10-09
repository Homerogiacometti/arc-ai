import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { Screens } from '../Screens';

async function openMemory(
  fill: (services: Awaited<ReturnType<typeof createTestServices>>['services']) => Promise<void>,
) {
  const user = userEvent.setup();
  const { services } = await createTestServices();
  await services.profiles.save({
    languageCode: 'en-US',
    level: 'intermediate',
    interests: '',
    goals: '',
  });
  await fill(services);
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={services}>
      <Screens />
    </ServicesContext>,
  );
  await user.click(await screen.findByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: 'Memória' }));
  return { user, services };
}

describe('MemoryScreen', () => {
  it('explica quando a memória está vazia', async () => {
    await openMemory(() => Promise.resolve());
    expect(await screen.findByText(/A memória ainda está vazia/)).toBeInTheDocument();
  });

  it('mostra os itens por grupo e idioma e apaga um item', async () => {
    const { user, services } = await openMemory(async (services) => {
      await services.memory.replace('en-US', {
        personal: ['Trabalha como engenheiro', 'Tem um cachorro chamado Thor'],
        mistakes: ['Usa presente no lugar do passado'],
        strengths: [],
      });
      await services.memory.replace('es-ES', {
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
});
