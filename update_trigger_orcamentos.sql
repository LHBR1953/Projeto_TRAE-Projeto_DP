BEGIN;

CREATE OR REPLACE FUNCTION public.trg_orcamentos_guard_dentist()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_txt text;
  allowed boolean;
  is_owner boolean;
BEGIN
  role_txt := (
    SELECT ue.perfil
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = old.empresa_id
    LIMIT 1
  );

  IF public.occ_is_role_dentist(role_txt) THEN
    
    -- Verifica se é o dono
    is_owner := FALSE;
    IF old.profissional_id::text = auth.uid()::text THEN
      is_owner := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.profissional_usuarios pu
        JOIN public.profissionais p ON p.id = pu.profissional_id
        WHERE pu.usuario_id = auth.uid()
          AND pu.empresa_id = old.empresa_id
          AND (
             old.profissional_id::text = p.id::text 
             OR old.profissional_id::text = p.seqid::text
          )
      ) INTO is_owner;
    END IF;

    -- Se acabou de ser criado, também consideramos como dono temporário (para o primeiro INSERT/UPDATE do fluxo)
    IF old.created_at >= (now() - interval '5 minutes') THEN
        is_owner := TRUE;
    END IF;

    -- Se for o dono e o status for alterável
    IF is_owner AND lower(COALESCE(old.status, '')) NOT IN ('finalizado', 'executado') THEN
       -- Liberado
       NULL;
    ELSIF tg_op = 'UPDATE' AND lower(COALESCE(new.status, '')) IN ('executado', 'em execução', 'em execucao', 'finalizado') AND lower(COALESCE(old.status, '')) NOT IN ('finalizado', 'executado') THEN
       -- EXCEÇÃO CHECK-OUT: Se o update for APENAS para mudar o status do orçamento para Executado/Finalizado 
       -- (acionado automaticamente pelo frontend ao finalizar os itens), permitimos.
       -- Retorna NEW imediatamente para ignorar a validação de 4 horas abaixo.
       RETURN new;
    ELSE
      -- Regra original
      allowed := public.occ_budget_is_editable_for_dentist(old.empresa_id, old.status, old.created_at, old.id, old.seqid::bigint);
      IF NOT allowed THEN
        -- Como estamos dentro do IF tg_op = 'UPDATE', podemos verificar se a MUDANÇA foi SÓ no status (ex: para Executado)
        -- Se SÓ o status mudou (o resto do orçamento ficou intocado), nós permitimos (pois é só o Frontend fechando a conta).
        IF tg_op = 'UPDATE' AND old.status IS DISTINCT FROM new.status AND old.itens IS NOT DISTINCT FROM new.itens AND old.profissional_id IS NOT DISTINCT FROM new.profissional_id THEN
            RETURN new;
        END IF;

        RAISE EXCEPTION 'P0001: Orçamento travado para Dentista. Fora da janela de 4h ou com pagamento.';
      END IF;
      IF tg_op = 'UPDATE' AND lower(COALESCE(new.status,'')) <> 'pendente' THEN
        RAISE EXCEPTION 'P0001: Orçamento travado para Dentista: não é permitido alterar status para %.', new.status;
      END IF;
    END IF;
  END IF;

  IF tg_op = 'DELETE' THEN
    RETURN old;
  END IF;
  RETURN new;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;