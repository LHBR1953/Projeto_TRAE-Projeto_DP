-- MIGRACAO DEFINITIVA: ORCAMENTO FASE 2 (IDs NUMÉRICOS)
-- Use este script se você prefere IDs numéricos (seqid) em vez de UUIDs.

-- 1. Tabela orcamentos (Cabeçalho)
-- Garante que profissional_id seja bigint (ID numérico)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamentos' AND column_name = 'profissional_id' AND data_type = 'text') THEN
        ALTER TABLE public.orcamentos DROP COLUMN profissional_id;
    END IF;
END $$;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS profissional_id bigint;

-- 2. Tabela orcamento_itens (Detalhes/Itens)
-- Garante que profissional_id e protetico_id sejam bigint
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_itens' AND column_name = 'profissional_id' AND data_type = 'text') THEN
        ALTER TABLE public.orcamento_itens DROP COLUMN profissional_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_itens' AND column_name = 'protetico_id' AND data_type = 'text') THEN
        ALTER TABLE public.orcamento_itens DROP COLUMN protetico_id;
    END IF;
END $$;

ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS profissional_id bigint;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS protetico_id bigint;
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pendente';
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS subdivisao text;

-- NOTA: Este script remove as colunas se forem do tipo 'text' (UUID) para recriá-las como 'bigint'.
