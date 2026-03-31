# OCC — Histórico Técnico e Log de Segurança (SaaS)

Este documento registra o estado técnico atual do OCC (OdontoClinic Cloud) no que diz respeito a Multi-empresa (SaaS), integridade referencial e onboarding automatizado.

## 1) Visão Geral do Modelo SaaS

- O OCC é Multi-empresa via coluna `empresa_id` nas tabelas operacionais.
- A tabela `empresas` é o “root tenant”.
- O vínculo usuário↔empresa é feito via `usuario_empresas` (com `perfil` e `permissoes`).

## 2) Blindagem SaaS: RESTRICT + NOT NULL + FKs (SaaS_Security_Shield)

### Objetivo

Impedir exclusão acidental de uma empresa com dados vinculados (LGPD/robustez SaaS) e garantir que todas as tabelas operacionais:

- tenham `empresa_id`
- tenham `empresa_id NOT NULL`
- tenham FK `empresa_id → empresas(id)` com `ON DELETE RESTRICT`

### Migration

- [20260328_saas_security_shield.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_saas_security_shield.sql)

### O que a migration faz

1) Para cada tabela do “lote” (lista abaixo), se a tabela existir no schema `public`:
   - Falha se `empresa_id` não existir
   - Falha se existir qualquer linha com `empresa_id IS NULL`
   - Converte `empresa_id` para `NOT NULL`
   - Cria FK `empresa_id → empresas(id) ON DELETE RESTRICT` se não existir

2) Blindagem global de FKs para `empresas`:
   - Varre todas as FKs no schema `public` que referenciam `public.empresas`
   - Recria todas com `ON DELETE RESTRICT` (mantendo colunas e regras de update/deferrable/not valid quando aplicável)

### Tabelas no lote (blindagem `empresa_id` + FK + NOT NULL)

O lote atualmente inclui (se existir no banco, será aplicado):

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

Além do lote acima (29 tabelas operacionais), a tabela `empresas` é o “root tenant” e recebe blindagem específica via RLS (seções 3 e 4). Total de entidades protegidas no escopo SaaS: 30 (29 operacionais + `empresas`).

### Observação sobre marketing

O módulo de marketing possui tabelas com `empresa_id` e políticas próprias. A blindagem assegura que `empresa_id`:

- exista
- seja `NOT NULL`
- esteja protegido por FK `ON DELETE RESTRICT`

## 3) Regras de Segurança de `empresas` (SuperAdmin vs Admin)

### Objetivo

Impedir que o Admin da clínica:

- acesse/cadastre outras empresas
- faça operações de escrita em `empresas`

### Migration (RLS Guard)

- [20260328_empresas_rls_guard.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_empresas_rls_guard.sql)
 - [20260328_rpc_update_empresa_profile.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_rpc_update_empresa_profile.sql)

### Regras aplicadas

- `SELECT` em `empresas`:
  - permitido se o usuário estiver vinculado àquela empresa em `usuario_empresas`
  - ou se o usuário for SuperAdmin
- `INSERT/UPDATE/DELETE` em `empresas`:
  - permitido somente para SuperAdmin

### Atualização de perfil da própria clínica (Admin)

Para reduzir dependência de suporte, existe um RPC que permite ao Admin da clínica atualizar apenas dados do próprio cadastro (nome/email/telefone/celular/logotipo), sem expor o módulo de “Cadastro de Empresas”:

- `public.rpc_update_empresa_profile(...)` (security definer) com verificação `is_admin_of_empresa(...)`/`is_superadmin()`


## 4) Campos e Unicidade de `empresas` (Identificador/Slug)

### Objetivo

Padronizar o cadastro de empresas:

- `identificador` (slug/login/URL) deve ser `NOT NULL` e `UNIQUE`
- `nome`, `email`, `assinatura_status` devem ser `NOT NULL`

### Migration

- [20260328_empresas_security_fields.sql](file:///c:/Projeto_TRAE/projeto_dp/supabase/migrations/20260328_empresas_security_fields.sql)

### Observação de migração (dados legados)

Para permitir execução em bases com dados antigos, a migration preenche automaticamente:

- `identificador = id` quando vazio/nulo
- `email = contato+<id>@occ.local` quando vazio/nulo
- `assinatura_status = ATIVA` quando vazio/nulo

Depois, aplica `NOT NULL` e `UNIQUE (identificador)` e falha se houver duplicidade de `identificador`.

## 5) Onboarding Automatizado (Empresa + Admin + Permissões)

### Objetivo

Ao cadastrar uma nova clínica (empresa), criar automaticamente:

- registro em `empresas`
- usuário Administrador no Supabase Auth (email = email da empresa, email confirmado)
- vínculo em `usuario_empresas` com `perfil = admin` e permissões “full access”

### Implementação (Edge Function)

- [create-tenant-company](file:///c:/Projeto_TRAE/projeto_dp/supabase/functions/create-tenant-company/index.ts)

### Quem pode executar

- Somente o SuperAdmin (por email fixo configurado na função).

### Fluxo resumido

1) Valida caller (token) e exige SuperAdmin
2) Insere empresa em `empresas`
3) Cria usuário no Auth (ou reutiliza e atualiza senha se já existir)
4) Faz upsert em `usuario_empresas` com:
   - `perfil = admin`
   - `permissoes = full`
5) Retorna mensagem de sucesso e senha inicial do admin

### Integração no Front-end

- O formulário de `empresas` chama a edge function ao salvar uma NOVA empresa.
- Referência: [app_v20.js](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L14123-L14206)

## 6) Restrições de UI (Menu de SuperAdmin)

Mesmo antes do RLS, o front-end já esconde o menu de empresas e bloqueia navegação para não-superadmin:

- `navEmpresas` aparece apenas se `isSuperAdmin === true`
- `can('empresas', ...)` retorna `false` para quem não for SuperAdmin

Referência:

- [can](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L353-L366)
- [updateSidebarVisibility](file:///c:/Projeto_TRAE/projeto_dp/app_v20.js#L1910-L1974)

## 7) Checklist de Deploy (ordem recomendada)

1) Aplicar migrations de campos/segurança de empresa:
   - `20260328_empresas_security_fields.sql`
   - `20260328_empresas_rls_guard.sql`
   - `20260328_rpc_update_empresa_profile.sql`
2) Aplicar blindagem SaaS:
   - `20260328_saas_security_shield.sql`
3) Publicar Edge Function:
   - `create-tenant-company`
