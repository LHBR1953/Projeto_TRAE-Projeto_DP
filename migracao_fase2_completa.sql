-- MIGRACAO CONSOLIDADA: ORCAMENTO FASE 2
-- Execute este script no SQL Editor do Supabase para garantir que todas as novas funcionalidades funcionem.

-- 1. Adicionar Profissional Responsável no CABEÇALHO do Orçamento
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS profissional_id text REFERENCES public.profissionais(id) ON DELETE SET NULL;

-- 2. Adicionar Profissional Executor nos ITENS do Orçamento
ALTER TABLE public.orcamento_itens 
ADD COLUMN IF NOT EXISTS profissional_id text REFERENCES public.profissionais(id) ON DELETE SET NULL;

-- 3. Adicionar Status nos ITENS do Orçamento
ALTER TABLE public.orcamento_itens 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pendente';

-- NOTA: Se você receber erro de "column already exists", não se preocupe, o IF NOT EXISTS garante que o script seja seguro.
