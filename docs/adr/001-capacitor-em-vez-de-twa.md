# ADR-001 — Capacitor em vez de TWA

- Status: aceito
- Data: 2026-10-08

## Contexto

O app é escrito em React + Vite e precisa rodar no Android. As opções eram empacotar como TWA (Trusted Web Activity, que roda dentro do Chrome) ou como app nativo com Capacitor (WebView do próprio app + plugins nativos).

## Decisão

Usar **Capacitor**.

## Consequências

- Os dados ficam em SQLite do próprio app, não no armazenamento do Chrome, que o usuário pode limpar sem querer.
- A chave de API fica no Android Keystore via plugin de secure storage.
- Acesso a plugins nativos (Filesystem, Share, KeepAwake, ciclo de vida do app).
- Custo: projeto Android (Gradle) no repositório e build de APK no CI.
