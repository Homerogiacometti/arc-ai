import { useId, useState, type SubmitEvent } from 'react';
import {
  CONVERSATION_STYLES,
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  type ConversationStyle,
} from '../../config/conversation-styles';
import { useSettingsStore } from '../../store/settings';
import { OptionList } from '../OptionList';
import { useUpdateSettings } from '../use-update-settings';

/** Estilo de conversa e instruções livres para a IA (v3), comuns a todos os idiomas. */
export function ConversationStyleSection({ onError }: { onError: () => void }) {
  const { conversationStyle, customInstructions } = useSettingsStore();
  const updateSettings = useUpdateSettings();
  const id = useId();
  const [text, setText] = useState(customInstructions);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');
    try {
      await updateSettings({ customInstructions: text });
      setText(text.trim());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="section">
      <OptionList
        legend="Estilo de conversa"
        value={conversationStyle}
        options={(Object.keys(CONVERSATION_STYLES) as ConversationStyle[]).map((style) => ({
          value: style,
          label: CONVERSATION_STYLES[style].label,
          description: CONVERSATION_STYLES[style].description,
        }))}
        onChange={(style) => {
          updateSettings({ conversationStyle: style }).catch(onError);
        }}
      />
      <p className="field__hint">
        Vale para todos os idiomas, a partir da próxima conversa. O modo de resposta define o
        tamanho das falas; o estilo, como a IA conduz o papo.
      </p>

      <form
        className="form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor={`${id}-custom`}>
            Instruções para a IA (opcional)
          </label>
          <textarea
            id={`${id}-custom`}
            className="input"
            maxLength={CUSTOM_INSTRUCTIONS_MAX_LENGTH}
            placeholder="Ex.: me chame de Ho; fale sobre tecnologia; me desafie com perguntas difíceis"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setStatus('idle');
            }}
          />
        </div>
        {status === 'error' && (
          <p className="error" role="alert">
            Não foi possível salvar. Tente de novo.
          </p>
        )}
        {status === 'saved' && (
          <p className="field__hint" role="status">
            Salvo.
          </p>
        )}
        <button className="button button--quiet" type="submit" disabled={status === 'saving'}>
          Salvar instruções
        </button>
      </form>
    </section>
  );
}
