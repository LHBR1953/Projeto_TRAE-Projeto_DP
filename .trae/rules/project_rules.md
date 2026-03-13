# Regras do Projeto — OCC (não quebrar o que já funciona)

## Objetivo
Implementar melhorias de forma incremental, evitando regressões em fluxos já operacionais.

## Regra de ouro
- Preferir mudança **aditiva** (novo comportamento) em vez de mudança **substitutiva** (trocar o que existe).

## Política de mudanças (obrigatória)
- Não alterar a semântica de rotas/tabelas/colunas que já estejam em uso no app.
- Para novas features:
  - criar funções novas e integrar em pontos de extensão
  - manter o fluxo antigo intacto como fallback
- Para correções inevitáveis em código existente:
  - aplicar patch mínimo e local
  - preservar assinatura/contrato da função (inputs/outputs)
  - evitar mexer em variáveis globais fora do escopo da correção

## Banco de dados
- Qualquer alteração estrutural deve vir em 3 peças:
  - script de backup/ponto de restauração (snapshot)
  - script de aplicação (migrations/constraints)
  - script de rollback
- Preferir `ON DELETE RESTRICT` para entidades-mãe (paciente, orçamento, profissional, etc.).
- Evitar mudar tipos de colunas em produção sem plano de migração e validação.

## Segurança
- Nunca adicionar/printar chaves/segredos em logs.
- Respeitar RLS; não criar “bypass” no frontend.

## Versionamento do frontend
- Ao entregar uma mudança funcional:
  - atualizar `APP_BUILD` em `app_v20.js`
  - atualizar `?v=` do CSS/JS em `index.html`

## Verificações mínimas antes de finalizar
- `node --check app_v20.js`
- Diagnósticos limpos no editor

