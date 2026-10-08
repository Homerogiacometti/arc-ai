# Plano — Arc AI (V1)

## Contexto

O projeto (até agora "linguas-ai") tem só o `SPEC.md` v1.1: um app Android (React + Vite + Capacitor) para praticar conversação por voz com a Gemini Live API, com a chave do próprio usuário. Revisamos o SPEC juntos e fechamos as lacunas abaixo. Este plano registra as decisões, define a ordem de execução e detalha o **M1**, que implemento depois do seu aceite. Cada marco seguinte também passa por aceite antes de começar.

**Pré-requisito (você):** renomear a pasta para `C:\Users\Homero\Documents\Dev\arc-ai` e reabrir o Claude Code lá. Este plano fica em `~/.claude/plans/` e continua acessível.

---

## 1. Decisões da revisão (entram no SPEC v1.2)

| #   | Tema                         | Decisão                                                                                                                                                                                                                                         |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Nome                         | **Arc AI** (app, repositório `arc-ai`, pasta `arc-ai`)                                                                                                                                                                                          |
| D2  | Backend                      | **Nenhum na V1.** Nenhum requisito exige servidor. Se precisar no futuro: plano gratuito, sem Supabase                                                                                                                                          |
| D3  | Reporte (RF15)               | Intent `mailto:` para um e-mail seu, já preenchido com trecho da transcrição e motivo; sessão marcada como reportada no aparelho                                                                                                                |
| D4  | Sair do app / tela bloqueada | Sessão **pausa** (cronômetro para, conexão fecha, transcrição preservada) e **retoma** ao voltar via session resumption. Se a retomada falhar, encerra e salva. Pausa não conta como silêncio. Com o app aberto, a tela fica ligada (KeepAwake) |
| D5  | Repositório                  | GitHub **privado agora**, público depois. CI enxuto para a cota gratuita: lint/typecheck/testes em todo push; APK só na `main`; cache de npm e Gradle                                                                                           |
| D6  | applicationId                | `co.arctechnologies.arcai` (conta Play CNPJ, domínio arctechnologies.co)                                                                                                                                                                        |
| D7  | Silêncio (RF07)              | 2 min sem fala → IA pergunta se você está aí; +30 s sem fala → encerra e salva                                                                                                                                                                  |
| D8  | Memória (RF11)               | 15 pessoais (compartilhadas) / 10 erros / 10 acertos por idioma; orçamento ~600 tokens (estimativa caracteres ÷ 4)                                                                                                                              |
| D9  | Testes de áudio              | Seu celular via USB (adb). O emulador só serve para tela e fluxo                                                                                                                                                                                |

### Decisões técnicas que tomei (sem pergunta)

- **Latência (RNF01):** a Live API não avisa quando o usuário para de falar. Por isso meço do último bloco do microfone com voz (energia acima de um limiar) até o primeiro bloco de áudio da IA, por turno.
- **Nomes de modelo:** ficam só em `src/config/models.ts`. Confirmo os nomes atuais na documentação do Google no início do M3, porque não consigo garantir que `gemini-3.8-live` é o nome em vigor.
- **SQLite nos testes:** repositórios ficam atrás de uma interface, e os testes rodam as mesmas migrations em sql.js (em memória).
- **Secure storage:** `@aparajita/capacitor-secure-storage` (Keystore no Android).
- **Eco no alto-falante:** o M3 começa com um protótipo só de áudio no seu celular, antes de construir o resto da conversa.

---

## 2. Ordem de execução

Os marcos M1–M10 seguem o SPEC. Ao final de cada um: lint, typecheck e testes verdes, commit, resumo para você e pedido de aceite do próximo.

- **M2:** `secure/` (interface, plugin e fallback web só para dev); validação da chave listando os modelos; onboarding e perfil.
- **M3:** protótipo de áudio no aparelho → `audio/` (captura 16 kHz via AudioWorklet, player 24 kHz com fila e descarte na interrupção) → `conversation/` (`ConversationProvider` + `GeminiLiveProvider`, ferramenta `end_session`) → home com cronômetro e pausa/retomada (D4).
- **M4–M8:** como no SPEC, aplicando D3, D7 e D8 nos marcos correspondentes.

---

## 3. M1 — Base (o que implemento após o aceite)

1. `git init`; mover `SPEC.md` → `docs/SPEC.md` e atualizar para **v1.2** (nome Arc AI, decisões D1–D9 nas seções certas, histórico de versão).
2. `docs/adr/` com ADR-001 a ADR-005 do SPEC (formato curto: contexto / decisão / consequências) + **ADR-006 — Pausa e retomada em segundo plano** (D4).
3. Scaffold Vite + React + TypeScript strict; `.nvmrc` com Node 24.
4. Pastas `src/` da seção 7 do SPEC; `src/config/` com `languages.ts`, `models.ts`, `pause-levels.ts`, `limits.ts` (D7, D8).
5. Zustand e Zod instalados; store inicial mínimo.
6. Capacitor + Android: `appId` `co.arctechnologies.arcai`, `appName` "Arc AI", permissão `RECORD_AUDIO`; `android/local.properties` apontando para o SDK em `%LOCALAPPDATA%\Android\Sdk` (fora do git).
7. ESLint (flat config, typescript-eslint, react-hooks) + Prettier; scripts `lint`, `typecheck`, `test`, `build`.
8. Vitest + Testing Library + jsdom; teste de fumaça da App.
9. GitHub Actions conforme D5, com o APK debug publicado como artefato.
10. README inicial (o que é, stack, como rodar, como gerar e instalar o APK).
11. Criar o repositório privado `arc-ai` com `gh` e fazer o primeiro push. **Peço sua confirmação antes desse passo**, porque ele publica fora da máquina.

### Verificação do M1

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam localmente.
- `npx cap sync android` + `gradlew assembleDebug` geram o APK (ambiente já conferido: Node 24, JDK 21, Android SDK, gh).
- `adb install` no seu celular: o app "Arc AI" abre a tela placeholder.
- CI verde no primeiro push.
