# Manual do Usuário — OCC (Odonto Connect Cloud)

## Sumário
- Visão geral
- Como abrir o sistema (localhost)
- Login e perfil de acesso
- Navegação (menu)
- Pacientes
- Profissionais
- Especialidades e subdivisões
- Serviços/Itens
- Orçamentos
- Cancelamento de orçamento e termo
- Financeiro (conta corrente do paciente)
- Comissões
- Auditoria: Orçamentos cancelados (reimpressão)
- Gerenciar equipe (usuário_empresas)
- Boas práticas e solução de problemas

---

## Visão geral
O OCC (Odonto Connect Cloud) é um sistema local (executado no seu computador via navegador) com dados em nuvem (Supabase). Ele organiza:
- Cadastro de pacientes, profissionais, especialidades e itens/serviços
- Orçamentos e pagamentos
- Conta corrente do paciente (saldo/transferências/reembolsos)
- Auditoria de cancelamentos (com termo e reimpressão)
- Controle de equipe e permissões por empresa (multiunidade)

---

## Como abrir o sistema (localhost)
O sistema roda no navegador em `http://localhost:8282/`.

1) Execute o arquivo:
- `c:\Projeto_TRAE\Projeto_DP\serve.bat`

2) Abra no navegador:
- `http://localhost:8282/`

Importante:
- A janela do servidor (CMD) precisa ficar aberta enquanto você usa o sistema.
- Ao reiniciar o computador, você precisa executar o `serve.bat` novamente.

**Imagem (referência)**  
![Servidor local rodando](screenshots/00-servidor-local.png)

---

## Login e perfil de acesso
Ao abrir o sistema, você verá a tela de login. Entre com e-mail e senha cadastrados.

**Imagem**  
![Tela de login](screenshots/01-login.png)

O sistema trabalha com:
- Empresa/Unidade (empresa_id)
- Perfil (ex.: admin)
- Permissões por módulo

O controle de acesso é feito por regras no banco (RLS/policies) e pelo perfil/permissões no app.

---

## Navegação (menu)
O menu principal dá acesso aos módulos:
- Pacientes
- Profissionais
- Especialidades
- Serviços/Itens
- Orçamentos
- Financeiro
- Audit de Orçamentos Cancelados
- Gerenciar Equipe

**Imagem**  
![Menu principal](screenshots/02-menu.png)

---

## Pacientes
### Listar e buscar
- Use a busca para filtrar por nome/CPF.
- A lista mostra os dados principais e ações.

**Imagem**  
![Lista de pacientes](screenshots/10-pacientes-lista.png)

### Cadastrar/editar
Preencha os campos obrigatórios e salve.

**Imagem**  
![Cadastro de paciente](screenshots/11-pacientes-form.png)

### Prontuário (detalhes do paciente)
No prontuário você pode visualizar informações e relatórios do paciente.

**Imagem**  
![Prontuário do paciente](screenshots/12-pacientes-prontuario.png)

---

## Profissionais
Cadastre profissionais e associe especialidade quando aplicável.

**Imagem**  
![Lista de profissionais](screenshots/20-profissionais-lista.png)

---

## Especialidades e subdivisões
Especialidades podem ter subdivisões (ex.: especialidade 3 com subitens 3.1, 3.2…).

**Imagem**  
![Especialidades](screenshots/30-especialidades.png)

---

## Serviços/Itens
O cadastro de itens/serviços é usado no orçamento.
- IE = Serviço/Estoque conforme configuração
- Valor base usado nos cálculos

**Imagem**  
![Serviços/Itens](screenshots/40-servicos.png)

---

## Orçamentos
### Criar orçamento
1) Abra o módulo Orçamentos
2) Clique em “Novo Orçamento”
3) Selecione o paciente
4) Adicione itens e quantidades
5) Salve

**Imagem**  
![Lista de orçamentos](screenshots/50-orcamentos-lista.png)

**Imagem**  
![Form de orçamento](screenshots/51-orcamentos-form.png)

### Pagamentos e liberação
Em “Pagamentos & Liberação” você acompanha:
- Total orçado vs total pago
- Pagamentos já realizados
- Ações de gestão do fluxo (conforme regras do sistema)

**Imagem**  
![Detalhes e pagamentos do orçamento](screenshots/52-orcamentos-pagamentos.png)

---

## Cancelamento de orçamento e termo
Ao cancelar um orçamento, o sistema:
- Registra a auditoria (quem cancelou, motivo, valores)
- Ajusta status do orçamento/itens
- Gera o termo de cancelamento

### Termo de cancelamento
O termo é aberto para visualização e pode ser impresso.

**Imagem**  
![Termo de cancelamento (visualização)](screenshots/60-termo-cancelamento.png)

### Conceito importante: Estorno x Reembolso (fluxo financeiro)
No sistema, existem dois momentos diferentes:

1) **Crédito em conta (estorno)**  
Quando um orçamento pago é cancelado, o sistema gera um **crédito** na conta corrente virtual do paciente (saldo em aberto).  
Isso permite:
- usar o crédito em procedimentos futuros, ou
- posteriormente solicitar reembolso em dinheiro/PIX.

2) **Reembolso (saída de caixa)**  
Quando a clínica efetivamente devolve o dinheiro (PIX/dinheiro), isso deve ser registrado como **REEMBOLSO**, que é um **débito** na conta corrente do paciente (para baixar o crédito e zerar o saldo).

Na prática:
- Cancelamento gera **CREDITO / ESTORNO** (saldo sobe)
- Pagamento ao paciente gera **DEBITO / REEMBOLSO** (saldo desce)

---

## Financeiro (conta corrente do paciente)
### Visão geral
O Financeiro mostra:
- Busca do paciente
- Saldo disponível (conta corrente virtual)
- Extrato de transações
- Ações: novo lançamento e transferência

**Imagem**  
![Financeiro](screenshots/70-financeiro.png)

### Novo lançamento
Use “Novo Lançamento” para registrar:
- PAGAMENTO (crédito na conta do paciente)
- ESTORNO (crédito na conta do paciente)
- REEMBOLSO (débito na conta do paciente)
- TRANSFERENCIA (move saldo entre pacientes)

**Imagem**  
![Novo lançamento financeiro](screenshots/71-financeiro-novo-lancamento.png)

### Registrar reembolso ao paciente (entrega do valor)
Quando você fizer um PIX/dinheiro para o paciente:
1) Financeiro → selecione o paciente
2) Novo Lançamento
3) Categoria: REEMBOLSO
4) Preencha valor, forma e observação (ex.: “Reembolso do cancelamento do orçamento #123”)
5) Salvar

Isso registra a baixa do crédito na conta do paciente e mantém auditoria de quem lançou.

---

## Comissões
Nesta tela você consegue:
- Filtrar comissões “à pagar” ou “pagas” por período
- Selecionar registros individualmente ou “selecionar todos”
- Marcar comissões como pagas e imprimir recibo para assinatura

**Imagem**  
![Comissões](screenshots/75-comissoes.png)

Fluxo recomendado:
- Cancelamento/Orçamento gera a comissão no sistema
- Quando a comissão for paga ao profissional, selecione os itens e clique em “Marcar como Pago”
- Imprima o recibo e colete assinatura do profissional

---

## Auditoria: Orçamentos cancelados (reimpressão)
Nesta tela você encontra:
- Todos os cancelamentos registrados
- Motivo, valor, responsável e data
- Ações para ver detalhes e reimprimir termo

**Imagem**  
![Audit cancelados](screenshots/80-audit-cancelados.png)

Para reimprimir um termo:
1) Abra “Audit de Orçamentos Cancelados”
2) Clique no ícone de impressora (🖨) da linha desejada

---

## Gerenciar equipe (usuário_empresas)
A tela “Gerenciar Equipe” mostra os vínculos de usuários com empresas:
- E-mail/ID
- Empresa
- Perfil
- Ações de gestão (conforme permissões)

**Imagem**  
![Gerenciar equipe](screenshots/90-gerenciar-equipe.png)

---

## Boas práticas e solução de problemas
### “Não abre o localhost”
- Confirme que o `serve.bat` está rodando e a janela não foi fechada.
- Abra `http://localhost:8282/` (não usar https).

### Impressão sai em branco
- Use o botão “Imprimir Termo” do sistema (ele usa uma janela separada para imprimir).

### Saldo ficou negativo inesperadamente
- Verifique se foram lançados dois débitos (REEMBOLSO duplicado).
- Em cancelamento, o correto é gerar crédito (ESTORNO) e só depois registrar o reembolso (DEBITO) quando houver saída de caixa.
