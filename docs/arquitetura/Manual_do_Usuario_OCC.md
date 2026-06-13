<br><br><br><br><br><br><br><br><br><br>

<h1 align="center">Manual de Operação Completo</h1>
<h2 align="center">Odonto Connect Cloud (OCC)</h2>

<br><br><br>

<p align="center"><strong>Versão Atualizada: Todos os Módulos</strong></p>

<br><br><br><br><br><br><br><br><br><br>
<div style="page-break-after: always;"></div>

# Índice

- [1. Introdução](#1-introdução)
- [2. Cadastros Base](#2-cadastros-base)
  - [2.1 Pacientes](#21-pacientes)
  - [2.2 Profissionais](#22-profissionais)
  - [2.3 Especialidades](#23-especialidades)
  - [2.4 Serviços](#24-serviços)
- [3. Agenda e Atendimento](#3-agenda-e-atendimento)
  - [3.1 Agenda](#31-agenda)
  - [3.2 Consulta / Avaliação](#32-consulta--avaliação)
  - [3.3 Atend. Profissional](#33-atend-profissional)
- [4. Orçamentos e Financeiro](#4-orçamentos-e-financeiro)
  - [4.1 Orçamentos](#41-orçamentos)
  - [4.2 Financeiro](#42-financeiro)
  - [4.3 Comissões](#43-comissões)
- [5. Gestão de Estoque](#5-gestão-de-estoque)
  - [5.1 Inventário](#51-inventário)
  - [5.2 Modelos de Uso](#52-modelos-de-uso)
  - [5.3 Vínculo de Serviços](#53-vínculo-de-serviços)
  - [5.4 Movimentações](#54-movimentações)
  - [5.5 Relatórios de Estoque](#55-relatórios-de-estoque)
- [6. Ferramentas Avançadas](#6-ferramentas-avançadas)
  - [6.1 Produção Protética](#61-produção-protética)
  - [6.2 Marketing](#62-marketing)
  - [6.3 Dashboard](#63-dashboard)
- [7. Resolução de Problemas Comuns](#7-resolução-de-problemas-comuns)

<div style="page-break-after: always;"></div>

# 1. Introdução
Bem-vindo(a) ao Odonto Connect Cloud (OCC)! Este manual completo foi criado para ajudar você a dominar todas as telas e módulos do sistema. Aqui você aprenderá desde o cadastro de um paciente até o controle de estoque e produção de próteses.

---

# 2. Cadastros Base

## 2.1 Pacientes
**Objetivo da Tela:** Centralizar todas as informações das pessoas atendidas na clínica.
**Guia de Campos:** 
- **Dados Pessoais:** Nome, CPF, Data de Nascimento e Contatos.
- **Anamnese/Histórico:** Alergias, medicamentos em uso e observações de saúde.
**Fluxo de Trabalho:** 1. Clique em "Novo Paciente". 2. Preencha os dados obrigatórios. 3. Salve para que ele fique disponível para agendamentos e orçamentos.

## 2.2 Profissionais
**Objetivo da Tela:** Cadastrar a equipe da clínica (Dentistas, Recepcionistas, Gerentes).
**Guia de Campos:** 
- **Perfil de Acesso:** Define o que a pessoa pode ver (ex: Dentista só vê a própria agenda).
- **Dados Profissionais:** CRO, especialidades atendidas e comissionamento padrão.

## 2.3 Especialidades
**Objetivo da Tela:** Categorizar os tratamentos da clínica (ex: Ortodontia, Implantodontia, Clínica Geral).
**Fluxo de Trabalho:** Cadastre a especialidade antes de criar os serviços, para que o sistema organize os relatórios financeiros por área.

## 2.4 Serviços
**Objetivo da Tela:** É a sua Tabela de Preços. Aqui ficam os procedimentos que a clínica oferece.
**Guia de Campos:** 
- **Descrição:** Nome do serviço (ex: Restauração Resina 1 Face).
- **Valor Base:** Preço padrão cobrado pelo serviço.
- **Especialidade Vinculada:** A qual área este serviço pertence.

---

# 3. Agenda e Atendimento

## 3.1 Agenda
**Objetivo da Tela:** Organizar os horários de todos os profissionais.
**Fluxo de Trabalho:** 
1. Escolha o Profissional e a Data.
2. Clique no horário livre, busque o paciente e informe o procedimento.
3. Atualize o status (Agendado, Confirmado, Aguardando, Em Atendimento).

## 3.2 Consulta / Avaliação
**Objetivo da Tela:** Tela do dentista para o primeiro contato com o paciente e criação do plano de tratamento (orçamento).
**Fluxo de Trabalho:** 
1. Chame o paciente agendado.
2. Adicione os procedimentos que ele precisa realizar e os dentes afetados.
3. Clique em "Salvar Avaliação" (isso gera um orçamento que vai para a recepção cobrar).

## 3.3 Atend. Profissional
**Objetivo da Tela:** Onde o dentista registra a execução clínica dos procedimentos que já foram pagos/aprovados.
**Fluxo de Trabalho:** 
1. Veja a fila de pacientes com orçamentos já aprovados e liberados para execução.
2. Escreva a Evolução Clínica (prontuário).
3. Marque os itens executados hoje como "Concluídos" e salve.

---

# 4. Orçamentos e Financeiro

## 4.1 Orçamentos
**Objetivo da Tela:** Listar todos os planos de tratamento criados (aprovados, pendentes ou rejeitados).
**Fluxo de Trabalho:** A recepção usa esta tela para imprimir o orçamento para o paciente assinar, conceder descontos e iniciar a negociação.

## 4.2 Financeiro
**Objetivo da Tela:** Controlar o fluxo de caixa (Entradas e Saídas).
**Fluxo de Trabalho (Recebimento):** 
1. Localize o orçamento pendente do paciente.
2. Adicione o pagamento (Cartão, Pix, Dinheiro). 
3. Ao confirmar, o sistema libera automaticamente os procedimentos para o dentista executar na tela de Atendimento.

## 4.3 Comissões
**Objetivo da Tela:** Calcular o repasse financeiro para os dentistas parceiros.
**Fluxo de Trabalho:** O sistema cruza os serviços "Executados" pelo dentista com os "Pagos" pelo paciente, gerando o valor exato que o profissional deve receber no final do mês.

---

# 5. Gestão de Estoque

## 5.1 Inventário
**Objetivo da Tela:** Cadastro dos produtos físicos da clínica (Luvas, Resinas, Anestésicos).
**Guia de Campos:** Quantidade atual, Estoque Mínimo (alerta de compra) e Custo.

## 5.2 Modelos de Uso
**Objetivo da Tela:** Criar "Kits" de materiais (ex: Kit Avaliação = 1 par de luvas + 1 babador + 1 máscara).
**Fluxo de Trabalho:** Facilita a baixa no estoque, agrupando produtos que saem juntos.

## 5.3 Vínculo de Serviços
**Objetivo da Tela:** A "Mágica" do estoque automatizado.
**Fluxo de Trabalho:** Você liga um Serviço (ex: Restauração) a um Material (ex: Resina). Quando o dentista marca o serviço como "Concluído" no Atendimento, o sistema dá baixa na Resina automaticamente!

## 5.4 Movimentações
**Objetivo da Tela:** Registrar entradas (compras) e saídas manuais (perdas/vencimento) com justificativa.

## 5.5 Relatórios de Estoque
**Objetivo da Tela:** Mostrar o que precisa ser comprado urgentemente (abaixo do mínimo) e o custo do estoque parado.

---

# 6. Ferramentas Avançadas

## 6.1 Produção Protética
**Objetivo da Tela:** Rastrear trabalhos enviados ao laboratório de prótese.
**Fluxo de Trabalho:**
1. Crie o pedido de prótese vinculado a um paciente.
2. Imprima a via com QR Code para o motoboy.
3. Acompanhe se o molde está no laboratório ou se a peça já retornou para a clínica.

## 6.2 Marketing
**Objetivo da Tela:** Relacionamento com os pacientes.
**Fluxo de Trabalho:** Extraia listas de aniversariantes do mês ou pacientes que não retornam há mais de 6 meses para enviar mensagens no WhatsApp e lotar a agenda.

## 6.3 Dashboard
**Objetivo da Tela:** Painel de controle para os gestores (Faturamento, quantidade de consultas, inadimplência e metas).

---

# 7. Resolução de Problemas Comuns

- **Fiz a Avaliação, mas o paciente sumiu da tela. Onde ele está?**
  *Solução:* Ele virou um Orçamento. Vá para a tela de "Orçamentos" ou "Financeiro" para aprovar/receber. Depois do pagamento, ele aparecerá na fila de "Atendimento".
- **O paciente não aparece na busca do Orçamento.**
  *Solução:* Tente usar a busca dinâmica (basta digitar parte do nome) ou certifique-se de que o paciente já foi cadastrado na aba "Pacientes".
- **A tela parece desatualizada.**
  *Solução:* O sistema tem atualização inteligente ("Refresh on Navigation"). Basta clicar novamente na aba (ex: Atendimento) no menu lateral e os dados mais recentes aparecerão na hora, sem precisar apertar F5.