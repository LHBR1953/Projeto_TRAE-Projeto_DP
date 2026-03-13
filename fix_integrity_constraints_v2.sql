-- CORREÇÃO DE INTEGRIDADE: ORÇAMENTOS E FINANCEIRO
-- Impede a exclusão de registros pai se houver registros filhos vinculados.

BEGIN;

-- 1. Tabela orcamento_pagamentos (Impedir exclusão de orçamento com pagamentos)
DO $$ 
BEGIN
    -- Remove a FK antiga se existir (geralmente CASCADE)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamento_pagamentos_orcamento_id_fkey') THEN
        ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT orcamento_pagamentos_orcamento_id_fkey;
    END IF;
    
    -- Adiciona a FK com RESTRICT
    ALTER TABLE public.orcamento_pagamentos 
    ADD CONSTRAINT orcamento_pagamentos_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT;
END $$;

-- 2. Tabela financeiro_comissoes (Impedir exclusão de itens com comissões)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_comissoes_item_id_fkey') THEN
        ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT financeiro_comissoes_item_id_fkey;
    END IF;
    
    ALTER TABLE public.financeiro_comissoes 
    ADD CONSTRAINT financeiro_comissoes_item_id_fkey 
    FOREIGN KEY (item_id) REFERENCES public.orcamento_itens(id) ON DELETE RESTRICT;
END $$;

-- 3. Tabela financeiro_transacoes (Adicionar FK de referência ao orçamento se possível)
-- Nota: Como referencia_id pode ser orçamento ou item, o RESTRICT é mais complexo aqui.
-- Por enquanto, garantimos apenas o vínculo de empresa e paciente.

COMMIT;
