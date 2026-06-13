<br><br><br><br><br><br><br><br><br><br>

<h1 align="center">Manual do Administrador (Detalhado)</h1>
<h2 align="center">Odonto Connect Cloud (OCC) 🦷✨</h2>

<br><br><br>

<p align="center"><strong>Guia do Usuário: 25 Telas e Módulos (Campo a Campo)</strong></p>

<br><br><br><br><br><br><br><br><br><br>
<div style="page-break-after: always;"></div>

# Índice

- [Introdução](#introdução)
- [1. Dashboard](#1-dashboard-️)
- [2. Pacientes](#2-pacientes-)
- [3. Profissionais](#3-profissionais-)
- [4. Especialidades](#4-especialidades-)
- [5. Serviços](#5-serviços-)
- [6. Estoque: Inventário](#6-estoque--inventário-)
- [7. Estoque: Modelos de Uso](#7-estoque--modelos-de-uso-️)
- [8. Estoque: Vínculo de Serviços](#8-estoque--vínculo-de-serviços-)
- [9. Estoque: Movimentações](#9-estoque--movimentações-)
- [10. Estoque: Relatórios](#10-estoque--relatórios-)
- [11. Orçamentos](#11-orçamentos-)
- [12. Financeiro](#12-financeiro-)
- [13. Comissões](#13-comissões-)
- [14. Marketing](#14-marketing-)
- [15. Atendimento: Consulta / Avaliação](#15-atendimento--consulta--avaliação-)
- [16. Atendimento: Atend. Profissional](#16-atendimento--atend-profissional-)
- [17. Agenda](#17-agenda-)
- [18. Produção Protética](#18-produção-protética-)
- [19. Suporte / Tickets](#19-suporte--tickets-)
- [20. Usuários Admin](#20-usuários-admin-)
- [21. Empresas (Gestão de Redes)](#21-empresas-gestão-de-redes-)
- [22. Assinaturas](#22-assinaturas-)
- [23. Minha Clínica](#23-minha-clínica-)
- [24. Parâmetros Financeiros](#24-parâmetros-financeiros-️)
- [25. Orçamentos Cancelados](#25-orçamentos-cancelados-️)

<div style="page-break-after: always;"></div>

# Introdução 🔐
Bem-vindo(a)! Este guia definitivo e detalhado foi feito para você, Administrador(a) da Clínica. Aqui, explicamos o funcionamento **campo a campo** das exatas 25 telas e módulos que compõem o ecossistema do OCC.

---

# 1. Dashboard ⏱️
**Objetivo:** Visão executiva e indicadores em tempo real da unidade.
**Campos da Tela:**
- **Faturamento Diário/Mensal:** Cards mostrando a soma de receitas pagas no período.
- **Consultas do Dia:** Número total de agendamentos para a data atual.
- **Gráficos de Receitas vs Despesas:** Comparativo visual de lucratividade.
- **Inadimplência:** Alerta de pacientes com parcelas vencidas.

# 2. Pacientes 👤
**Objetivo:** Centralizar o cadastro e o prontuário de saúde.
**Campos da Tela:**
- **Nome, CPF/RG, Data de Nascimento:** Identificação básica (usada também no Marketing).
- **Telefone/WhatsApp e E-mail:** Canais de contato para a régua de relacionamento.
- **Endereço Completo:** CEP, Rua, Bairro e Cidade.
- **Anamnese (Histórico Médico):** Checkboxes para Alergias, Diabetes, Hipertensão, Medicamentos em uso e campo de texto livre para Observações Clínicas Críticas.

# 3. Profissionais 👥
**Objetivo:** Cadastrar a equipe clínica e definir regras financeiras.
**Campos da Tela:**
- **Nome e CRO:** Identificação oficial do dentista.
- **Especialidade Principal:** Área de atuação (ex: Ortodontista).
- **% de Comissão Padrão:** Porcentagem base que este profissional ganha sobre os serviços executados.
- **Cor na Agenda:** Seletor de cor para facilitar a visualização no calendário geral.

# 4. Especialidades 🧰
**Objetivo:** Categorizar as áreas de atendimento da clínica.
**Campos da Tela:**
- **Nome da Especialidade:** Ex: Implantodontia, Odontopediatria.
- **Descrição/Notas:** Detalhamento interno da área de atuação.

# 5. Serviços 🧾
**Objetivo:** Sua tabela de preços e procedimentos.
**Campos da Tela:**
- **Descrição do Serviço:** Nome comercial (ex: "Clareamento a Laser").
- **Valor Base:** Preço padrão de tabela (pode ser alterado no momento do orçamento).
- **Especialidade Vinculada:** Dropdown para associar o serviço à área correta.
- **Exige Odontograma:** Checkbox. Se marcado, o sistema obrigará o dentista a selecionar os dentes (elementos) ao orçar este serviço.

# 6. Estoque: Inventário 📦
**Objetivo:** Cadastrar os produtos físicos comprados pela clínica.
**Campos da Tela:**
- **Nome do Produto:** Ex: "Resina Z350".
- **Quantidade Atual:** Saldo físico na prateleira.
- **Estoque Mínimo:** Ponto de alerta para recompra.
- **Custo Unitário:** Valor pago pelo produto (base para relatórios de despesa).

# 7. Estoque: Modelos de Uso 🛠️
**Objetivo:** Criar "Kits" para facilitar a baixa no estoque.
**Campos da Tela:**
- **Nome do Kit:** Ex: "Kit Avaliação".
- **Itens do Kit:** Lista onde você adiciona produtos do Inventário (ex: 1 Luva, 1 Máscara, 1 Sugador).

# 8. Estoque: Vínculo de Serviços 🔗
**Objetivo:** A mágica da automação: ligar a tabela de preços aos materiais consumidos.
**Campos da Tela:**
- **Serviço Selecionado:** Escolha um serviço da sua tabela (ex: "Extração").
- **Materiais/Kits Vinculados:** O que deve ser descontado do estoque automaticamente quando o dentista marcar este serviço como "Concluído" no Atendimento.

# 9. Estoque: Movimentações 🔄
**Objetivo:** Registrar entradas e saídas manuais do estoque.
**Campos da Tela:**
- **Produto:** Seleção do item.
- **Tipo de Movimento:** Entrada (compra) ou Saída (perda/vencimento/uso extra).
- **Quantidade:** Volume movimentado.
- **Justificativa:** Motivo da ação (ex: "Nota Fiscal 123" ou "Material vencido").

# 10. Estoque: Relatórios 📊
**Objetivo:** Análise financeira do almoxarifado.
**Campos da Tela:**
- **Filtro de Período:** Datas de início e fim.
- **Status de Reposição:** Lista destacada em vermelho dos produtos que atingiram o "Estoque Mínimo" e precisam ser comprados.
- **Valor em Estoque:** Cálculo de (Quantidade x Custo Unitário) do capital imobilizado.

# 11. Orçamentos 📑
**Objetivo:** Criação, negociação e aprovação de planos de tratamento.
**Campos da Tela:**
- **Paciente e Profissional:** Vínculo de quem recebe e quem fará o tratamento.
- **Busca de Serviços:** Adição de itens da tabela de preços.
- **Odontograma Interativo:** Mapa dentário gráfico para seleção de elementos (dentes) afetados.
- **Valor Total e Desconto:** Campo para aplicar abatimentos em R$ ou %.
- **Status:** Pendente, Aprovado (quando pago) ou Cancelado.

# 12. Financeiro 💰
**Objetivo:** Controle total do fluxo de caixa.
**Campos da Tela:**
- **Nova Receita / Nova Despesa:** Botões de inserção.
- **Categoria:** Classificação da conta (Luz, Água, Material, Tratamento).
- **Data de Vencimento e Pagamento:** Controle de contas a pagar e inadimplência.
- **Forma de Pagamento:** Dropdown (Pix, Cartão de Crédito, Débito, Dinheiro).
- **Orçamentos Pendentes:** Fila de orçamentos aguardando o clique em "Receber" para liberar o paciente.

# 13. Comissões 💸
**Objetivo:** Fechamento de folha de pagamento dos dentistas parceiros.
**Campos da Tela:**
- **Profissional:** Filtro por dentista.
- **Mês de Referência:** Período de apuração.
- **Base de Cálculo:** O sistema cruza (Serviços marcados como Concluídos) x (Serviços Pagos pelo Paciente) x (% de Comissão do Dentista) para gerar o **Valor a Receber** final.

# 14. Marketing 📣
**Objetivo:** Régua de relacionamento e recuperação de pacientes.
**Campos da Tela:**
- **Filtro de Público:** Seleção de "Aniversariantes do Mês", "Pacientes Ausentes há 6 meses", etc.
- **Mensagem Personalizada:** Caixa de texto para digitar a campanha.
- **Disparo de WhatsApp:** Botão que abre a API do WhatsApp Web com o texto e o número do paciente já preenchidos.

# 15. Atendimento: Consulta / Avaliação 🩺
**Objetivo:** Tela do dentista para o primeiro contato e criação de novos orçamentos.
**Campos da Tela:**
- **Fila de Espera:** Lista de pacientes agendados para o dia que ainda NÃO possuem orçamento.
- **Adicionar Procedimento & Odontograma:** Mesmos campos do módulo de Orçamentos.
- **Salvar Avaliação:** Botão que converte a avaliação em um Orçamento Pendente para a recepção cobrar.

# 16. Atendimento: Atend. Profissional 🦷
**Objetivo:** Tela de execução diária do dentista.
**Campos da Tela:**
- **Pacientes Liberados:** Fila de quem já pagou/aprovou o orçamento.
- **Evolução Clínica:** Campo de texto livre para o prontuário do dia (o que foi feito, receitado, etc).
- **Checkboxes de Conclusão:** Lista de serviços do orçamento do paciente. O dentista marca "Concluído" ao terminar (o que gera a baixa de estoque e o gatilho de comissão).

# 17. Agenda 📅
**Objetivo:** Organização de tempo e cadeiras.
**Campos da Tela:**
- **Filtro por Profissional:** Visão individual ou de todos.
- **Calendário (Dia/Semana/Mês):** Grade visual de horários.
- **Novo Agendamento:** Seleção de Paciente, Data, Hora de Início/Fim e Serviço pretendido.
- **Status da Consulta:** Agendado, Confirmado, Aguardando na Recepção, Em Atendimento, Finalizado, Faltou.

# 18. Produção Protética 🏭
**Objetivo:** Rastreabilidade de laboratório.
**Campos da Tela:**
- **Paciente e Laboratório Parceiro:** Para quem é a peça e quem está fazendo.
- **Tipo de Peça:** Ex: "Coroa Porcelana Dente 21".
- **Datas:** Data de Envio e Data Prevista de Retorno.
- **Geração de QR Code:** Emite uma etiqueta para o motoboy. Ao ser escaneada, atualiza o status para "Recebido no Laboratório" ou "Entregue na Clínica".

# 19. Suporte / Tickets 🆘
**Objetivo:** Falar com a equipe de desenvolvimento do OCC.
**Campos da Tela:**
- **Assunto e Mensagem:** Descrição do erro ou dúvida.
- **Anexo:** Upload de prints de tela.
- **Status:** Aberto, Em Análise, Resolvido.

# 20. Usuários Admin 🔐
**Objetivo:** Criar os acessos (logins) para a equipe.
**Campos da Tela:**
- **E-mail do Colaborador:** Será o login.
- **Senha Inicial:** Definida por você.
- **Perfil de Acesso:** "Admin" (acesso total), "Recepção" (agenda e financeiro), "Dentista" (bloqueado na própria agenda e orçamentos), "Auxiliar" (estoque).

# 21. Empresas (Gestão de Redes) 🏢
**Objetivo:** Para donos de mais de uma clínica.
**Campos da Tela:**
- **Nova Unidade:** Permite cadastrar uma filial.
- **Chaveador de Unidades:** Botão no topo do sistema para alternar a visão (ver o faturamento da Clínica A ou da Clínica B de forma separada).

# 22. Assinaturas 📝
**Objetivo:** Gestão do seu plano OCC.
**Campos da Tela:**
- **Plano Atual:** Ex: "Plano Clínicas PRO".
- **Limites:** Quantidade de usuários cadastrados vs Permitidos no plano.
- **Faturas:** Histórico de pagamentos da mensalidade do software.

# 23. Minha Clínica 🏥
**Objetivo:** Configurações globais da unidade ativa.
**Campos da Tela:**
- **Razão Social, CNPJ, Telefone:** Dados oficiais.
- **Logotipo:** Upload de imagem (jpg/png) que passará a estampar o topo do sistema e os PDFs de orçamentos impressos.

# 24. Parâmetros Financeiros ⚙️
**Objetivo:** Automação de taxas.
**Campos da Tela:**
- **Taxas de Cartão:** Campo para informar os juros da sua maquininha (Débito, Crédito à Vista, Parcelado). O sistema usará isso para calcular o lucro líquido real no Financeiro.

# 25. Orçamentos Cancelados 🕵️
**Objetivo:** Auditoria e recuperação de vendas.
**Campos da Tela:**
- **Lista de Rejeitados:** Todos os orçamentos que os pacientes não fecharam.
- **Motivo do Cancelamento:** Dropdown (ex: "Achou caro", "Foi para a concorrência").
- **Valor Perdido:** Soma do dinheiro que não entrou. Essencial para o gestor traçar estratégias de descontos ou repescagem de clientes.