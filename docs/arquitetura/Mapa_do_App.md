# Mapeamento do App — OCC (Odonto Connect Cloud)

Data: 2026-03-12  
Entrypoints: [index.html](file:///c:/Projeto_TRAE/Projeto_DP/index.html) + [app_v20.js](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js)  
Servidor local: [serve.js](file:///c:/Projeto_TRAE/Projeto_DP/serve.js) / [serve.bat](file:///c:/Projeto_TRAE/Projeto_DP/serve.bat)

## 1) Visão geral (arquitetura)
- Frontend: HTML/CSS/JS “vanilla”, sem bundler, sem framework.
- Backend: Supabase (Auth + PostgREST + SQL/RLS).
- Regra de negócio “de verdade” está espalhada em:
  - UI (JS) + constraints/RLS (SQL).
  - Alguns fluxos gravam em mais de uma tabela (ex.: orçamento + financeiro).

## 2) Entradas e carregamento
- A página carrega:
  - CSS: [styles.css](file:///c:/Projeto_TRAE/Projeto_DP/styles.css)
  - Supabase JS v2: `https://unpkg.com/@supabase/supabase-js@2`
  - App: [app_v20.js](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js)
- A versão efetiva do frontend é controlada por:
  - `APP_BUILD` em [app_v20.js](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js)
  - querystring `?v=` em [index.html](file:///c:/Projeto_TRAE/Projeto_DP/index.html)

## 3) Autenticação, empresa (contexto) e permissões
- Auth: `db.auth.signInWithPassword`, `db.auth.getSession`, `db.auth.signOut`
- Contexto da empresa:
  - Definido em `currentEmpresaId` via tabela `usuario_empresas`
  - Admin master usa `lastEmpresaId` no `localStorage`
- Permissões:
  - Centralizadas em `can(modulo, acao)` (e também reforçadas por RLS)
- Pontos críticos:
  - Se `currentEmpresaId` estiver `null`, o app não carrega módulos.
  - Parte das queries filtra por `empresa_id` apenas quando `!isSuperAdmin`.

Arquivos e trechos:
- Sessão + mapeamento: [checkAuth](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L136-L251)
- Carregamento inicial: [initializeApp](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L373-L585)
- Login/Logout: [AUTH LOGIC](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L6091-L6127)

## 4) Navegação e telas
### Sidebar (botões)
IDs principais no HTML:
- Pacientes: `navPatients`
- Profissionais: `navProfessionals`
- Especialidades: `navSpecialties`
- Serviços: `navServices`
- Orçamentos: `navBudgets`
- Financeiro: `navFinanceiro`
- Comissões: `navCommissions`
- Agenda: `navAgenda`
- Auditoria (cancelados): `navCancelledBudgets`
- Equipe/usuários: `navUsersAdmin`
- Empresas: `navEmpresas`

### Views (seções principais)
Views existentes no HTML:
- `patientListView`, `patientFormView`, `patientDetailsView`
- `professionalListView`, `professionalFormView`
- `specialtiesListView`, `specialtyFormView`
- `servicesListView`, `serviceFormView`
- `budgetsListView`, `budgetFormView`
- `financeiroView`
- `commissionsView`
- `agendaView`
- `usersAdminView`, `userAdminFormView`
- `empresasListView`, `empresaFormView`
- `cancelledBudgetsView`

Fonte: [index.html (sections)](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L210-L1860)

### Padrão de UI (list/form)
- Alternância é feita via `showList(type)` / `showForm(editMode, type)`.
- Renderização de tabelas é centralizada em `renderTable(data, type)`.

## 5) Estado global (memória)
Coleções carregadas no boot (em memória):
- `patients`, `professionals`, `specialties`, `services`, `budgets`, `transactions`
- `activeEmpresasList` (admin)

Isso significa:
- Muitas telas usam estado local + `renderTable` e não reconsultam o banco a cada ação.
- Erros comuns surgem quando o banco muda (schema/cache) e o JS ainda assume relações antigas.

## 6) Módulos e fluxos (o que cada um faz)
### 6.1 Pacientes
- CRUD em `pacientes`
- Detalhes (Prontuário) em `patientDetailsView`
- Prontuário digital (append-only):
  - `paciente_evolucao`
  - `paciente_documentos`

### 6.2 Profissionais
- CRUD em `profissionais`
- Agenda do profissional:
  - disponibilidade: `agenda_disponibilidade`

### 6.3 Especialidades + subdivisões
- CRUD em `especialidades`
- Subdivisões em `especialidade_subdivisoes`

### 6.4 Serviços/Itens
- CRUD em `servicos`

### 6.5 Orçamentos (Gestão + Pagamentos + Liberação)
Tabelas:
- `orcamentos`
- `orcamento_itens`
- `orcamento_pagamentos`

Fluxos:
- Criar/editar orçamento e itens
- Registrar pagamento do orçamento (gera/atualiza status; e pode refletir no financeiro dependendo do método)
- Liberação/consumo de item
- Cancelamento e auditoria:
  - `orcamento_cancelados` (termos / reimpressão)

### 6.6 Financeiro (Conta corrente)
Tabelas:
- `financeiro_transacoes`
- View de saldo: `view_saldo_paciente`

Categorias típicas: `PAGAMENTO`, `TRANSFERENCIA`, `ESTORNO`, `REEMBOLSO`

### 6.7 Comissões
Tabela:
- `financeiro_comissoes`

### 6.8 Admin (Equipe e Empresas)
- Equipe por empresa:
  - `usuario_empresas`
  - função Supabase: [create-tenant-user](file:///c:/Projeto_TRAE/Projeto_DP/supabase/functions/create-tenant-user/index.ts)
- Empresas (unidades):
  - `empresas`

## 7) Banco de dados (tabelas usadas no app)
Extraído do código (todas as chamadas `db.from('...')` em [app_v20.js](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js)):
- agenda_agendamentos
- agenda_disponibilidade
- empresas
- especialidade_subdivisoes
- especialidades
- financeiro_comissoes
- financeiro_transacoes
- orcamento_cancelados
- orcamento_itens
- orcamento_pagamentos
- orcamentos
- paciente_documentos
- paciente_evolucao
- pacientes
- profissionais
- servicos
- usuario_empresas
- view_saldo_paciente

## 8) Vínculos críticos (onde não pode “quebrar”)
### 8.1 Orçamento ↔ Itens
- `orcamento_itens.orcamento_id` deve referenciar `orcamentos.id` (para embed `orcamento_itens(*)` funcionar).

### 8.2 Pagamentos do Orçamento ↔ Orçamento
- `orcamento_pagamentos.orcamento_id` normalmente é o `orcamentos.seqid` (BIGINT).

### 8.3 Financeiro ↔ Orçamento (muito sensível)
- Parte do histórico financeiro aponta para o orçamento via:
  - `referencia_id` (BIGINT, usado como “orcamento seqid” em várias telas)
  - `orcamento_id` (se existir na tabela em alguns ambientes/scripts)
- Por isso o sistema pode ter pagamento:
  - apenas no Financeiro (sem espelho em `orcamento_pagamentos`), ou
  - apenas em `orcamento_pagamentos`, ou
  - em ambos.

## 9) Regras de integridade e RLS (onde ficam)
- Migrações e scripts SQL:
  - Prontuário: [20260306_prontuario_digital.sql](file:///c:/Projeto_TRAE/Projeto_DP/supabase/migrations/20260306_prontuario_digital.sql)
  - Financeiro: [financeiro_conta_corrente_fase3.sql](file:///c:/Projeto_TRAE/Projeto_DP/financeiro_conta_corrente_fase3.sql)
  - Pagamentos: [orcamento_pagamentos_fase3.sql](file:///c:/Projeto_TRAE/Projeto_DP/orcamento_pagamentos_fase3.sql)
  - RLS: [rls_fix_visibility.sql](file:///c:/Projeto_TRAE/Projeto_DP/rls_fix_visibility.sql)
  - Integridade RESTRICT (proposta): [20260312_integridade_referencial_restrict.sql](file:///c:/Projeto_TRAE/Projeto_DP/sql/20260312_integridade_referencial_restrict.sql)

## 10) “Não mexer no que funciona” — como evoluir sem regressão
Este repositório é “monolito” em um arquivo JS grande, com alto acoplamento. Para implementar coisas novas sem quebrar:
- Prefira adicionar funções novas e chamar por “hook”/integração, em vez de reescrever funções existentes.
- Evite alterar a forma como um módulo escreve dados (ex.: não trocar de tabela/fonte sem migrar e validar).
- Quando precisar ajustar uma regra, use:
  - feature-flag (ex.: `window.__dpFlags = { ... }`)
  - fallback (ex.: tentar 1º caminho, se falhar usar 2º)
  - UI-only primeiro, banco depois (com script de rollback)

Ver também: [Regras do Projeto](file:///c:/Projeto_TRAE/Projeto_DP/.trae/rules/project_rules.md)

