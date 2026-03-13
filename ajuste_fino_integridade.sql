-- PROTECAO REFINADA: FLUIDEZ NA DELECAO DE ORCAMENTOS
-- 1. Permite deletar orçamentos que só tenham itens (CASCADE)
-- 2. Mantém o bloqueio se houver comissões, pagamentos ou transações (RESTRICT)

DO $$ 
BEGIN 
    -- Mudança para CASCADE apenas nos itens do orçamento
    -- Isso permite deletar o orçamento e levar os itens juntos, 
    -- DESDE QUE esses itens não tenham comissões pagas/geradas.
    ALTER TABLE public.orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_orcamento_id_fkey;
    ALTER TABLE public.orcamento_itens 
    ADD CONSTRAINT orcamento_itens_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE CASCADE;

    -- Garantir que as comissões CONTINUAM protegendo os itens
    -- Se um item tiver comissão, o CASCADE acima falhará ao tentar deletar o item.
    ALTER TABLE public.financeiro_comissoes DROP CONSTRAINT IF EXISTS financeiro_comissoes_item_id_fkey;
    ALTER TABLE public.financeiro_comissoes 
    ADD CONSTRAINT financeiro_comissoes_item_id_fkey 
    FOREIGN KEY (item_id) REFERENCES public.orcamento_itens(id) ON DELETE RESTRICT;

    -- Garantir que pagamentos CONTINUAM protegendo o orçamento
    ALTER TABLE public.orcamento_pagamentos DROP CONSTRAINT IF EXISTS orcamento_pagamentos_orcamento_id_fkey;
    ALTER TABLE public.orcamento_pagamentos 
    ADD CONSTRAINT orcamento_pagamentos_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT;

    -- Garantir que transações CONTINUAM protegendo o orçamento
    ALTER TABLE public.financeiro_transacoes DROP CONSTRAINT IF EXISTS financeiro_transacoes_orcamento_id_fkey;
    ALTER TABLE public.financeiro_transacoes 
    ADD CONSTRAINT financeiro_transacoes_orcamento_id_fkey 
    FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(seqid) ON DELETE RESTRICT;

END $$;
