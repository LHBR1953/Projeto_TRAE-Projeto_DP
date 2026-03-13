-- 1. Atualizar constraint de orcamento_pagamentos para aceitar novas formas de pagamento
ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_forma_pagamento_check;
ALTER TABLE public.orcamento_pagamentos ADD CONSTRAINT orcamento_pagamentos_forma_pagamento_check 
CHECK (forma_pagamento IN ('PIX', 'Cartão', 'Cartão Débito', 'Cartão de Crédito', 'Dinheiro', 'Boleto', 'Cheque', 'Saldo em Conta'));

-- 2. Garantir que a categoria TRANSFERENCIA seja aceita em financeiro_transacoes (se houver restrição)
ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_categoria_check;
ALTER TABLE public.financeiro_transacoes ADD CONSTRAINT financeiro_transacoes_categoria_check 
CHECK (categoria IN ('PAGAMENTO', 'TRANSFERENCIA', 'ESTORNO', 'REEMBOLSO', 'CONSUMO'));

-- 3. Adicionar coluna orcamento_id se não existir (vi que no audit estava lá, mas por precaução)
ALTER TABLE public.financeiro_transacoes ADD COLUMN IF NOT EXISTS orcamento_id BIGINT;
