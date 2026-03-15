# Regras de Negócio (Validadas)

Este documento registra regras de negócio validadas a partir do comportamento implementado no OCC e decisões acordadas durante a homologação. Ele será a base para geração de PDF posteriormente.

## Orçamentos

### Tipos de Orçamento

- **Normal**
  - Orçamento padrão, com cobrança.
  - Permite registro de pagamentos.
  - Liberação de itens segue regra de “saldo pago” (ou autorização quando não cobrir).
  - Pode gerar comissão e movimentação no financeiro (conta corrente).

- **Urgência**
  - Mesmas regras do tipo Normal, mas classifica o orçamento como prioridade/urgente.
  - Fluxo financeiro e comissão seguem o Normal.

- **Cortesia**
  - Orçamento sem cobrança.
  - Não registra pagamentos.
  - Não gera comissão.
  - Não registra consumo no financeiro (não debita saldo do paciente).
  - Itens podem ser liberados sem depender de pagamento.

- **Retrabalho**
  - Orçamento de retrabalho (refação/ajuste), sem cobrança.
  - Mesmo comportamento do tipo Cortesia:
    - sem pagamentos,
    - sem comissão,
    - sem débito de consumo,
    - liberação direta dos itens.

### Pagamentos (Orçamento)

- Pagamentos são registrados no histórico do orçamento.
- Quando aplicável, pagamentos também são refletidos no financeiro como transações de crédito (entrada) com categoria de pagamento.
- Pagamentos não são permitidos quando o orçamento está em **Cortesia** ou **Retrabalho**.

### Liberação e Consumo (Orçamento)

- A liberação de um item representa autorização para execução clínica.
- No tipo **Normal/Urgência**, a liberação normalmente depende de o valor pago cobrir o item (ou autorização quando não cobrir).
- No tipo **Cortesia/Retrabalho**, a liberação não depende de pagamento.
- No tipo **Normal/Urgência**, a liberação pode registrar “consumo” no financeiro (débito).
- No tipo **Cortesia/Retrabalho**, não há consumo no financeiro.

### Comissões

- Comissões são geradas no momento da liberação do item, conforme regras do profissional e item.
- Comissões não são geradas quando o orçamento é do tipo **Cortesia** ou **Retrabalho**.

### Mudança de Tipo (Normal → Cortesia/Retrabalho)

#### Objetivo

Quando um orçamento criado como **Normal** for alterado para **Cortesia** ou **Retrabalho**, o sistema deve “zerar” os efeitos financeiros e de comissão que um orçamento cobrável poderia ter criado, mantendo rastreabilidade e auditoria.

#### Princípios

- Não apagar histórico: a reversão é feita por **estornos** e mudanças de status, preservando trilha auditável.
- Em caso de efeitos sensíveis (pagamentos e comissões pagas), pode exigir autorização de supervisor/admin.

#### O que o sistema deve fazer ao converter para Cortesia/Retrabalho

- **Pagamentos do orçamento**
  - Marcar pagamentos existentes como **Cancelado**.
  - Não permitir novos pagamentos.

- **Financeiro (conta corrente)**
  - Se houver transações de pagamento (crédito), registrar **estorno** equivalente (débito) para anular o efeito.
  - Se houver consumo registrado (débito), registrar **estorno** equivalente (crédito) para anular o efeito.

- **Comissões**
  - Comissões pendentes/geradas devem ser **estornadas**.
  - Se houver comissão paga, o estorno deve ser controlado por fluxo com autorização (para manter governança).

#### Mudança inversa (Cortesia/Retrabalho → Normal)

- A partir da mudança para Normal, o orçamento volta a seguir o fluxo normal para novos eventos (pagamentos, liberações e comissões).
- Não existe “recriação automática” de lançamentos antigos que foram estornados; novos lançamentos seguem o trâmite normal a partir desse ponto.
