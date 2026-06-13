<br><br><br><br><br><br><br><br><br><br>

<h1 align="center">Documentação Técnica Oficial</h1>
<h2 align="center">Odonto Connect Cloud (OCC)</h2>

<br><br><br>

<p align="center"><strong>Relatório de Evolução e Especificações Técnicas</strong></p>

<br><br><br><br><br><br><br><br><br><br>
<div style="page-break-after: always;"></div>

# Índice

- [1. Resumo Executivo](#1-resumo-executivo)
- [2. Histórico Geral de Demandas (Changelog)](#2-histórico-geral-de-demandas-changelog)
  - [Fase 1: Arquitetura Base e Multi-Tenant (SaaS)](#fase-1-arquitetura-base-e-multi-tenant-saas)
  - [Fase 2: Evolução de Módulos Core (Regras de Negócio)](#fase-2-evolução-de-módulos-core-regras-de-negócio)
  - [Fase 3: Otimizações de UX e Performance (Fase Atual)](#fase-3-otimizações-de-ux-e-performance-fase-atual)
- [3. Especificação Técnica Atual](#3-especificação-técnica-atual)
  - [3.1 Fluxo Lógico de Dados (Data Flow)](#31-fluxo-lógico-de-dados-data-flow)
  - [3.2 Resumo das Permissões de Banco de Dados (Segurança e RLS)](#32-resumo-das-permissões-de-banco-de-dados-segurança-e-rls)
- [4. Guia de Manutenção e Boas Práticas](#4-guia-de-manutenção-e-boas-práticas)

<div style="page-break-after: always;"></div>

# Relatório de Evolução e Documentação Técnica - Odonto Connect Cloud (OCC)

## 1. Resumo Executivo
O Odonto Connect Cloud (OCC) é uma plataforma SaaS (Software as a Service) voltada para a gestão de clínicas odontológicas. O sistema foi construído no modelo Single Page Application (SPA), garantindo uma experiência rápida e fluida sem recarregamento total da página. O objetivo principal do OCC é centralizar todo o fluxo de trabalho de uma clínica — desde o agendamento e cadastro de pacientes, passando pela avaliação, aprovação de orçamentos, execução dos procedimentos pelo dentista e a parte de conciliação financeira, tudo com suporte a múltiplos perfis de acesso e divisão por empresas (Multi-Tenant).

## 2. Histórico Detalhado de Solicitações e Soluções (Changelog)

| Data Aproximada | Solicitação (O que eu pedi) | Solução Técnica (O que você executou) | Status |
| :--- | :--- | :--- | :--- |
| **Fase 1 (Início)** | **Isolamento de Dados por Clínica (Multi-Tenant)**<br>Garantir que uma clínica jamais veja dados de outra. | Criação da coluna `empresa_id` em todas as tabelas e aplicação do `SaaS_Security_Shield` nas views. | Concluído |
| **Fase 1** | **Políticas de Segurança e RLS**<br>Bloquear acesso não autorizado via banco de dados. | Configuração de regras no Supabase atrelando o `auth.uid()` ao `usuario_empresas`. | Concluído |
| **Fase 1** | **Integridade Referencial (Deleção Segura)**<br>Impedir exclusão de dados críticos (ex: apagar paciente com orçamento). | Aplicação de `ON DELETE RESTRICT` em tabelas financeiras e operacionais via scripts `fix_integrity`. | Concluído |
| **Fase 2** | **Trava de Proteção de Registros Padrão (P0001)**<br>Impedir edição ou exclusão de registros nativos do sistema. | Injeção de bloqueios na interface e banco de dados para perfis/IDs protegidos (como o P0001). | Concluído |
| **Fase 2** | **Correção no Botão "Adicionar Item"**<br>Evitar falhas/duplicações ao inserir itens no Orçamento. | Refatoração da função de adição de itens no DOM, garantindo a captura correta do Serviço e Valor. | Concluído |
| **Fase 2** | **Ocultar Menus para Dentistas (Single Ownership)**<br>Restringir a visão do dentista apenas à sua própria agenda. | Injeção da trava de `profissional_id` nas consultas (`loadTabData`) e ocultação de menus restritos. | Concluído |
| **Fase 2** | **Rastreabilidade de Próteses (Custódia)**<br>Acompanhar entrega de próteses com segurança. | Criação do fluxo de QR Code e tabelas `ordens_proteticas_eventos` para logs de recebimento. | Concluído |
| **Fase 3 (Hoje)** | **Atualização Automática de Fila (Refresh on Navigation)**<br>Remover a necessidade do F5 para ver orçamentos pagos. | Substituição do polling por *Refresh* acionado no clique de menu lateral (aba Atendimento). | Concluído |
| **Fase 3 (Hoje)** | **Combobox Dinâmico de Pacientes Falhando**<br>Fechava ao rolar o scroll e não aceitava maiúsculas. | Troca do evento `blur` por `mousedown` global, navegação por Setas e ignorância a *Case*. | Concluído |
| **Fase 3 (Hoje)** | **Avaliações Duplicadas (Blindagem)**<br>Dentista via paciente na Avaliação que já tinha orçamento. | Filtro em `ConsultaAvaliacao` bloqueando pacientes com orçamentos normais pendentes no dia. | Concluído |
| **Fase 3 (Hoje)** | **Otimização Extrema de Navegação (LoadTabData)**<br>O sistema estava muito pesado recarregando tudo. | Quebra do `initializeApp` em `loadGlobalData` e `loadTabData(tab)`, adicionando Cache Inteligente. | Concluído |

## 3. Especificação Técnica Atual

### 3.1 Fluxo Lógico de Dados (Data Flow)
O carregamento de dados do sistema funciona agora com uma arquitetura On-Demand / Just-in-Time acoplada ao sistema de navegação da SPA:

1. **Boot Inicial:** Ao entrar na página, o `initializeApp(false)` carrega a estrutura base, perfis e permissões (`loadGlobalData`) para construir o menu.
2. **Navegação (Click Event):** Quando o usuário clica em uma aba do menu (`setupNavigationListeners`):
   - **Cache Check:** Verifica `sessionStorage('lastTab')`. Se for igual ao destino, a transação é abortada e a tela é apenas renderizada a partir da memória.
   - **Session Validation:** Executa `loadGlobalData()` de forma levíssima, apenas para garantir que o token JWT não expirou.
   - **Targeted Fetch:** O `loadTabData(tab)` constrói dinamicamente um array de requisições `Promise.all` direcionadas. Por exemplo, se a aba for "Orçamentos", o Supabase recebe queries para: `pacientes`, `profissionais`, `especialidades`, `servicos`, `orcamentos` e `orcamento_itens`.
3. **Render:** A função `setActiveTab(tab)` desoculta (`display: block / flex`) a seção HTML correspondente e oculta as demais.

### 3.2 Resumo das Permissões de Banco de Dados (Segurança e RLS)
O sistema opera sob o conceito de Row Level Security (RLS) associado à regra Multi-Tenant (`empresa_id`). As lógicas no Frontend refletem as travas do banco:

- **SuperAdmin:** Visibilidade total (`isSuperAdmin`).
- **Administrador da Clínica:** Gerencia as configurações globais de sua `empresa_id` (financeiro, comissões, master data de serviços).
- **Supervisor:** Papel intermediário; possui senhas/pins para liberar orçamentos bloqueados e ações financeiras pontuais.
- **Dentista (Single Ownership):** Apenas enxerga sua agenda e, crucialmente, a listagem de Orçamentos é restrita aos orçamentos onde ele é o `profissional_id` atrelado (ou os de avaliação não direcionados, se aplicável à clínica).
- **Recepção:** Vê a agenda global, pode pré-criar orçamentos e aprovar pagamentos, mas não pode executar procedimentos odontológicos.

## 4. Guia de Manutenção e Boas Práticas

Para garantir a estabilidade do produto em futuras atualizações, siga rigorosamente:

1. **Alteração de Menus e Abas:** 
   - Sempre adicione o ID da nova aba no dicionário `navMapping` dentro de `setupNavigationListeners()`.
   - Inclua o novo ID no `loadTabData(tab)` mapeando exatamente quais tabelas do banco essa aba precisa carregar.
2. **Tratamento do Cache Inteligente:**
   - Evite recarregar dados forçosamente no meio de um formulário. Se o usuário salvar um formulário de paciente, faça a inserção no Supabase e atualize manualmente a array global de `patients` no JS, evitando chamar um refresh global de navegação.
3. **Evite Polling:**
   - Nunca use `setInterval` para bater no banco de dados. Caso o sistema demande atualizações "ao vivo" obrigatórias, migre o módulo para os *WebSockets* (Supabase Realtime).
4. **Preservação de Modal:**
   - Variáveis que controlam fluxo de telas sobrepostas (ex: `window.__isConsultaAvaliacaoMode`) devem sempre ser setadas para `false` no encerramento ou no clique de voltar (`showForm(false, ...)`), garantindo que lógicas de uma tela não invadam as propriedades de outra.
