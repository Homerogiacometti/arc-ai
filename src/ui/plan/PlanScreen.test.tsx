import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { Screens } from '../Screens';

async function openPlan(minutesToday: number[] = []) {
  const user = userEvent.setup();
  const { services } = await createTestServices();
  await services.profiles.save({
    languageCode: 'en-US',
    level: 'intermediate',
  });
  for (const minutes of minutesToday) {
    await services.sessions.create({
      languageCode: 'en-US',
      responseMode: 'balanced',
      instructionVersion: 2,
      startedAt: new Date(),
      endedAt: new Date(),
      durationMs: minutes * 60_000,
      endReason: 'user',
      totalTokens: 0,
      latenciesMs: [],
      feedbackStatus: 'skipped',
      transcript: [{ speaker: 'user', text: 'Hello there' }],
    });
  }
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={services}>
      <Screens />
    </ServicesContext>,
  );
  await user.click(await screen.findByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: 'Plano de estudo' }));
  return { user, services };
}

const todayCell = () =>
  within(screen.getByRole('list')).getAllByRole('listitem')[(new Date().getDay() + 6) % 7];

describe('PlanScreen', () => {
  it('cria o plano e marca hoje como feito pela soma das conversas', async () => {
    const { user, services } = await openPlan([8, 7]);
    expect(await screen.findByText(/Defina quantos dias por semana/)).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('group', { name: 'Dias por semana' })).getByLabelText('2'),
    );
    await user.click(screen.getByLabelText('15 min'));
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));

    expect(await screen.findByText('2 dias por semana · 15 min por dia')).toBeInTheDocument();
    expect(todayCell()).toHaveAccessibleName(/feito, 15 min$/);
    expect(screen.getByRole('status')).toHaveTextContent('1 de 2 dias · 15 min no total.');
    expect(await services.plans.list('en-US')).toMatchObject([
      { daysPerWeek: 2, minutesPerDay: 15 },
    ]);
  });

  it('abaixo da meta o dia fica parcial; editar o plano vale para a semana atual', async () => {
    const { user } = await openPlan([10]);
    await user.click(await screen.findByLabelText('20 min'));
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    expect(await screen.findByText('3 dias por semana · 20 min por dia')).toBeInTheDocument();
    expect(todayCell()).toHaveAccessibleName(/parcial, 10 min$/);

    await user.click(screen.getByRole('button', { name: 'Editar plano' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Dias por semana' })).getByLabelText('1'),
    );
    await user.click(screen.getByLabelText('10 min'));
    await user.click(screen.getByRole('button', { name: 'Salvar plano' }));

    expect(await screen.findByText('1 dia por semana · 10 min por dia')).toBeInTheDocument();
    expect(todayCell()).toHaveAccessibleName(/feito, 10 min$/);
    expect(screen.getByRole('status')).toHaveTextContent('Meta da semana cumprida');
    expect(screen.getByText('semana cumprida')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Minutos por semana' })).toHaveTextContent('10');
  });

  it('cada idioma tem o seu plano e conta só as conversas dele', async () => {
    const { user, services } = await openPlan([20]);
    await services.profiles.save({ languageCode: 'es-ES', level: 'beginner' });
    await services.plans.save('es-ES', { daysPerWeek: 1, minutesPerDay: 10 });
    await user.click(await screen.findByLabelText('20 min'));
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    expect(await screen.findByText('3 dias por semana · 20 min por dia')).toBeInTheDocument();
    expect(todayCell()).toHaveAccessibleName(/feito, 20 min$/);

    // Volta e entra de novo para a tela recarregar a lista de idiomas.
    await user.click(screen.getByRole('button', { name: '← Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Plano de estudo' }));
    await user.click(await screen.findByRole('button', { name: 'Praticar Espanhol' }));
    expect(await screen.findByText('1 dia por semana · 10 min por dia')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meta em Espanhol' })).toBeInTheDocument();
    expect(todayCell()).toHaveAccessibleName(/, 0 min$/);
  });
});
