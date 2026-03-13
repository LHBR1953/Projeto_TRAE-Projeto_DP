-- MASTER FIX: Padronização de Colunas (tenant_id -> empresa_id)
-- Execute este script no SQL Editor do Supabase para resolver o erro de carregamento.

DO $$ 
BEGIN 
    -- 1. Tabela: financeiro_transacoes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financeiro_transacoes' AND column_name='tenant_id') THEN
        ALTER TABLE public.financeiro_transacoes RENAME COLUMN tenant_id TO empresa_id;
    END IF;

    -- 2. Tabela: orcamento_pagamentos
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamento_pagamentos' AND column_name='tenant_id') THEN
        ALTER TABLE public.orcamento_pagamentos RENAME COLUMN tenant_id TO empresa_id;
    END IF;

    -- 3. Tabela: financeiro_comissoes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financeiro_comissoes' AND column_name='tenant_id') THEN
        ALTER TABLE public.financeiro_comissoes RENAME COLUMN tenant_id TO empresa_id;
    END IF;

    -- 4. Garantir que a View de Saldo use o nome correto (se necessário, embora a view use select *)
    -- Recria a view para garantir consistência
    DROP VIEW IF EXISTS public.view_saldo_paciente;
    CREATE OR REPLACE VIEW public.view_saldo_paciente AS
    SELECT 
        paciente_id,
        SUM(CASE WHEN tipo = 'CREDITO' THEN valor ELSE -valor END) as saldo_atual
    FROM public.financeiro_transacoes
    GROUP BY paciente_id;

END $$;
