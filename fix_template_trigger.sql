CREATE OR REPLACE FUNCTION public.guard_template_read_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Permite bypass para migrations internas
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Se o usuário autenticado for o Superadmin, permite qualquer operação (Bypass total)
  IF auth.jwt() ->> 'email' = 'lhbr@lhbr.com.br' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Verifica também o cabeçalho customizado (caso o JWT venha sem email por algum motivo de proxy)
  IF current_setting('request.headers', true)::json->>'x-superadmin-email' = 'lhbr@lhbr.com.br' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Caso contrário, mantém o bloqueio restrito para os demais
  RAISE EXCEPTION 'Ação Bloqueada: Tabelas de Template são apenas leitura para garantir a integridade do sistema. Use migrations oficiais para alterações.';
END;
$$;
