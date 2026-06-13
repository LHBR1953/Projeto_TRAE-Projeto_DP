-- Política de segurança RESTRITIVA para Agendamentos (LGPD Compliance) com JOIN
-- Apenas permite a leitura se houver um token válido cruzando o seqid da agenda com o UUID do token

-- Garante que o RLS está habilitado na tabela
ALTER TABLE public.agenda_agendamentos ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores
DROP POLICY IF EXISTS "Permitir leitura de agendamentos pelo portal anônimo" ON public.agenda_agendamentos;
DROP POLICY IF EXISTS "Permitir leitura segura de agendamentos via token" ON public.agenda_agendamentos;

-- Cria a política de leitura segura
CREATE POLICY "Permitir leitura segura de agendamentos via token" 
ON public.agenda_agendamentos 
FOR SELECT 
TO anon 
USING (
  paciente_id IN (
    SELECT p.seqid 
    FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
);
