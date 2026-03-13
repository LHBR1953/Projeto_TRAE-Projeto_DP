-- 1. Adicionar coluna para rastrear quem autorizou a liberação
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS autorizado_por TEXT;

-- 2. Garantir que a tabela de comissões tenha a data de autorização vinculada (opcional, para histórico)
-- Nota: A coluna autorizado_por em orcamento_itens já resolve a falha no código.
