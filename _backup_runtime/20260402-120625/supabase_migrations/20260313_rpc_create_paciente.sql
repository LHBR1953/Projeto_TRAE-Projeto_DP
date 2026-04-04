CREATE OR REPLACE FUNCTION public.rpc_create_paciente(p_data jsonb)
RETURNS public.pacientes
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seqid bigint;
  v_row public.pacientes%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pacientes_seqid'));
  SELECT COALESCE(MAX(seqid), 0) + 1 INTO v_seqid FROM public.pacientes;

  INSERT INTO public.pacientes (
    id,
    seqid,
    nome,
    cpf,
    datanascimento,
    sexo,
    profissao,
    telefone,
    celular,
    email,
    cep,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    empresa_id,
    anamnese
  ) VALUES (
    COALESCE(NULLIF(p_data->>'id', ''), gen_random_uuid()::text),
    v_seqid,
    NULLIF(p_data->>'nome', ''),
    NULLIF(p_data->>'cpf', ''),
    NULLIF(p_data->>'datanascimento', '')::date,
    NULLIF(p_data->>'sexo', ''),
    NULLIF(p_data->>'profissao', ''),
    NULLIF(p_data->>'telefone', ''),
    NULLIF(p_data->>'celular', ''),
    NULLIF(p_data->>'email', ''),
    NULLIF(p_data->>'cep', ''),
    NULLIF(p_data->>'endereco', ''),
    NULLIF(p_data->>'numero', ''),
    NULLIF(p_data->>'complemento', ''),
    NULLIF(p_data->>'bairro', ''),
    NULLIF(p_data->>'cidade', ''),
    NULLIF(p_data->>'uf', ''),
    COALESCE(NULLIF(p_data->>'empresa_id', ''), 'emp_padrao'),
    COALESCE(p_data->'anamnese', '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
