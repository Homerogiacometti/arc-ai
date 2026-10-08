# ADR-006 — Pausa e retomada em segundo plano

- Status: aceito
- Data: 2026-10-08

## Contexto

No Android, ao sair do app ou bloquear a tela, a WebView pode ser suspensa e o microfone interrompido. Manter a conversa rodando em segundo plano exigiria serviço em primeiro plano, notificação persistente e consumiria tokens sem o usuário estar falando.

## Decisão

- Ao ir para segundo plano, a sessão **pausa**: o cronômetro para, a conexão com a Live API é fechada e a transcrição coletada é preservada.
- Ao voltar, a sessão **retoma** usando o handle de session resumption da Live API.
- Se a retomada falhar, a sessão é encerrada e salva (com feedback normal).
- O tempo em pausa não conta para a proteção por silêncio (RF07).
- Com o app aberto em sessão, a tela fica ligada (plugin KeepAwake).

## Consequências

- Sem serviço em primeiro plano nem permissões extras.
- Sem consumo de tokens em segundo plano.
- Depende do handle de retomada continuar válido; a falha é tratada encerrando e salvando.
