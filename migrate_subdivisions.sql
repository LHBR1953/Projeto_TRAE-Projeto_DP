-- 1. Create the subdivisions table with multi-tenant support
CREATE TABLE IF NOT EXISTS public.especialidade_subdivisoes (
    id TEXT PRIMARY KEY,
    especialidade_id TEXT REFERENCES public.especialidades(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing data from JSONB array to the new table
-- This ensures existing 'empresa_id' is preserved during migration
INSERT INTO public.especialidade_subdivisoes (id, especialidade_id, nome, empresa_id)
SELECT 
    (e.id || '-' || (sub_index - 1)) as id,
    e.id AS especialidade_id, 
    (sub->>'nome')::text AS nome, 
    e.empresa_id
FROM 
    public.especialidades e,
    jsonb_array_elements(COALESCE(e.subdivisoes, '[]'::jsonb)) WITH ORDINALITY AS sub_elements(sub, sub_index)
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure all specialties have an empresa_id (default to 'emp_padrao' if null)
UPDATE public.especialidades SET empresa_id = 'emp_padrao' WHERE empresa_id IS NULL;

-- 4. (Optional) Remove the old column ONLY after confirming success
-- ALTER TABLE public.especialidades DROP COLUMN subdivisoes;
