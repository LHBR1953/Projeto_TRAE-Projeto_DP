BEGIN;

-- Ativar RLS na tabela de itens
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

-- Remove política anterior se houver
DROP POLICY IF EXISTS "Permitir leitura de itens via token paciente" ON public.orcamento_itens;
DROP POLICY IF EXISTS "Permitir leitura segura de itens de orcamento via token" ON public.orcamento_itens;

-- Criar política de leitura estrita (LGPD):
-- O paciente anônimo só pode ler os itens se o orcamento_id pertencer a ele mesmo
CREATE POLICY "Permitir leitura de itens via token paciente"
ON public.orcamento_itens FOR SELECT TO anon
USING (
  orcamento_id IN (
    SELECT o.id FROM public.orcamentos o
    JOIN public.paciente_tokens pt ON pt.paciente_id = o.pacienteid
    WHERE pt.expires_at > now()
  )
);

COMMIT;