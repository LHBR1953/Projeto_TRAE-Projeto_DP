-- Adiciona colunas para a Fase 2 dos Orçamentos
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS profissional_id BIGINT;
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente';

-- Comentário para o usuário: 
-- Execute este script no Editor SQL do seu Supabase Dashboard para liberar as novas funcionalidades.
