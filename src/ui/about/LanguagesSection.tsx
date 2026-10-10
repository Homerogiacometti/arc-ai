import { useCallback, useEffect, useId, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage, LANGUAGES, type LanguageCode } from '../../config/languages';
import { LEVELS, type Level, type LearnerProfile } from '../../config/profile';
import { useSettingsStore } from '../../store/settings';
import { useUpdateSettings } from '../use-update-settings';

const LEVEL_ENTRIES = Object.entries(LEVELS) as [Level, string][];

/** Idiomas que o usuário aprende, cada um com seu nível, e o idioma da próxima conversa. */
export function LanguagesSection() {
  const { profiles } = useServices();
  const languageCode = useSettingsStore((state) => state.languageCode);
  const updateSettings = useUpdateSettings();
  const id = useId();
  const [list, setList] = useState<LearnerProfile[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setList(await profiles.list());
  }, [profiles]);

  useEffect(() => {
    let active = true;
    void profiles.list().then((loaded) => {
      if (active) setList(loaded);
    });
    return () => {
      active = false;
    };
  }, [profiles]);

  const run = async (action: () => Promise<void>) => {
    setError(false);
    try {
      await action();
      await reload();
    } catch {
      setError(true);
    }
  };

  const learning = (list ?? []).filter((profile) => findLanguage(profile.languageCode));
  const available = LANGUAGES.filter(
    (language) => !learning.some((profile) => profile.languageCode === language.code),
  );

  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Idiomas
      </h2>
      {error && (
        <p className="error" role="alert">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
      {list && (
        <>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-current`}>
              Praticando agora
            </label>
            <select
              id={`${id}-current`}
              className="input"
              value={languageCode}
              onChange={(event) => {
                void run(() =>
                  updateSettings({ languageCode: event.target.value as LanguageCode }),
                );
              }}
            >
              {learning.map((profile) => {
                const language = findLanguage(profile.languageCode);
                return (
                  <option key={profile.languageCode} value={profile.languageCode}>
                    {language?.flag} {language?.label}
                  </option>
                );
              })}
            </select>
            <p className="field__hint">Vale a partir da próxima conversa.</p>
          </div>

          <ul className="list languages">
            {learning.map((profile) => {
              const language = findLanguage(profile.languageCode);
              const label = language?.label ?? profile.languageCode;
              return (
                <li className="languages__item" key={profile.languageCode}>
                  <span className="languages__name">
                    <span aria-hidden="true">{language?.flag}</span> {label}
                  </span>
                  <select
                    className="input languages__level"
                    aria-label={`Nível em ${label}`}
                    value={profile.level}
                    onChange={(event) => {
                      void run(() =>
                        profiles.save({ ...profile, level: event.target.value as Level }),
                      );
                    }}
                  >
                    {LEVEL_ENTRIES.map(([value, levelLabel]) => (
                      <option key={value} value={value}>
                        {levelLabel}
                      </option>
                    ))}
                  </select>
                  {profile.languageCode !== languageCode && (
                    <button
                      className="languages__remove"
                      type="button"
                      aria-label={`Remover ${label}`}
                      onClick={() => {
                        void run(() => profiles.remove(profile.languageCode));
                      }}
                    >
                      Remover
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {learning.length > 1 && (
            <p className="field__hint">
              Remover um idioma não apaga a memória nem o histórico dele.
            </p>
          )}

          {available.length > 0 && (
            <AddLanguage
              available={available.map((language) => language.code)}
              onAdd={(profile) => run(() => profiles.save(profile))}
            />
          )}
        </>
      )}
    </section>
  );
}

function AddLanguage({
  available,
  onAdd,
}: {
  available: LanguageCode[];
  onAdd: (profile: LearnerProfile) => Promise<void>;
}) {
  const id = useId();
  const [code, setCode] = useState<LanguageCode | ''>('');
  const [level, setLevel] = useState<Level>('beginner');

  return (
    <div className="add-language" role="group" aria-labelledby={`${id}-title`}>
      <h3 className="add-language__title" id={`${id}-title`}>
        Adicionar idioma
      </h3>
      <select
        className="input"
        aria-label="Idioma para adicionar"
        value={code}
        onChange={(event) => {
          setCode(event.target.value as LanguageCode | '');
        }}
      >
        <option value="">Escolha o idioma</option>
        {available.map((value) => {
          const language = findLanguage(value);
          return (
            <option key={value} value={value}>
              {language?.flag} {language?.label}
            </option>
          );
        })}
      </select>
      <select
        className="input"
        aria-label="Seu nível no idioma novo"
        value={level}
        onChange={(event) => {
          setLevel(event.target.value as Level);
        }}
      >
        {LEVEL_ENTRIES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        className="button button--quiet"
        type="button"
        disabled={!code}
        onClick={() => {
          if (!code) return;
          void onAdd({ languageCode: code, level }).then(() => {
            setCode('');
            setLevel('beginner');
          });
        }}
      >
        Adicionar
      </button>
    </div>
  );
}
