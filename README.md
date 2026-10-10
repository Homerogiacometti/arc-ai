# Arc AI

App Android para praticar conversação por voz em outros idiomas com a **Gemini Live API**. A IA conduz o diálogo, lembra de você entre sessões e entrega feedback de erros e acertos ao final de cada conversa.

Gratuito, sem backend: cada usuário usa a própria chave de API do Gemini, guardada no Keystore do aparelho. Todos os dados ficam no celular.

> Status: **M10 — Publicação na Play Store** em andamento. Veja os marcos em [`docs/SPEC.md`](docs/SPEC.md#10-marcos-da-v1).
>
> Política de privacidade: https://www.arctechnologies.co/arc-ai/privacidade

## Stack

TypeScript · React · Vite · Capacitor (Android) · SQLite (`@capacitor-community/sqlite`, sql.js nos testes) · Zustand · Zod · Vitest + Testing Library · ESLint + Prettier · GitHub Actions

Documentação:

- [`docs/SPEC.md`](docs/SPEC.md) — fonte da verdade (requisitos, arquitetura, marcos)
- [`docs/adr/`](docs/adr/) — decisões de arquitetura

## Pré-requisitos

- Node 24 (`.nvmrc`)
- JDK 21
- Android SDK (Android Studio ou command-line tools)

## Rodar

```bash
npm install
npm run dev          # app no navegador (tela e fluxo)
```

No navegador, o banco é sql.js em memória (some ao recarregar) e a chave fica no `localStorage` — apenas em dev. No aparelho, o banco é SQLite nativo e a chave fica no Android Keystore.

| Script              | O que faz                                |
| ------------------- | ---------------------------------------- |
| `npm run lint`      | ESLint                                   |
| `npm run format`    | Prettier (escreve)                       |
| `npm run typecheck` | TypeScript strict                        |
| `npm test`          | Vitest                                   |
| `npm run build`     | Typecheck + build de produção em `dist/` |

## Gerar e instalar o APK

1. Crie `android/local.properties` apontando para o SDK (fica fora do git):

   ```properties
   sdk.dir=C:/Users/<você>/AppData/Local/Android/Sdk
   ```

2. Gere o APK debug:

   ```bash
   npm run apk
   ```

   Saída: `android/app/build/outputs/apk/debug/app-debug.apk`.

3. Instale no celular (depuração USB ativada):

   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

## Build de release (Play Store)

`npm run aab` gera `android/app/build/outputs/bundle/release/app-release.aab`, assinado com a chave de upload. A chave fica fora do repositório: o Gradle lê `~/.arc-ai-keys/keystore.properties` (ou o caminho em `ARC_AI_KEYSTORE_PROPERTIES`) com `storeFile`, `storePassword`, `keyAlias` e `keyPassword`. Sem esse arquivo, o release sai sem assinatura. Textos e respostas da loja estão em [`docs/play-store/`](docs/play-store/).

O CI também publica o APK debug como artefato (`arc-ai-debug-apk`) a cada push na `main`.

> Testes de áudio são feitos em celular real. O emulador serve só para tela e fluxo.

## Estrutura

```
src/
  audio/          captura e reprodução de áudio
  conversation/   ConversationProvider + GeminiLiveProvider
  prompts/        instruções de sistema
  feedback/       feedback de fim de sessão
  memory/         memória entre sessões
  plan/           plano de estudo e constância
  evaluation/     avaliação: nível e pontos fortes e fracos
  storage/        SQLite, migrations, backup
  secure/         chave de API (Keystore)
  config/         idiomas, modelos, níveis de pausa, limites
  app/            montagem das dependências e fluxo de início
  store/          estado global (Zustand)
  ui/             telas e componentes
```
