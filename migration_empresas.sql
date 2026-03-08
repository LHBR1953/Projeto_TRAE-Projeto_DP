-- 1. Create table Empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Empresa
INSERT INTO public.empresas (id, nome) VALUES ('emp_padrao', 'Empresa Padrão (Migração)') ON CONFLICT (id) DO NOTHING;

-- 2. Add empresa_id to existing tables with DEFAULT to prevent NOT NULL violation
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_padrao' REFERENCES public.empresas(id);
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_padrao' REFERENCES public.empresas(id);
ALTER TABLE public.especialidades ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_padrao' REFERENCES public.empresas(id);
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_padrao' REFERENCES public.empresas(id);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_padrao' REFERENCES public.empresas(id);

-- Wait on setting NOT NULL until data is verified, but set logical defaults.

-- 3. Create orcamento_itens table
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
    id TEXT PRIMARY KEY,
    orcamento_id TEXT NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL DEFAULT 'emp_padrao' REFERENCES public.empresas(id),
    servico_id TEXT NOT NULL REFERENCES public.servicos(id),
    valor NUMERIC NOT NULL,
    qtde INTEGER NOT NULL DEFAULT 1,
    protetico_id TEXT REFERENCES public.profissionais(id),
    valor_protetico NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
