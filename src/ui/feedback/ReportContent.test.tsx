import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServicesContext } from '../../app/services-context';
import { createTestServices } from '../../test/services';
import { useNavigation } from '../navigation';
import { Screens } from '../Screens';

describe('Reportar conteúdo (RF15)', () => {
  it('abre o e-mail com o trecho escolhido e marca a sessão como reportada', async () => {
    const user = userEvent.setup();
    const { services, device } = await createTestServices();
    const id = await services.sessions.create({
      languageCode: 'en-US',
      responseMode: 'balanced',
      instructionVersion: 2,
      startedAt: new Date('2026-10-08T10:00:00Z'),
      endedAt: new Date('2026-10-08T10:05:00Z'),
      durationMs: 300_000,
      endReason: 'user',
      totalTokens: 0,
      latenciesMs: [],
      feedbackStatus: 'skipped',
      transcript: [
        { speaker: 'ai', text: 'First answer' },
        { speaker: 'user', text: 'Okay then' },
        { speaker: 'ai', text: 'Second answer' },
      ],
    });
    render(
      <ServicesContext value={services}>
        <Screens />
      </ServicesContext>,
    );
    useNavigation.getState().navigate({ name: 'session', id });

    await user.click(
      await screen.findByRole('button', { name: 'Reportar resposta inadequada da IA' }),
    );
    expect(screen.getByLabelText('Qual resposta')).toHaveDisplayValue('Second answer');
    await user.selectOptions(screen.getByLabelText('Qual resposta'), 'First answer');
    await user.selectOptions(screen.getByLabelText('Motivo'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Abrir e-mail' }));

    const url = device.openUrl.mock.calls[0]?.[0] ?? '';
    const body = new URL(url).searchParams.get('body') ?? '';
    expect(url).toMatch(/^mailto:contato@arctechnologies\.co\?/);
    expect(body).toContain('"First answer"');
    expect(body).toContain('Informação falsa ou enganosa');
    expect(await screen.findByRole('status')).toHaveTextContent('Envie o e-mail');
    await vi.waitFor(async () => {
      expect((await services.sessions.get(id))?.reported).toBe(true);
    });
  });
});
