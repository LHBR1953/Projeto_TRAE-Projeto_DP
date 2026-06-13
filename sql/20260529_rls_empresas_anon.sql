BEGIN;

-- Permite que pacientes (anon) leiam os dados da empresa (clínica) a qual pertencem
DROP POLICY IF EXISTS "Permitir leitura da empresa via token paciente" ON public.empresas;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura da empresa via token paciente"
ON public.empresas FOR SELECT TO anon
USING (
  id IN (
    SELECT p.empresa_id FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
);

COMMIT;