BEGIN;
ALTER TABLE public.financeiro_transacoes ADD COLUMN IF NOT EXISTS orcamento_id BIGINT;
DO $$ 
BEGIN
    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_orcamento_id_fkey;
    ALTER TABLE public.orcamento_itens ADD CONSTRAINT orcamento_itens_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE RESTRICT;

    ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_orcamento_id_fkey;
    ALTER TABLE public.orcamento_pagamentos ADD CONSTRAINT orcamento_pagamentos_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT;

    ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_orcamento_id_fkey;
    ALTER TABLE public.financeiro_transacoes ADD CONSTRAINT financeiro_transacoes_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT;

    ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_item_id_fkey;
    ALTER TABLE public.financeiro_comissoes ADD CONSTRAINT financeiro_comissoes_item_id_fkey 
    FOREIGN KEY (item_id) REFERENCES public.orcamento_itens(id) ON DELETE RESTRICT;
END $$;
CREATE INDEX IF NOT EXISTS idx_transacoes_orcamento ON public.financeiro_transacoes(orcamento_id);
COMMIT;
