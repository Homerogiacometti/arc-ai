import { useState } from 'react';
import { useServices } from '../../app/services-context';
import { PAUSE_LEVELS, type PauseLevel } from '../../config/pause-levels';
import { RESPONSE_MODES, type ResponseMode } from '../../config/response-modes';
import { THEMES, type Theme } from '../../config/themes';
import { VOICES, type Voice } from '../../config/voices';
import { useSettingsStore } from '../../store/settings';
import { useRestart } from '../app-flow';
import { ConfirmButton } from '../ConfirmButton';
import { BackupSection } from './BackupSection';
import { useNavigation } from '../navigation';
import { OptionList } from '../OptionList';
import { ScreenHeader } from '../ScreenHeader';
import { useUpdateSettings } from '../use-update-settings';

/**
 * RF16: chave de API, voz, modo de resposta (RF06), tolerância a pausas, aparência, backup e
 * apagar todos os dados.
 */
export function SettingsScreen() {
  const services = useServices();
  const { pauseLevel, voice, responseMode, theme } = useSettingsStore();
  const updateSettings = useUpdateSettings();
  const navigate = useNavigation((state) => state.navigate);
  const restart = useRestart();
  const [error, setError] = useState(false);

  const save = (changes: Parameters<typeof updateSettings>[0]) => {
    setError(false);
    updateSettings(changes).catch(() => {
      setError(true);
    });
  };

  return (
    <main className="screen">
      <ScreenHeader title="Configurações" />
      {error && (
        <p className="error" role="alert">
          Não foi possível salvar. Tente de novo.
        </p>
      )}

      <section className="section" aria-labelledby="settings-key">
        <h2 className="section__title" id="settings-key">
          Chave de API
        </h2>
        <p className="screen__text">Sua chave está guardada no armazenamento seguro do aparelho.</p>
        <div className="section__actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              navigate({ name: 'api-key' });
            }}
          >
            Trocar chave
          </button>
          <ConfirmButton
            label="Remover chave"
            question="Remover a chave? Para conversar de novo, você vai precisar colar uma chave."
            confirmLabel="Remover"
            onConfirm={async () => {
              await services.apiKeyStore.remove();
              restart();
            }}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="settings-voice">
        <h2 className="section__title" id="settings-voice">
          Voz da IA
        </h2>
        <p className="screen__text">Vale a partir da próxima conversa.</p>
        <select
          className="input"
          aria-labelledby="settings-voice"
          value={voice}
          onChange={(event) => {
            save({ voice: event.target.value as Voice });
          }}
        >
          {(Object.entries(VOICES) as [Voice, string][]).map(([name, style]) => (
            <option key={name} value={name}>
              {name} · {style}
            </option>
          ))}
        </select>
      </section>

      <section className="section">
        <OptionList
          legend="Modo de resposta"
          value={responseMode}
          options={(Object.keys(RESPONSE_MODES) as ResponseMode[]).map((mode) => ({
            value: mode,
            label: RESPONSE_MODES[mode].label,
            description: RESPONSE_MODES[mode].description,
          }))}
          onChange={(mode) => {
            save({ responseMode: mode });
          }}
        />
        <p className="field__hint">
          Vale a partir da próxima conversa. No modo verboso, a IA fala mais e você fala menos; o
          rápido gasta menos tokens e deixa você falar mais.
        </p>
      </section>

      <section className="section">
        <OptionList
          legend="Tolerância a pausas"
          value={pauseLevel}
          options={(Object.keys(PAUSE_LEVELS) as PauseLevel[]).map((level) => ({
            value: level,
            label: PAUSE_LEVELS[level].label,
            description: PAUSE_LEVELS[level].description,
          }))}
          onChange={(level) => {
            save({ pauseLevel: level });
          }}
        />
      </section>

      <section className="section">
        <OptionList
          legend="Aparência"
          value={theme}
          options={(Object.keys(THEMES) as Theme[]).map((value) => ({
            value,
            label: THEMES[value].label,
          }))}
          onChange={(value) => {
            save({ theme: value });
          }}
        />
      </section>

      <BackupSection />

      <section className="section" aria-labelledby="settings-erase">
        <h2 className="section__title" id="settings-erase">
          Apagar todos os dados
        </h2>
        <p className="screen__text">
          Apaga perfil, memória, histórico, feedbacks e configurações deste aparelho, e remove a
          chave. Não dá para desfazer.
        </p>
        <ConfirmButton
          label="Apagar todos os dados"
          question="Apagar todos os dados do Arc AI deste aparelho?"
          confirmLabel="Apagar tudo"
          onConfirm={async () => {
            await services.eraseAllData();
            restart();
          }}
        />
      </section>
    </main>
  );
}
