<div style="text-align: center; padding-top: 300px; padding-bottom: 300px;">
    <h1>Documentação Técnica Oficial</h1>
    <h2>Odonto Connect Cloud (OCC)</h2>
    <br><br><br>
    <p><strong>Relatório de Evolução e Especificações Técnicas</strong></p>
</div>

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

## 2. Histórico Histórico Geral de Demandas (Changelog)

### Fase 1: Arquitetura Base e Multi-Tenant (SaaS)
| Demanda Solicitada | Solução Técnica Implementada | Objetivo Atendido |
| :--- | :--- | :--- |
| **Isolamento de Dados por Clínica (Multi-Tenant)** | Criação da coluna `empresa_id` em todas as tabelas operacionais e aplicação do `SaaS_Security_Shield`. | Garantir que uma clínica jamais veja dados (pacientes, orçamentos, financeiro) de outra clínica. |
| **Políticas de RLS (Row Level Security)** | Configuração de regras no banco (Supabase) atrelando o `auth.uid()` ao `usuario_empresas`. | Segurança no nível de banco de dados contra vazamento de dados, mesmo em caso de falha no frontend. |
| **Onboarding Automatizado de Novas Clínicas** | Criação da Edge Function `create-tenant-company`. | Permitir a criação de novos "Tenants" (empresas) e geração do primeiro usuário Admin de forma automatizada. |
| **Integridade Referencial (Deleção Segura)** | Aplicação de `ON DELETE RESTRICT` em tabelas críticas via scripts `fix_integrity`. | Impedir que entidades-mãe (ex: empresas, pacientes) sejam apagadas se possuírem histórico financeiro ou orçamentos. |

### Fase 2: Evolução de Módulos Core (Regras de Negócio)
| Demanda Solicitada | Solução Técnica Implementada | Objetivo Atendido |
| :--- | :--- | :--- |
| **Single Ownership de Orçamentos (Visão do Dentista)** | Injeção da trava de `profissional_id` nas consultas de `loadTabData` e no `initializeApp`. | Garantir que dentistas só enxerguem e interajam com orçamentos/agendamentos atrelados a eles mesmos. |
| **Módulo de Prótese e Custódia (QR Code)** | Criação de tabelas `ordens_proteticas_eventos` e fluxo de validação de tokens via QR Code. | Rastreabilidade física de moldes e próteses entre o laboratório e a clínica, com prova de recebimento. |
| **Logs e Auditoria de Sistema** | Criação da tabela `auditoria_log` acoplada às triggers de banco de dados. | Rastreamento inalterável de "quem alterou o que e quando", vital para compliance financeiro e de saúde. |

### Fase 3: Otimizações de UX e Performance (Fase Atual)
| Demanda Solicitada | Solução Técnica Implementada | Objetivo Atendido |
| :--- | :--- | :--- |
| **Atualização em Tempo Real (Fila de Atendimento)** | Substituição da necessidade do F5 por "Refresh on Navigation" no menu lateral. | Garantir que o dentista veja os orçamentos pagos em tempo real ao transitar entre abas, sem o uso de polling que afogaria o servidor. |
| **Correção do Bug do Combobox de Busca de Paciente** | Implementação de busca com ignorância a *Case* (`normalizeKey`), navegação via setas (ArrowDown/Up) e controle de foco no scroll. | Melhorar a UX na criação de orçamentos; impedir que o combobox feche erroneamente e garantir que a busca encontre qualquer variação do nome. |
| **Blindagem de Criação de Avaliações Duplicadas** | Filtro na view de `ConsultaAvaliacao` bloqueando pacientes que já possuam orçamentos normais (não concluídos/cancelados) no mesmo dia. | Prevenir que o profissional inicie uma avaliação e duplique orçamentos que já foram pré-cadastrados pela recepção. |
| **Otimização Extrema de Navegação e Carga de Dados** | Quebra do pesado `initializeApp` em `loadGlobalData` (sessão) e `loadTabData(tab)`. Adição de "Cache Inteligente" para bloquear re-fetch na mesma aba. | Reduzir o peso computacional (e financeiro) de leituras no Supabase. Reduzir a latência do clique de navegação de segundos para milissegundos. |

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
