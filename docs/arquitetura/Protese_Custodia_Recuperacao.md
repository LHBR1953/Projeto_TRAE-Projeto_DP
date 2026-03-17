# Produção Protética — Custódia (QR) · Recuperação rápida

Este módulo adiciona um fluxo de **custódia com assinatura via celular** usando:
- Token único + expiração curta
- Código exibido na clínica (desafio-resposta)
- Confirmação pública via RPC no Supabase

## 1) Desligar sem mexer no banco (recomendado como “botão de pânico”)

No navegador, rode:

```js
localStorage.setItem('dp_feature_protese_custodia', '0')
```

Para religar:

```js
localStorage.setItem('dp_feature_protese_custodia', '1')
```

Sem valor configurado, a funcionalidade permanece ligada.

## 2) Rollback do banco (remove tabelas e RPCs)

Rodar no Supabase SQL Editor:
- [20260317_protese_custodia_chain_rollback.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260317_protese_custodia_chain_rollback.sql)

## 3) Apply do banco (cria tabelas e RPCs)

Rodar no Supabase SQL Editor:
- [20260317_protese_custodia_chain.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260317_protese_custodia_chain.sql)

