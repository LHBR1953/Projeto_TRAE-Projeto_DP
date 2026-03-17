# Orçamento — Executor Protético (Interno/Externo) · Recuperação rápida

## Objetivo
Separar no **item do orçamento** o conceito de:
- **Execução protética interna** (Protético = profissional)
- **Execução protética externa** (Executor = laboratório)

Sem perder compatibilidade com os campos atuais (`protetico_id`, `valor_protetico`).

## 1) Botão de pânico (sem mexer no banco)

Desliga a nova lógica e volta ao comportamento antigo (campo “Protético” vindo de Profissionais):

```js
localStorage.setItem('dp_feature_orcamento_executor_protese_v2', '0')
```

Para ligar:

```js
localStorage.setItem('dp_feature_orcamento_executor_protese_v2', '1')
```

## 2) Apply do banco (cria colunas e FK para laboratório)

Rodar no Supabase SQL Editor:
- [20260317_orcamento_item_executor_protese.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260317_orcamento_item_executor_protese.sql)

## 3) Rollback do banco (remove colunas novas)

Rodar no Supabase SQL Editor:
- [20260317_orcamento_item_executor_protese_rollback.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260317_orcamento_item_executor_protese_rollback.sql)

## 4) Backfill (opcional): marcar itens antigos como Interna

Rodar no Supabase SQL Editor:
- [20260317_orcamento_item_executor_protese_backfill_interna.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260317_orcamento_item_executor_protese_backfill_interna.sql)
