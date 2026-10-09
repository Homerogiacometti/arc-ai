import { useState } from 'react';
import { RESPONSE_MODES, type ResponseMode } from '../../config/response-modes';
import { useSettingsStore } from '../../store/settings';
import { OptionList } from '../OptionList';
import { ScreenHeader } from '../ScreenHeader';
import { useUpdateSettings } from '../use-update-settings';

/** RF06: modo de resposta, aplicado pela instrução de sistema a partir da próxima sessão. */
export function ResponseModeScreen() {
  const responseMode = useSettingsStore((state) => state.responseMode);
  const updateSettings = useUpdateSettings();
  const [error, setError] = useState(false);

  return (
    <main className="screen">
      <ScreenHeader title="Modo de resposta" />
      <p className="screen__text">
        Vale a partir da próxima conversa. No modo verboso, a IA fala mais e você fala menos; o
        rápido gasta menos tokens e deixa você falar mais.
      </p>
      {error && (
        <p className="error" role="alert">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
      <OptionList
        legend="Como a IA responde"
        value={responseMode}
        options={(Object.keys(RESPONSE_MODES) as ResponseMode[]).map((mode) => ({
          value: mode,
          label: RESPONSE_MODES[mode].label,
          description: RESPONSE_MODES[mode].description,
        }))}
        onChange={(mode) => {
          setError(false);
          updateSettings({ responseMode: mode }).catch(() => {
            setError(true);
          });
        }}
      />
    </main>
  );
}
