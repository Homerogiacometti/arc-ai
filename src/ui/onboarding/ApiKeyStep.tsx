import { useId, useState, type SubmitEvent } from 'react';
import { useServices } from '../../app/services-context';
import { API_KEY_ERROR_MESSAGES, normalizeApiKey } from '../../secure/validate-api-key';
import { Logo } from '../Logo';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

interface ApiKeyStepProps {
  onSaved: () => void;
}

/** RF01: explica a chave, mostra como gerá-la, valida e guarda no armazenamento seguro. */
export function ApiKeyStep({ onSaved }: ApiKeyStepProps) {
  const { apiKeyStore, validateApiKey } = useServices();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiKey = normalizeApiKey(value);
    setError(null);
    setValidating(true);
    try {
      const result = await validateApiKey(apiKey);
      if (!result.ok) {
        setError(API_KEY_ERROR_MESSAGES[result.reason]);
        setValidating(false);
        return;
      }
      await apiKeyStore.set(apiKey);
    } catch {
      setError('Não foi possível salvar a chave neste aparelho. Tente de novo.');
      setValidating(false);
      return;
    }
    onSaved();
  }

  return (
    <main className="screen">
      <Logo size="medium" />
      <h1 className="screen__title">Sua chave do Gemini</h1>
      <p className="screen__text">
        O Arc AI conversa com você usando a IA do Google (Gemini) com a sua própria chave de API.
        Ela fica guardada só neste aparelho, no armazenamento seguro do Android, e o uso é
        contabilizado na sua conta do Google.
      </p>
      <ol className="steps">
        <li>
          Abra o{' '}
          <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer">
            Google AI Studio
          </a>{' '}
          e entre com sua conta Google.
        </li>
        <li>
          Toque em <strong>Create API key</strong> (criar chave de API).
        </li>
        <li>Copie a chave e cole abaixo.</li>
      </ol>
      <form
        className="form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor={inputId}>
            Chave de API
          </label>
          <input
            id={inputId}
            className="input"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            disabled={validating}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button" type="submit" disabled={validating}>
          {validating ? 'Validando…' : 'Validar e salvar'}
        </button>
      </form>
    </main>
  );
}
