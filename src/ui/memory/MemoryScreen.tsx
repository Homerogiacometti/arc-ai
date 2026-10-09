import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import { findLanguage } from '../../config/languages';
import type { MemoryItem } from '../../storage/memory-repository';
import { ScreenHeader } from '../ScreenHeader';

interface Group {
  key: string;
  title: string;
  items: MemoryItem[];
}

/** RF11: o usuário vê e apaga o que a IA lembra dele. */
export function MemoryScreen() {
  const { memory } = useServices();
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

  const remove = async (id: number) => {
    await memory.remove(id);
    await load();
  };

  return (
    <main className="screen">
      <ScreenHeader title="Memória" />
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
            <h2 className="memory__title">{group.title}</h2>
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
    </main>
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
