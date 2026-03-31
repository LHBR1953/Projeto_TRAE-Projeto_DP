# OCC — Diário de Bordo Técnico (Mapa da Mina) ⛏️🧭

Este documento é um guia técnico para manutenção e evolução do OCC como um SaaS multi-empresa, com foco em isolamento por `empresa_id`, integridade referencial, RLS e automação de onboarding.

## 1) Estrutura Multi-Tenant (empresa_id) 🏢🧩

### Objetivo

- Todo dado operacional pertence a uma única clínica via `empresa_id`.
- A exclusão de uma empresa deve ser bloqueada enquanto houver qualquer dado vinculado.

### Blindagem principal (FK + NOT NULL + RESTRICT)

- Migration: [20260328_saas_security_shield.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_saas_security_shield.sql)

O que esta migration faz, em alto nível:

- Para cada tabela do “lote” (se existir):
  - exige coluna `empresa_id`
  - proíbe `empresa_id` nulo (falha se houver registros com `empresa_id IS NULL`)
  - força `empresa_id NOT NULL`
  - cria FK `empresa_id → empresas(id) ON DELETE RESTRICT` quando estiver faltando
- Em seguida, varre todas as FKs no schema `public` que referenciam `empresas` e recria com `ON DELETE RESTRICT`.

Tabelas no lote (29 operacionais + marketing e auditoria incluídos):

- `usuario_empresas`
- `pacientes`
- `paciente_evolucao`
- `paciente_documentos`
- `profissionais`
- `profissional_usuarios`
- `especialidades`
- `especialidade_subdivisoes`
- `servicos`
- `marketing_smtp_config`
- `marketing_campanhas`
- `marketing_envios`
- `orcamentos`
- `orcamento_itens`
- `orcamento_pagamentos`
- `agenda_disponibilidade`
- `agenda_agendamentos`
- `financeiro_transacoes`
- `financeiro_comissoes`
- `orcamento_cancelados`
- `auditoria_log`
- `occ_audit_log`
- `laboratorios_proteticos`
- `ordens_proteticas`
- `ordens_proteticas_eventos`
- `ordens_proteticas_anexos`
- `protese_contas_pagar`
- `ordens_proteticas_custodia_tokens`
- `ordens_proteticas_custodia_eventos`

Observação:

- A tabela `empresas` é o “root tenant”. Ela não tem `empresa_id`, mas é protegida por RLS e por restrições de escrita (seção 2).

## 2) Segurança RLS (Row Level Security) 🛡️🔐

### `empresas` (SuperAdmin vs Admin da clínica)

- Migration: [20260328_empresas_rls_guard.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_empresas_rls_guard.sql)

Regras:

- `SELECT` em `empresas`:
  - permitido se `is_superadmin()` **ou** se existir vínculo em `usuario_empresas` para `empresas.id`
- `INSERT/UPDATE/DELETE` em `empresas`:
  - somente `is_superadmin()`

Motivo:

- Mesmo que o Admin da clínica tente consultar via API, ele não consegue listar outras clínicas nem criar novas.

### Atualização segura do “perfil da clínica” (Admin pode)

- Migration: [20260328_rpc_update_empresa_profile.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_rpc_update_empresa_profile.sql)
- RPC: `public.rpc_update_empresa_profile(...)` (security definer)
- Checagem: `is_admin_of_empresa(p_empresa_id) or is_superadmin()`

Motivo:

- Permite que o Admin atualize apenas `nome/email/telefone/celular/logotipo` sem liberar `UPDATE` geral em `empresas`.

### `usuario_empresas`, `pacientes` e o isolamento por empresa_id

No front-end, o isolamento é feito por:

- filtro `.eq('empresa_id', currentEmpresaId)` nas queries de dados
- permissões por módulo via `currentUserPerms`

Referências:

- [checkAuth](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L160-L246)
- [can](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L352-L369)

No banco, a proteção real depende das policies RLS que existem no ambiente (há scripts em `sql/` e backups). O “guard” de `empresas` já está versionado como migration; as demais tabelas devem seguir o padrão: `USING (is_member_of_empresa(empresa_id) or is_superadmin())` e `WITH CHECK` para inserts/updates.

## 3) Automação de Onboarding (Empresa → Auth → Permissões) 🧪🏗️

### Edge Function

- Código: [create-tenant-company](file:///c:/Projeto_TRAE/projeto_dp/supabase/functions/create-tenant-company/index.ts)

### Fluxo técnico

1) Autenticação e autorização do chamador:

- Valida token (`auth.getUser(token)`)
- Restringe execução ao SuperAdmin (email configurado na função)

2) Criação do tenant:

- Insere `empresas` com:
  - `id` (empresa_id)
  - `identificador` (slug)
  - `nome`
  - `email`
  - `assinatura_status`
  - campos adicionais opcionais (telefone/celular/logotipo/supervisor_pin)

3) Criação do usuário Admin:

- Usa Admin API do Auth:
  - cria usuário (email_confirm = true) **ou**
  - se o email já existir, localiza pelo email e atualiza a senha

4) Vínculo e permissões:

- Upsert em `usuario_empresas` com:
  - `perfil = 'admin'`
  - `permissoes = full` (todos os módulos com select/insert/update/delete)

5) Resposta:

- retorna mensagem de sucesso
- retorna `admin_password` (senha inicial gerada)

### Integração no Front-end

Ao salvar uma NOVA empresa, o formulário chama a function:

- [app_v20.js](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L14135-L14219)

## 4) Módulo de Prótese e Custódia (QR Code) 🔬📦

### Conceito de integridade

O fluxo de custódia foi desenhado para garantir:

- token único por ação/etapa
- confirmação (recebimento) com prova (assinatura/identidade)
- rastreabilidade por `empresa_id` e `ordem_id`

Tabelas relacionadas (no lote do shield):

- `ordens_proteticas` (ordem principal)
- `ordens_proteticas_eventos` (eventos da produção)
- `ordens_proteticas_custodia_tokens` (tokens para QR)
- `ordens_proteticas_custodia_eventos` (confirmações/recebimentos)

Observação:

- O shield garante que, se essas tabelas existirem, terão `empresa_id NOT NULL` e FK `empresa_id → empresas(id) ON DELETE RESTRICT`.

## 5) Políticas de Auditoria 🧾🕵️

### `auditoria_log`

- Migration: [20260327_orcamentos_trava_4h_auditoria_log.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260327_orcamentos_trava_4h_auditoria_log.sql)

O papel desta tabela é registrar eventos críticos por empresa:

- `empresa_id`
- `usuario_id`
- `data_hora`
- `valor_antigo` / `valor_novo` (jsonb)

Com o SaaS_Security_Shield:

- `auditoria_log.empresa_id` é forçado a `NOT NULL`
- é criada FK para `empresas(id) ON DELETE RESTRICT` se estiver faltando

## 6) Teste de Fogo (automação) 🔥✅

Existe um script de teste que executa o onboarding completo via `create-tenant-company` e valida:

- empresa criada
- usuário admin criado/vinculado
- permissões do admin são full access

Arquivo:

- [scripts/fire_test_onboarding.js](file:///c:/Projeto_TRAE/projeto_dp/scripts/fire_test_onboarding.js)

Pré-requisitos (variáveis de ambiente):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

O script faz login como SuperAdmin (Auth), chama a function e valida o registro em `usuario_empresas`.

