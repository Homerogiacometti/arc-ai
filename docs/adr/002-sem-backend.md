# ADR-002 — Sem backend

- Status: aceito
- Data: 2026-10-08

## Contexto

Nenhum requisito da V1 exige servidor: não há contas, sincronização nem monetização, e cada usuário usa a própria chave do Gemini.

## Decisão

**Não ter backend na V1.** Todos os dados ficam no aparelho; o único envio externo é para a API do Google. Se um servidor for necessário no futuro, usar plano gratuito e não usar Supabase.

## Consequências

- Custo zero de infraestrutura e formulário de segurança de dados simples na Play Store.
- Sem sincronização entre aparelhos; backup é manual (exportar/importar JSON).
- O reporte de conteúdo (RF15) é feito por intent `mailto:`, sem endpoint próprio.
