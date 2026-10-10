import { useCallback, useEffect, useId, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import type { MemoryItem } from '../../storage/memory-repository';
import { ConfirmButton } from '../ConfirmButton';

interface Group {
  key: string;
  title: string;
  items: MemoryItem[];
}

/** RF11: o usuário vê e apaga o que a IA lembra dele. */
export function MemorySection() {
  const { memory } = useServices();
  const id = useId();
  const [items, setItems] = useState<MemoryItem[] | null>(null);

  const load = useCallback(async () => {
    setItems(await memory.list());
  }, [memory]);

  useEffect(() => {
    let active = true;
    void memory.list().then((list) => {
      if (active) setItems(list);
    });
    return () => {
      active = false;
    };
  }, [memory]);

  const remove = async (itemId: number) => {
    await memory.remove(itemId);
    await load();
  };

  return (
    <section className="section" aria-labelledby={`${id}-title`}>
      <h2 className="section__title" id={`${id}-title`}>
        Memória
      </h2>
      <p className="screen__text">
        O que a IA lembra de você entre as conversas. Ela é atualizada pelo feedback de cada
        conversa e usada para puxar assunto e criar chances de praticar.
      </p>
      {items === null && <p className="screen__text">Carregando…</p>}
      {items?.length === 0 && (
        <p className="screen__text">
          A memória ainda está vazia. Ela começa a ser preenchida no fim da primeira conversa.
        </p>
      )}
      {items &&
        groupItems(items).map((group) => (
          <section className="memory__group" key={group.key} aria-label={group.title}>
            <h3 className="memory__title">{group.title}</h3>
            <ul className="list">
              {group.items.map((item) => (
                <li className="memory__item" key={item.id}>
                  <span className="memory__content">{item.content}</span>
                  <button
                    className="memory__remove"
                    type="button"
                    aria-label={`Apagar: ${item.content}`}
                    onClick={() => void remove(item.id)}
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      {items && items.length > 0 && (
        <div className="section__actions memory__clear">
          <ConfirmButton
            label="Apagar toda a memória"
            question="Apagar tudo o que a IA lembra de você, em todos os idiomas?"
            confirmLabel="Apagar memória"
            onConfirm={async () => {
              await memory.clear();
              await load();
            }}
          />
        </div>
      )}
    </section>
  );
}

function groupItems(items: MemoryItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = `${item.languageCode ?? ''}:${item.kind}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: groupTitle(item), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

function groupTitle(item: MemoryItem): string {
  if (item.kind === 'personal') return 'Sobre você';
  const language = findLanguage(item.languageCode ?? '')?.label ?? item.languageCode ?? '';
  return `${item.kind === 'mistake' ? 'Erros frequentes' : 'Pontos fortes'} · ${language}`;
}
