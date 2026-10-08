# SPEC — Arc AI: conversação em idiomas por voz (V1)

> Fonte da verdade do projeto. Toda implementação parte deste documento.
> Mudanças de escopo ou de decisão técnica atualizam este arquivo e, quando forem decisões de arquitetura, geram um ADR em `docs/adr/`.
> Versão do documento: 1.2 — 2026-10-08 (decisões da revisão D1–D9 incorporadas; ver histórico no fim)

---

## 1. Visão

**Arc AI** é um app Android para praticar conversação por voz em qualquer idioma suportado pela Gemini Live API. Uma IA conduz o diálogo de forma natural, lembra do usuário entre sessões e entrega feedback de erros e acertos ao final de cada conversa.

O app é gratuito, não tem backend e cada usuário usa a própria chave de API do Gemini.

- Nome: **Arc AI** · repositório `arc-ai` · applicationId `co.arctechnologies.arcai` (conta Play com CNPJ, domínio arctechnologies.co).

### Prioridades do projeto (em ordem)

1. Uso próprio: melhorar o speaking (principal) e, depois, a gramática.
2. Conversa o mais natural possível, próxima de uma conversa entre humanos.
3. Portfólio: projeto construído de ponta a ponta, com boas práticas.
4. App público na Play Store (sem foco em volume de usuários).

---

## 2. Escopo

### V1

Onboarding com chave de API, seleção de idioma, conversa por voz, modo de resposta, feedback de fim de sessão, memória entre sessões, histórico, cronograma de prática, configurações, backup (exportar e importar) e reporte de conteúdo.

### V2 (em aberto)

Estudo de gramática e outros conteúdos. Formato, funcionamento e relação com a conversa **não estão definidos** e serão decididos apenas quando a conversa da V1 estiver 100%. A V1 só garante que o modelo de dados aceite novas tabelas via migration.

### Fora do escopo

Backend (nenhum requisito da V1 exige servidor; se for necessário no futuro, usar plano gratuito, sem Supabase), contas de usuário, sincronização entre aparelhos, iOS, monetização, avaliação de pronúncia, duração predefinida de sessão, escolha de tema por tela.

---

## 3. Stack

| Camada             | Escolha                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linguagem e UI     | TypeScript + React + Vite                                                                                                                                                              |
| Empacotamento      | Capacitor (Android)                                                                                                                                                                    |
| Estado global      | Zustand                                                                                                                                                                                |
| Validação          | Zod                                                                                                                                                                                    |
| Conversa           | Gemini Live API via SDK `@google/genai` (modelo de áudio nativo; padrão em out/2026: `gemini-3.8-live`, configurável)                                                                  |
| Feedback e memória | Gemini Flash (API de texto) com saída estruturada em JSON                                                                                                                              |
| Áudio              | `getUserMedia` com cancelamento de eco + AudioWorklet (entrada PCM 16-bit 16kHz; saída PCM 24kHz)                                                                                      |
| Banco local        | SQLite via plugin comunitário do Capacitor, com migrations versionadas                                                                                                                 |
| Segredo            | Chave de API no armazenamento seguro do Android (Keystore) via `@aparajita/capacitor-secure-storage`                                                                                   |
| Backup             | Plugins Filesystem e Share do Capacitor                                                                                                                                                |
| Testes             | Vitest + Testing Library; repositórios atrás de interface, testados com as mesmas migrations em sql.js (memória)                                                                       |
| Qualidade          | ESLint + Prettier + typecheck                                                                                                                                                          |
| CI                 | GitHub Actions: lint, typecheck e testes em todo push; APK debug só na `main` (artefato); cache de npm e Gradle para caber na cota gratuita. Repositório privado agora, público depois |

Nomes de modelo ficam em configuração (`src/config/models.ts`), nunca espalhados pelo código: a Live API está em preview e os modelos mudam com frequência. Os nomes vigentes são conferidos na documentação do Google no início do M3.

---

## 4. Decisões de arquitetura (ADRs a registrar)

- **ADR-001 – Capacitor em vez de TWA.** Dados em SQLite do próprio app (não do Chrome) e chave no Keystore.
- **ADR-002 – Sem backend.** Todos os dados ficam no aparelho; o único envio externo é para a API do Google.
- **ADR-003 – Chave do usuário com conexão direta, sem token efêmero.** A documentação recomenda tokens efêmeros para proteger a chave do _desenvolvedor_ em apps cliente-servidor. Aqui a chave é do próprio usuário, guardada no Keystore do aparelho dele.
- **ADR-004 – Live API (voz para voz) em vez de pipeline STT → LLM → TTS.** Prioridade é naturalidade: interrupção, VAD configurável e áudio nativo.
- **ADR-005 – Provedor de conversa atrás de interface própria.** Permite trocar modelo ou provedor sem reescrever o app.
- **ADR-006 – Pausa e retomada em segundo plano.** Ao sair do app ou bloquear a tela, a sessão pausa e é retomada via session resumption (ver RF07).

Os ADRs ficam em `docs/adr/`.

---

## 5. Requisitos funcionais

### RF01 – Onboarding e chave de API

Na primeira abertura, o app explica o que é a chave e mostra o passo a passo para gerá-la no Google AI Studio. O usuário cola a chave, o app valida com uma chamada de teste e a guarda no armazenamento seguro. A chave pode ser trocada ou removida nas configurações.

**Aceite:** chave inválida mostra erro claro; a chave nunca aparece em logs, backup ou tela depois de salva.

### RF02 – Perfil inicial

O usuário informa o nível aproximado (iniciante, intermediário, avançado) para o idioma escolhido e, opcionalmente, interesses e objetivos.

### RF03 – Idioma

O usuário escolhe o idioma de prática no menu, entre os idiomas suportados pela Live API. A lista vem de um arquivo de configuração.

Os modelos de áudio nativo não aceitam código de idioma fixo; o idioma é aplicado pela instrução de sistema. A interface do app e as explicações do feedback ficam em português.

Não há tela de escolha de tema: a IA abre a conversa puxando assunto a partir da memória, e o usuário pode sugerir outro tema falando, a qualquer momento.

### RF04 – Conversa por voz

- A IA abre a conversa; o usuário não precisa falar primeiro.
- A IA conduz o diálogo com perguntas, comentários e opiniões.
- O usuário pode interromper a IA a qualquer momento; o áudio dela para imediatamente.
- A IA não corrige erros explicitamente durante a conversa. Usa _recast_: repete a forma correta naturalmente na própria resposta.
- Se o usuário falar em português, a IA ajuda e conduz de volta ao idioma de prática.
- A IA usa a memória para criar oportunidades naturais de praticar erros recorrentes e reforçar acertos.

**Aceite:** ao receber o evento de interrupção, a reprodução para e a fila de áudio é descartada.

### RF05 – Tolerância a pausas

O tempo de silêncio antes de a IA responder é ajustável em três níveis (curto, médio, longo), mapeados para valores de `silenceDurationMs` definidos em testes reais. Referência da documentação: padrão do servidor ~800ms; acima de ~2000ms a latência percebida aumenta.

### RF06 – Modo de resposta

Escolhido no menu, aplicado pela instrução de sistema, vale a partir da próxima sessão.

| Modo        | Comportamento da IA          | Consumo de tokens      |
| ----------- | ---------------------------- | ---------------------- |
| Verbosa     | Respostas completas e longas | Maior                  |
| Equilibrada | Respostas de tamanho médio   | Intermediário          |
| Rápida      | Respostas curtas e diretas   | Menor (mais econômico) |

A tela informa que, no modo verboso, a IA fala mais e o usuário fala menos.

### RF07 – Encerramento e cronômetro

- Sem duração predefinida.
- A sessão termina pelo botão ou por pedido de voz em qualquer idioma ("let's stop", "vamos parar"). O encerramento por voz usa function calling: ferramenta `end_session`; o modelo se despede e o app encerra.
- Cronômetro visível durante toda a sessão.
- Proteção contra consumo acidental: após 2 minutos sem fala do usuário, a IA pergunta se ele ainda está ali; após mais 30 segundos sem fala, a sessão encerra sozinha e salva tudo.
- **Segundo plano (ADR-006):** ao sair do app ou bloquear a tela, a sessão **pausa** (cronômetro para, conexão fecha, transcrição preservada) e **retoma** ao voltar via session resumption. Se a retomada falhar, a sessão encerra e salva. Tempo em pausa não conta como silêncio. Com o app aberto, a tela fica ligada (KeepAwake).

### RF08 – Sessões longas

Ativar compressão da janela de contexto e retomada de sessão. Reconectar de forma transparente ao receber o aviso de desligamento do servidor (limite de conexão de ~10 minutos).

**Aceite:** uma sessão de 30 minutos não sofre interrupção perceptível.

### RF09 – Transcrição

Coletar a transcrição da fala do usuário e da IA (recurso nativo da Live API) e salvá-la ao final. Exibição em tempo real é opcional, desligada por padrão.

### RF10 – Feedback

Ao encerrar, enviar a transcrição ao modelo de texto e exibir automaticamente:

- resumo da conversa;
- pontos fortes;
- erros: frase original, correção, explicação em português, categoria;
- sugestões de vocabulário mais natural;
- estimativa de nível.

O prompt instrui o modelo a ignorar prováveis erros da transcrição automática.

**Aceite:** a resposta valida no schema Zod; se falhar, nova tentativa; em último caso, a sessão é salva com feedback pendente e opção de gerar depois.

### RF11 – Memória

Três listas curtas, com limite de itens:

| Tipo                 | Escopo                      | Uso na conversa                     |
| -------------------- | --------------------------- | ----------------------------------- |
| Informações pessoais | Compartilhada entre idiomas | Retomar assuntos da vida do usuário |
| Principais erros     | Por idioma                  | Criar oportunidades de praticar     |
| Principais acertos   | Por idioma                  | Reforçar o que o usuário domina     |

A chamada de feedback devolve as atualizações dessas listas, mesclando e descartando repetidos. O foco é dar matéria-prima à conversa, não conhecer o usuário com precisão. Transcrições não são injetadas no contexto.

Limites: 15 itens pessoais (compartilhados), 10 erros e 10 acertos por idioma. Orçamento da memória injetada: ~600 tokens, estimados como caracteres ÷ 4.

**Aceite:** a memória injetada respeita um orçamento de tokens fixo; o usuário pode ver e apagar itens.

### RF12 – Histórico

Lista de sessões com data, idioma, modo, duração, transcrição e feedback.

### RF13 – Cronograma

- O usuário define dias por semana e minutos por dia; o plano é editável.
- A semana atual mostra os dias marcados automaticamente quando a meta é cumprida.
- Evolução: semanas cumpridas, minutos por semana, sequência de semanas na meta.
- Regra de check: o dia conta como feito quando a soma das conversas do dia atinge os minutos planejados; abaixo disso, parcial.

### RF14 – Backup

- **Exportar:** arquivo JSON versionado com perfil, memória, plano, sessões, transcrições e feedbacks, salvo ou compartilhado pelo menu nativo.
- **Importar:** restaura um backup, com confirmação antes de sobrescrever.
- A chave de API nunca entra no backup.

### RF15 – Reportar conteúdo

Botão para reportar resposta inadequada da IA, na tela de feedback e no detalhe de cada sessão do histórico (política do Google Play para apps com IA generativa).

O reporte abre um intent `mailto:` para o e-mail do desenvolvedor, já preenchido com o trecho da transcrição e o motivo. A sessão fica marcada como reportada no aparelho.

### RF16 – Configurações

Chave de API, voz da IA, tolerância a pausas, ver e apagar memória, backup, apagar todos os dados.

---

## 6. Requisitos não funcionais

- **RNF01 – Latência:** medir e registrar localmente o tempo entre o fim da fala do usuário e o início da resposta. Como a Live API não sinaliza o fim da fala, a medição vai do último bloco do microfone com voz (energia acima de um limiar) até o primeiro bloco de áudio da IA, por turno.
- **RNF02 – Privacidade:** dados apenas no aparelho; único envio externo é para a API do Google. Política de privacidade e formulário de segurança de dados do Google Play refletem isso.
- **RNF03 – Robustez:** perda de rede não perde a transcrição coletada; o app tenta reconectar e, se não conseguir, encerra salvando o que houver.
- **RNF04 – Custos visíveis:** registrar tokens por sessão (`usageMetadata`) e mostrar estimativa ao usuário.
- **RNF05 – Manutenibilidade:** módulos com responsabilidade única; conversa atrás de interface própria.
- **RNF06 – Segurança:** chave só no Keystore; nunca em logs, estado persistido comum ou backup.
- **RNF07 – Testes de áudio:** feitos em celular real via USB (adb). O emulador serve apenas para tela e fluxo. O M3 começa com um protótipo só de áudio no aparelho para validar o cancelamento de eco no alto-falante.

---

## 7. Arquitetura

```
src/
  audio/          captura do microfone, conversão PCM 16kHz, reprodução 24kHz, fila e corte na interrupção
  conversation/   interface ConversationProvider + implementação GeminiLiveProvider (conexão, VAD, reconexão, end_session)
  prompts/        instruções de sistema versionadas; montagem de idioma, modo de resposta e memória
  feedback/       chamada ao modelo de texto, schemas Zod, retry
  memory/         leitura, mesclagem e orçamento de tokens da memória
  plan/           cronograma, regra de check, métricas de evolução
  storage/        SQLite, migrations, repositórios, exportar/importar backup
  secure/         armazenamento da chave de API
  config/         lista de idiomas, nomes de modelos, mapeamento dos níveis de pausa
  ui/             telas e componentes
docs/
  SPEC.md
  adr/
```

---

## 8. Modelo de dados

| Tabela             | Campos principais                                                                     |
| ------------------ | ------------------------------------------------------------------------------------- |
| `schema_version`   | versão atual das migrations                                                           |
| `learner_profile`  | idioma, nível autodeclarado, interesses, objetivos                                    |
| `memory`           | tipo (pessoal, erro, acerto), idioma (nulo para pessoal), conteúdo, atualizado em     |
| `sessions`         | idioma, modo de resposta, início, fim, duração, tokens, status do feedback, reportada |
| `transcript_turns` | sessão, quem falou, texto, ordem                                                      |
| `feedbacks`        | sessão, JSON validado                                                                 |
| `practice_plan`    | dias por semana, minutos por dia, vigência                                            |
| `settings`         | voz, nível de pausa, idioma atual, modo de resposta                                   |

A V2 adicionará suas tabelas por migration, sem alterar as existentes.

---

## 9. Telas

- **Home (ultra simples):** botão único iniciar/parar, cronômetro durante a sessão, indicador sutil de quem está falando, menu no canto superior e etiqueta discreta com o idioma atual ao lado do menu.
- **Menu:** Idioma · Modo de resposta · Cronograma e progresso · Histórico · Memória · Configurações.
- **Feedback:** aparece automaticamente ao parar; ao fechar, volta à home.
- **Onboarding:** chave de API e perfil inicial.
- **Histórico** e **Detalhe da sessão**.

---

## 10. Marcos da V1

1. **M1 – Base:** Vite + React + TS, Capacitor Android, ESLint/Prettier, Vitest, CI no GitHub Actions, README inicial.
2. **M2 – Chave e onboarding:** secure storage, validação da chave, perfil inicial.
3. **M3 – Conversa por voz de ponta a ponta:** áudio, Live API, VAD, interrupção, cronômetro, encerramento por botão e voz.
4. **M4 – Transcrição, feedback e histórico.**
5. **M5 – Memória entre sessões.**
6. **M6 – Idioma, modo de resposta e configurações.**
7. **M7 – Cronograma e progresso.**
8. **M8 – Backup, reporte de conteúdo, proteção por silêncio, sessões longas.**
9. **M9 – Uso diário real:** ajuste de prompts, VAD e modos de resposta.
10. **M10 – Publicação na Play Store:** política de privacidade, segurança de dados, teste fechado, lançamento.

---

## 11. Decisões confirmadas

- Proteção por silêncio: após 2 minutos sem fala, a IA pergunta se o usuário está ali; após mais 30 s sem fala, encerra e salva.
- Check do cronograma pela soma de minutos no dia (abaixo da meta = parcial).
- Etiqueta discreta com o idioma atual ao lado do menu.
- Interface do app e explicações do feedback em português.
- Nível autodeclarado por idioma.
- Transcrição ao vivo desligada por padrão.
- Backup com exportação e importação.

---

## 12. Referências

- Live API – capacidades (VAD, transcrição, áudio, limites): https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Live API – gerenciamento de sessão: https://ai.google.dev/gemini-api/docs/live-api/session-management
- Live API – uso de ferramentas (function calling): https://ai.google.dev/gemini-api/docs/live-api/tools
- Google AI Studio (chave de API): https://aistudio.google.com/apikey

---

## 13. Histórico de versões

| Versão | Data       | Mudanças                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0    | 2026-10-08 | Primeira versão.                                                                                                                                                                                                                                                                                                                           |
| 1.1    | 2026-10-08 | Todas as decisões confirmadas.                                                                                                                                                                                                                                                                                                             |
| 1.2    | 2026-10-08 | Revisão D1–D9: nome Arc AI e applicationId; sem backend; reporte via `mailto:`; pausa/retomada em segundo plano (ADR-006) e KeepAwake; repositório privado e CI enxuto; silêncio 2 min + 30 s; limites e orçamento da memória; testes de áudio em aparelho real; medição de latência; plugin de secure storage; SQLite testado com sql.js. |
