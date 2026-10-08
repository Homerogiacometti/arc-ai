# ADR-003 — Chave do usuário com conexão direta, sem token efêmero

- Status: aceito
- Data: 2026-10-08

## Contexto

A documentação da Live API recomenda tokens efêmeros para proteger a chave do _desenvolvedor_ em apps cliente-servidor. Gerar tokens efêmeros exige um servidor.

## Decisão

O app conecta direto na API do Google com a **chave do próprio usuário**, guardada no Keystore do aparelho dele.

## Consequências

- Não há chave do desenvolvedor exposta, então o risco que o token efêmero mitiga não existe aqui.
- A chave nunca aparece em logs, estado persistido comum, backup ou na tela depois de salva (RNF06).
- O usuário precisa criar a própria chave no Google AI Studio (onboarding explica o passo a passo).
