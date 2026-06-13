-- Adiciona coluna tempo_consulta_padrao na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS tempo_consulta_padrao INTEGER DEFAULT 30;

-- Adiciona coluna tempo_consulta na tabela profissionais
ALTER TABLE public.profissionais
ADD COLUMN IF NOT EXISTS tempo_consulta INTEGER;
