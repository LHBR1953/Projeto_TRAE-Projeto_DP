BEGIN;

CREATE OR REPLACE FUNCTION public.portal_atualizar_agendamento(
  p_agendamento_id uuid,
  p_novo_status text,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paciente_seqid bigint;
  v_agendamento_paciente_id bigint;
BEGIN
  -- Verifica o token
  SELECT p.seqid INTO v_paciente_seqid
  FROM public.paciente_tokens pt
  JOIN public.pacientes p ON p.id = pt.paciente_id
  WHERE pt.token = p_token AND pt.expires_at > now();

  IF v_paciente_seqid IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou expirado.';
  END IF;

  -- Verifica se o agendamento pertence a este paciente
  SELECT paciente_id INTO v_agendamento_paciente_id
  FROM public.agenda_agendamentos
  WHERE id = p_agendamento_id;

  IF v_agendamento_paciente_id IS NULL OR v_agendamento_paciente_id != v_paciente_seqid THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este paciente.';
  END IF;

  -- Atualiza o status
  UPDATE public.agenda_agendamentos
  SET status = p_novo_status
  WHERE id = p_agendamento_id;

  RETURN true;
END;
$$;

COMMIT;