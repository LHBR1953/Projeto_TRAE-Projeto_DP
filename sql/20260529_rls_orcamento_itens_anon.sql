-- Política de segurança RESTRITIVA para Itens do Orçamento (LGPD Compliance)
-- Apenas permite a leitura se houver um token válido associado ao paciente do orçamento

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura segura de itens de orcamento via token" ON public.orcamento_itens;

CREATE POLICY "Permitir leitura segura de itens de orcamento via token" 
ON public.orcamento_itens 
FOR SELECT TO anon 
USING (
  orcamento_id IN (
    SELECT o.id
    FROM public.orcamentos o
    JOIN public.pacientes p ON p.id = o.pacienteid
    JOIN public.paciente_tokens pt ON pt.paciente_id = p.id
    WHERE pt.expires_at > now()
  )
);
