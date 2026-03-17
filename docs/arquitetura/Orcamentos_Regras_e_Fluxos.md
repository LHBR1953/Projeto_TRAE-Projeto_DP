# Orçamentos — Regras de Negócio e Fluxos (Fonte do Sistema)

Este documento descreve o módulo **Orçamentos** do OCC (Odonto Connect Cloud) do ponto de vista do comportamento implementado no sistema (frontend JS + Supabase). O objetivo é servir como referência única para operação, homologação e evolução sem regressão.

Base complementar:
- Regras validadas (resumo): [Regras_de_Negocio.md](file:///c:/Projeto_TRAE/Projeto_DP/docs/arquitetura/Regras_de_Negocio.md)
- Mapa do app (tabelas e vínculos críticos): [Mapa_do_App.md](file:///c:/Projeto_TRAE/Projeto_DP/docs/arquitetura/Mapa_do_App.md)
- Manual do usuário (visão operacional): [manual_occ.html](file:///c:/Projeto_TRAE/Projeto_DP/docs/manual_occ.html#orcamentos)

---

## 1) Conceitos e entidades

### 1.1 Orçamento
- Cabeçalho administrativo do tratamento/cobrança.
- Guarda paciente, status global, tipo e responsável administrativo.

Tabela principal:
- `orcamentos`

Campos relevantes na UI:
- Paciente (uuid): `pacienteid` / `paciente_id`
- Paciente (exibição): `pacientenome`, `pacientecelular`
- Status: `status`
- Tipo: `tipo`
- Sequencial (numérico): `seqid` (usado como “ID do orçamento” em várias integrações)

### 1.2 Item de orçamento
- Cada item representa um procedimento (serviço + subdivisão), com executor.
- É o item que “anda” no fluxo clínico: Pendente → Liberado → Em Execução → Finalizado (ou Cancelado).

Tabela:
- `orcamento_itens`

Vínculo crítico:
- `orcamento_itens.orcamento_id` deve apontar para `orcamentos.id` para o embed `orcamento_itens(*)` funcionar corretamente.

### 1.3 Pagamento do orçamento
- Registro de pagamento feito no painel “Pagamentos & Liberação”.
- Em geral aponta para o orçamento por `orcamento_id = orcamentos.seqid` (numérico).

Tabela:
- `orcamento_pagamentos`

### 1.4 Financeiro (conta corrente)
O módulo Orçamentos integra o Financeiro em dois pontos:
- **Entrada** (pagamento do paciente): `financeiro_transacoes` com `tipo=CREDITO` e `categoria=PAGAMENTO` (quando forma ≠ “Saldo em Conta”).
- **Consumo** (liberação do serviço): `financeiro_transacoes` com `tipo=DEBITO` e `categoria=CONSUMO` (em orçamento cobrável).

Tabela:
- `financeiro_transacoes`

Chave de referência sensível:
- O orçamento costuma ser associado por `referencia_id = orcamentos.seqid` (e em alguns ambientes também `orcamento_id`).

### 1.5 Comissões
- Comissão nasce no momento da **liberação do item** (quando aplicável), com status PENDENTE.
- Pagamento de comissão é tratado em módulo próprio.

Tabela:
- `financeiro_comissoes`

### 1.6 Auditoria de cancelamento
- Todo cancelamento relevante deve deixar trilha de auditoria e gerar termo quando aplicável.

Tabela:
- `orcamento_cancelados`

---

## 2) Telas, formulários e “dependências internas” (UI)

### 2.1 Lista de Orçamentos
- View: `#budgetsListView`
- Busca: `#searchBudgetInput`
- Filtro de status: `#budgetStatusFilter`

HTML:
- [index.html](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L1109-L1167)

Render:
- [renderTable (budgets)](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L1479-L1548)

### 2.2 Formulário do Orçamento (master)
- View: `#budgetFormView`
- Form: `#budgetForm`
- Campos:
  - Paciente: `#budPacienteNome` + `#budPacienteId`
  - Status: `#budStatus`
  - Profissional responsável: `#budProfissionalId`
  - Tipo: `#budTipo`
  - Observações: `#budObservacoes`

HTML:
- [index.html](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L1169-L1358)

Dependências internas abertas dentro do form:
- Painel “Adicionar Item”: `#addBudgetItemPanel` (toggle `#btnToggleAddItem`)
- Grid de itens: `#budgetItemsTableBody`

### 2.3 Modal operacional: “Gestão de Pagamentos e Liberação”
É onde acontece o fluxo real de pagamento, liberação e finalização.

HTML (modal):
- [budgetDetailModal](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L2632-L2648)

Render e regras:
- [viewBudgetPayments](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L12806-L13063)

### 2.4 Modal de autorização superior (PIN)
Usado quando a liberação excede o valor pago no orçamento (apenas orçamento cobrável).

HTML:
- [supervisorAuthModal](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L2650-L2672)

Regra/acionamento:
- [releaseBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13339-L13499)

### 2.5 Termo de cancelamento
HTML:
- [cancellationTermModal](file:///c:/Projeto_TRAE/Projeto_DP/index.html#L2701-L2719)

Fluxo:
- [validateCancellation/processBudgetCancel](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13649-L13810)

---

## 3) Tipos de Orçamento (regra-mãe)

Fonte resumida: [Regras_de_Negocio.md](file:///c:/Projeto_TRAE/Projeto_DP/docs/arquitetura/Regras_de_Negocio.md#L7-L33)

### 3.1 Normal
- Tem cobrança.
- Aceita pagamentos.
- Liberação depende do saldo pago cobrir o item (ou autorização).
- Pode gerar comissão e consumo no financeiro.

### 3.2 Cortesia / Retrabalho
- Sem cobrança.
- Não aceita pagamentos.
- Não gera comissão.
- Não gera consumo no financeiro.
- Liberação é direta.

No código (exemplos):
- Bloqueio de pagamento: [recordBudgetPayment](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13161-L13166)
- Liberação automática: [releaseBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13455-L13458)

---

## 4) Status do orçamento e status do item

### 4.1 Status do orçamento (`orcamentos.status`)
Status em uso no UI:
- Pendente
- Aprovado
- Executado
- Finalizado
- Cancelado

Regras implementadas:
- **Pendente → Aprovado**
  - Ao registrar pagamento: [recordBudgetPayment](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13321-L13331)
  - Ao liberar primeiro item: [releaseBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13384-L13392)
- **Executado**
  - Quando todos os itens estiverem Finalizados: [finalizeBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13618-L13633)
- **Cancelado**
  - Fluxo de cancelamento (auditoria + estornos + ajustes): [processBudgetCancel](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13723-L13777)

### 4.2 Status do item (`orcamento_itens.status`)
Fluxo clínico esperado:
- Pendente → Liberado → Em Execução → Finalizado
- Cancelado (saída administrativa)

Regra operacional:
- Item “aparece” no Atendimento/Produção se for do executor e estiver elegível (não cancelado; em geral liberado/em execução/finalizado conforme contexto).

---

## 5) Fluxo principal (end-to-end)

```mermaid
flowchart TD
  A[Novo Orçamento] --> B[Adicionar itens e executores]
  B --> C[Salvar orçamento]
  C --> D[Pagamentos & Liberação]
  D --> E{Tipo do orçamento}
  E -->|Cortesia/Retrabalho| F[Liberar itens (direto)]
  E -->|Normal| G[Registrar pagamento]
  G --> H{Pago cobre item?}
  H -->|Sim| I[Liberar item]
  H -->|Não| J[PIN Supervisor/Admin]
  J --> I
  I --> K[Gerar comissão (se aplicável)]
  I --> L[Gerar consumo no financeiro (DEBITO/CONSUMO)]
  I --> M[Execução clínica]
  M --> N[Finalizar item]
  N --> O{Todos itens finalizados?}
  O -->|Sim| P[Orçamento Executado]
  O -->|Não| D
```

---

## 6) Pagamentos: regras e efeitos colaterais

### 6.1 Registrar pagamento (painel operacional)
Fluxo implementado em:
- [recordBudgetPayment](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13157-L13336)

Regras:
- Orçamento Cortesia/Retrabalho: não aceita pagamento.
- Validação de “teto”: pagamento não pode exceder o saldo do orçamento (com tolerância pequena por arredondamento).
- Forma “Saldo em Conta”:
  - valida saldo do paciente em `view_saldo_paciente`;
  - não cria crédito em `financeiro_transacoes` na hora do pagamento;
  - o “consumo” ocorrerá na liberação do item.

### 6.2 Espelho no Financeiro (quando aplicável)
Quando forma ≠ “Saldo em Conta”, o pagamento gera:
- `financeiro_transacoes`:
  - `tipo = CREDITO`
  - `categoria = PAGAMENTO`
  - `referencia_id = budget.seqid`

Trecho:
- [recordBudgetPayment (espelho financeiro)](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13292-L13319)

### 6.3 Alocação (rateio) do pagamento por item
O pagamento pode ser marcado com alocação manual:
- Tag na observação: `[AlocarItem:<itemId>]`
- Isso influencia relatórios de Movimentação Diária / Fechamento.

Infra de alocação:
- [buildAllocationsForBudget](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L10059-L10124)

---

## 7) Liberação do item: regra de ouro

Fluxo implementado em:
- [releaseBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13339-L13499)

Regras:
- Se orçamento for Cortesia/Retrabalho: libera direto.
- Se orçamento for Normal:
  - Calcula “valor já liberado” (soma de itens Liberado/Em Execução/Finalizado).
  - Calcula “valor deste item”.
  - Se `valorLiberado + valorItem > totalPago`:
    - Admin/Supervisor autoriza sem PIN adicional
    - Outros perfis: exige PIN da empresa
  - Caso liberado:
    - item.status = Liberado
    - orçamento Pendente pode virar Aprovado
    - gera comissão PENDENTE (se houver regra no profissional e orçamento cobrável)
    - gera consumo no financeiro (DEBITO/CONSUMO) no valor do item (orçamento cobrável)

Observação importante:
- O consumo no financeiro existe para representar “uso do crédito” e controlar saldo, não é o “pagamento”.

---

## 8) Comissão (quando nasce, quando não nasce)

Regra:
- Comissão é gerada na **liberação do item** (não na finalização).
- Não existe comissão para Cortesia/Retrabalho.

Trechos:
- Geração: [releaseBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13367-L13416)
- Garantia de comissão faltante ao abrir painel: [ensureBudgetCommissions](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13540-L13589)

---

## 9) Finalização do item e “Executado”

Finalização manual pelo painel:
- [finalizeBudgetItem](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13600-L13643)

Regras:
- Marca item como Finalizado.
- Se todos os itens do orçamento estiverem Finalizados:
  - muda `orcamentos.status` para Executado.

Nota operacional:
- O recomendado é finalizar pelo Atendimento (fonte clínica), mas o painel também permite “forçar” finalizado.

---

## 10) Cancelamento (com auditoria e estornos)

Ponto central:
- [validateCancellation/processBudgetCancel](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L13649-L13810)

Regras:
- Sempre grava log em `orcamento_cancelados`.
- Marca orçamento e itens como Cancelado.
- Se houve pagamento:
  - gera ESTORNO como crédito em conta (saldo do paciente aumenta).
  - reembolso real (saída de caixa) é um lançamento separado (REEMBOLSO).
- Comissões:
  - pendentes são removidas/estornadas;
  - pagas exigem fluxo mais sensível (caso crítico).

---

## 11) Relatórios que dependem do Orçamento

### 11.1 Movimentação diária
Mostra pagamentos do dia alocados nos itens do orçamento (respeitando alocação manual e saldo restante).

Função:
- [printMovimentacaoDiaria](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L10153-L10339)

### 11.2 Fechamento diário (completo)
Consolida produção, financeiro, conciliação e pendências.

Componentes críticos:
- Agenda do dia: [fetchAgendaRowsForFechamento](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L4021-L4033)
- Itens por agenda/executor: [buildAtendimentoRowsFromAgenda](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L4035-L4096)

---

## 12) “Não pode quebrar” (invariantes)

- O orçamento precisa ter `seqid` válido e consistente (é a ponte para pagamentos e financeiro).
- `orcamento_itens.orcamento_id` deve ser o `orcamentos.id` (UUID).
- `orcamento_pagamentos.orcamento_id` deve ser o `orcamentos.seqid` (BIGINT).
- O paciente precisa existir em duas chaves coerentes:
  - `pacientes.id` (UUID) e `pacientes.seqid` (numérico) porque:
    - Orçamentos usam UUID em alguns pontos
    - Financeiro usa `paciente_id` numérico (seqid)

---

## 13) Troubleshooting rápido

- “Não libera item mesmo com pagamento”
  - Verificar total pago do orçamento (não confundir com saldo do paciente).
  - Verificar se já existem itens liberados (valorLiberado cresce).
  - Verificar perfil do usuário e PIN do supervisor na empresa.

- “Pagamento aparece no Financeiro mas não aparece no Orçamento”
  - Pode existir pagamento apenas em `financeiro_transacoes` e não em `orcamento_pagamentos`.
  - O painel tenta puxar pagamentos do financeiro por `referencia_id/orcamento_id` e deduplicar por valor+forma+data: [viewBudgetPayments](file:///c:/Projeto_TRAE/Projeto_DP/app_v20.js#L12820-L12857)

- “PAGAMENTO negativo em relatórios”
  - Débitos de consumo não devem ficar na categoria PAGAMENTO; devem ser CONSUMO.

