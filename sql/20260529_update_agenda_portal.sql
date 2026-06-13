BEGIN;

-- 1. Remover a constraint de status antiga para permitir 'CONFIRMADO' (e outras)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agenda_agendamentos_status_check'
    ) THEN
        ALTER TABLE public.agenda_agendamentos DROP CONSTRAINT agenda_agendamentos_status_check;
    END IF;
END $$;

-- Opcional: Adicionar a constraint atualizada com os novos status
ALTER TABLE public.agenda_agendamentos 
ADD CONSTRAINT agenda_agendamentos_status_check 
CHECK (status IN ('MARCADO','CANCELADO','CONCLUIDO','FALTOU','CONFIRMADO','CHECKIN','Orçamento Gerado')) NOT VALID;

-- 2. Permitir que pacientes anônimos com token válido atualizem o status do próprio agendamento
DROP POLICY IF EXISTS "Permitir atualizacao de status de agendamentos via token" ON public.agenda_agendamentos;

CREATE POLICY "Permitir atualizacao de status de agendamentos via token"
ON public.agenda_agendamentos
FOR UPDATE
TO anon
USING (
  paciente_id IN (
    SELECT p.seqid
    FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
)
WITH CHECK (
  paciente_id IN (
    SELECT p.seqid
    FROM public.paciente_tokens pt
    JOIN public.pacientes p ON p.id = pt.paciente_id
    WHERE pt.expires_at > now()
  )
);

COMMIT;
