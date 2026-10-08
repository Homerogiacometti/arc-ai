# ADR-005 — Provedor de conversa atrás de interface própria

- Status: aceito
- Data: 2026-10-08

## Contexto

Modelos e APIs de voz mudam com frequência. Acoplar a UI ao SDK `@google/genai` tornaria qualquer troca cara.

## Decisão

Definir a interface `ConversationProvider` em `src/conversation/` e implementar `GeminiLiveProvider` atrás dela.

## Consequências

- Trocar modelo ou provedor não exige reescrever UI, áudio ou armazenamento.
- Permite um provedor falso nos testes.
- Custo: uma camada de abstração a manter.
