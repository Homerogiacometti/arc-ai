# Play Console: passo a passo do Arc AI

Os nomes dos menus podem variar um pouco entre versões do Play Console. Em cada etapa está a resposta recomendada e o porquê.

## 1. Criar o app

Em **Todos os apps → Criar app**:

| Campo            | Resposta                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| Nome do app      | `Arc AI: Conversação com IA`                                                            |
| Idioma padrão    | Português (Brasil) – pt-BR                                                              |
| App ou jogo      | App                                                                                     |
| Gratuito ou pago | **Gratuito** (não dá para mudar depois para pago)                                       |
| Declarações      | Marcar as duas: Políticas do programa para desenvolvedores e Leis de exportação dos EUA |

Clique em **Criar app**. O nome do pacote (`co.arctechnologies.arcai`) é definido quando você envia o primeiro `.aab` e não muda mais.

## 2. Painel → "Configurar seu app"

O painel lista as tarefas abaixo. A ordem não importa.

### 2.1 Política de privacidade

Cole `https://www.arctechnologies.co/arc-ai/privacidade`.

### 2.2 Acesso ao app — **atenção**

O app não funciona sem uma chave de API, então a revisão do Google precisa de uma.

- Escolha **"Todas ou algumas funcionalidades são restritas"**.
- Adicione uma instrução:
  - Nome: `Chave de API do Gemini para revisão`
  - Nome de usuário / senha: deixe em branco ou escreva "não se aplica"
  - Instruções: `O app não tem login. Na primeira tela, cole a chave abaixo no campo "Chave de API" e toque em "Validar e salvar". Depois escolha um idioma e um nível e toque em Iniciar para conversar por voz (precisa de microfone). Chave: <COLE AQUI A CHAVE DE REVISÃO>`
- Crie uma **chave só para a revisão**, num projeto separado no AI Studio (aistudio.google.com/apikey → Create API key → novo projeto, ex.: "arc-ai-revisao"). Não use a sua chave pessoal. Depois da aprovação, você pode manter essa chave (as revisões das atualizações também usam) ou trocá-la.

### 2.3 Anúncios

**Não**, o app não tem anúncios.

### 2.4 Classificação de conteúdo

Comece o questionário:

- E-mail: contato@arctechnologies.co
- Categoria: **Todos os outros tipos de app** (não é jogo, rede social nem notícias)
- Violência, sexo, linguagem imprópria, drogas, jogos de azar: **Não** para tudo
- Interação entre usuários / conteúdo gerado por usuários compartilhado com outros: **Não** (a conversa é só entre o usuário e a IA, nada é público)
- Compartilha a localização do usuário: **Não**
- Compras digitais: **Não**
- Se aparecer a pergunta sobre conteúdo gerado por IA: **Sim**. O app gera texto e áudio com IA e tem reporte de conteúdo (no feedback e no detalhe da sessão, botão "Reportar resposta inadequada da IA").

O resultado esperado é Livre ou 12+. Não tem problema, porque o público-alvo (próxima etapa) é que restringe a idade.

### 2.5 Público-alvo e conteúdo

- Faixa etária: **18 anos ou mais**. Assim o app fica fora das regras de apps para crianças, e combina com a política de privacidade.
- O app pode atrair crianças sem querer? **Não**.

### 2.6 App de notícias

**Não**.

### 2.7 Segurança dos dados

Respostas, pensadas para refletir o que o app faz de verdade:

1. **O app coleta ou compartilha algum dos tipos de dados exigidos?** **Sim**.
2. **Todos os dados coletados são criptografados em trânsito?** **Sim** (HTTPS/WSS para o Google).
3. **Você oferece uma forma de pedir a exclusão dos dados?** **Sim**: o app apaga tudo em Configurações → Apagar todos os dados, e não há conta nem servidor nosso.
4. **Tipos de dados**, marque:
   - **Áudio → Gravações de voz ou som**
     - Coletado: Sim. Compartilhado: **Não** (vai para o Google como provedor do serviço que o próprio usuário aciona com a chave dele; isso se enquadra na exceção de provedor de serviço)
     - Processado de forma temporária: **Não** (o Google pode reter conforme os termos dele)
     - Obrigatório (o usuário não pode recusar): **Obrigatório**
     - Finalidade: **Funcionalidade do app**
   - **Mensagens no app → Outras mensagens no app** (as transcrições e o feedback)
     - Coletado: Sim. Compartilhado: Não. Temporário: Não. Obrigatório. Finalidade: Funcionalidade do app
   - **Informações pessoais → Outras informações** (interesses, objetivos e a memória com fatos que o usuário conta)
     - Coletado: Sim. Compartilhado: Não. Temporário: Não. **Opcional**. Finalidade: Funcionalidade do app e Personalização
   - Não marque localização, contatos, fotos, identificadores, dados financeiros, saúde nem atividade no app: o app não acessa nada disso.

Se você preferir declarar como "compartilhado" com o Google, também é aceitável e é a leitura mais conservadora. Nesse caso, marque Compartilhado: Sim, com a finalidade Funcionalidade do app, nos três tipos.

### 2.8 Apps governamentais, recursos financeiros e saúde

**Não** para todos.

### 2.9 Categoria e contatos da loja

Em **Configurações da página da loja**: Categoria **Educação**; e-mail contato@arctechnologies.co; site arctechnologies.co (opcional).

### 2.10 Página principal da loja

Cole os textos de `ficha-da-loja.md` e envie as imagens de `midias/play-store/`.

## 3. Teste fechado (obrigatório antes da produção)

Contas pessoais criadas depois de novembro de 2023 precisam rodar um **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de pedir acesso à produção. A regra vale para cada app novo. Se a sua conta é de organização, ela não se aplica e você pode pular para a etapa 4. Ainda assim, um teste interno rápido vale a pena.

1. **Testar e lançar → Testes → Teste fechado → Criar faixa** (ou usar a faixa "Alpha").
2. **Testadores:** crie uma lista de e-mails (contas Google) com pelo menos 12 pessoas. Elas precisam aceitar o convite pelo link de inscrição e manter o app instalado.
3. **Criar versão:** envie `android/app/build/outputs/bundle/release/app-release.aab`.
   - Na primeira vez, o Console oferece a **Assinatura de apps do Google Play**: aceite (o Google guarda a chave do app e você assina só com a chave de upload, que já está em `C:\Users\Homero\.arc-ai-keys\`).
   - Nome da versão: `1.0.0 (1)`. Notas da versão: "Primeira versão de teste."
4. **Revisar e iniciar o lançamento.** A primeira revisão pode levar alguns dias.
5. Depois de 14 dias com 12 testadores ativos, aparece **"Solicitar acesso à produção"** no painel, com perguntas sobre o teste.

## 4. Produção

**Testar e lançar → Produção → Criar versão**, reaproveitando o mesmo `.aab` do teste (ou um novo, com versionCode maior), países: Brasil (e outros, se quiser) → **Revisar e iniciar o lançamento**.

## Para cada atualização

1. Subir `versionCode` (e `versionName`) em `android/app/build.gradle`.
2. `npm run aab`.
3. Enviar o novo `.aab` na faixa desejada.
