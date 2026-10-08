# ADR-004 — Live API (voz para voz) em vez de pipeline STT → LLM → TTS

- Status: aceito
- Data: 2026-10-08

## Contexto

A prioridade do produto é uma conversa o mais natural possível. Um pipeline STT → LLM → TTS soma latências e dificulta interrupção.

## Decisão

Usar a **Gemini Live API** com modelo de áudio nativo.

## Consequências

- Interrupção nativa (barge-in), VAD configurável e voz com prosódia natural.
- A API não sinaliza o fim da fala do usuário; a latência (RNF01) é medida no cliente.
- A API está em preview: nomes de modelo ficam em `src/config/models.ts` e são conferidos a cada marco que os usa.
- Conexões têm limite (~10 min): exige compressão de contexto e session resumption (RF08).
