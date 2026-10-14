import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { DEFAULT_SETTINGS } from '../../config/settings';
import { SAMPLE_FEEDBACK } from '../../feedback/fixtures';
import type { Feedback } from '../../feedback/schema';
import { useSettingsStore } from '../../store/settings';
import { createTestServices } from '../../test/services';
import { Screens } from '../Screens';

type TestServices = Awaited<ReturnType<typeof createTestServices>>['services'];

async function addFeedback(
  services: TestServices,
  day: number,
  feedback: Feedback,
  languageCode = 'en-US',
) {
  const id = await services.sessions.create({
    languageCode,
    responseMode: 'balanced',
    instructionVersion: 2,
    startedAt: new Date(2026, 9, day, 10),
    endedAt: new Date(2026, 9, day, 10, 10),
    durationMs: 600_000,
    endReason: 'user',
    totalTokens: 0,
    latenciesMs: [],
    feedbackStatus: 'pending',
    transcript: [{ speaker: 'user', text: 'Hello there' }],
  });
  await services.sessions.saveFeedback(id, feedback, { model: 'm', promptVersion: 3 });
}

async function openEvaluation(fill: (services: TestServices) => Promise<void>) {
  const user = userEvent.setup();
  const { services } = await createTestServices();
  await services.profiles.save({ languageCode: 'en-US', level: 'intermediate' });
  await fill(services);
  useSettingsStore.getState().replace(DEFAULT_SETTINGS);
  render(
    <ServicesContext value={services}>
      <Screens />
    </ServicesContext>,
  );
  await user.click(await screen.findByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('button', { name: 'Avaliação' }));
  return { user, services };
}

const withLevel = (
  cefr: Feedback['level']['cefr'],
  progress: number,
  skills: Feedback['skills'],
): Feedback => ({ ...SAMPLE_FEEDBACK, level: { cefr, progress, comment: 'ok' }, skills });

describe('EvaluationScreen', () => {
  it('explica como funciona quando ainda não há conversas avaliadas', async () => {
    await openEvaluation(() => Promise.resolve());
    expect(
      await screen.findByText(/Ainda não há conversas avaliadas em Inglês/),
    ).toBeInTheDocument();
  });

  it('mostra o nível pela média, a barra até o próximo e o mapa de pontos', async () => {
    await openEvaluation(async (services) => {
      await addFeedback(
        services,
        1,
        withLevel('B1', 40, [
          { skill: 'articles', evaluation: 'strong' },
          { skill: 'prepositions', evaluation: 'weak' },
        ]),
      );
      await addFeedback(
        services,
        2,
        withLevel('B1', 80, [
          { skill: 'articles', evaluation: 'strong' },
          { skill: 'prepositions', evaluation: 'weak' },
        ]),
      );
    });

    expect(await screen.findByText('B1', { selector: '.evaluation__level' })).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Caminho até B2' });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('60% até B2')).toBeInTheDocument();
    expect(screen.getByText(/Nível que você declarou: Intermediário/)).toBeInTheDocument();

    expect(
      within(screen.getByRole('group', { name: 'Pontos fortes' })).getByText('Artigos'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Pontos fracos' })).getByText('Preposições'),
    ).toBeInTheDocument();
  });

  it('troca de idioma quando o usuário aprende mais de um', async () => {
    const { user } = await openEvaluation(async (services) => {
      await services.profiles.save({ languageCode: 'es-ES', level: 'beginner' });
      await addFeedback(services, 1, withLevel('B1', 50, []));
      await addFeedback(services, 2, withLevel('A2', 10, []), 'es-ES');
    });

    expect(await screen.findByText('B1', { selector: '.evaluation__level' })).toBeInTheDocument();
    // A tela segue o idioma atual do app; as bandeiras do cabeçalho trocam o idioma.
    await user.click(await screen.findByRole('button', { name: 'Praticar Espanhol' }));
    expect(await screen.findByText('A2', { selector: '.evaluation__level' })).toBeInTheDocument();
  });
});
