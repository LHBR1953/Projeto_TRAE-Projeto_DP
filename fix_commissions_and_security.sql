-- 1. Garantir coluna de PIN do Supervisor na tabela de Empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS supervisor_pin TEXT DEFAULT '1234';

-- 2. Garantir coluna de valor_protetico em orcamento_itens (caso não exista em alguma versão)
ALTER TABLE public.orcamento_itens ADD COLUMN IF NOT EXISTS valor_protetico NUMERIC(10,2) DEFAULT 0;

-- 3. Atualizar o PIN da empresa padrão para o teste
UPDATE public.empresas SET supervisor_pin = '1234' WHERE id = 'emp_padrao' AND supervisor_pin IS NULL;
