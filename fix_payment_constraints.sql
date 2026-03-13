-- CORREÇÃO MESTRE: Expandir formas de pagamento e garantir integridade
-- Este script resolve o erro de CHECK constraint na tabela de pagamentos.

DO $$ 
BEGIN 
    -- 1. Remove a constraint antiga se ela existir (para podermos recriá-la)
    -- O nome padrão costuma seguir o padrão 'tabela_coluna_check'
    ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_forma_pagamento_check;

    -- 2. Adiciona a nova constraint com as opções expandidas
    ALTER TABLE public.orcamento_pagamentos ADD CONSTRAINT orcamento_pagamentos_forma_pagamento_check 
    CHECK (forma_pagamento IN ('PIX', 'Cartão', 'Cartão Débito', 'Cartão de Crédito', 'Dinheiro', 'Boleto', 'Cheque'));

    -- 3. Caso a constraint tenha outro nome, tentamos um drop mais genérico via detecção (opcional, mas seguro)
    -- (O Supabase geralmente permite múltiplos checks, mas o ideal é ter um só pra essa finalidade)
END $$;

-- 4. Adicionar um índice para busca de paciente_id em transações se não existir (performance)
CREATE INDEX IF NOT EXISTS idx_fin_trans_paciente_id ON public.financeiro_transacoes(paciente_id);
