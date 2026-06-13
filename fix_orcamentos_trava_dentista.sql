BEGIN;

-- CORREÇÃO DE SEGURANÇA: EXCEÇÃO PARA O PROPRIETÁRIO DO ORÇAMENTO
-- Permite que o dentista altere itens de orçamentos criados por ele,
-- desde que o status não seja Finalizado ou Executado.

-- 1. Atualizar Trigger de Itens do Orçamento
CREATE OR REPLACE FUNCTION public.trg_orcamento_itens_guard_dentist()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_txt text;
  b public.orcamentos%rowtype;
  allowed boolean;
  budget_id text;
  is_owner boolean;
BEGIN
  role_txt := (
    SELECT ue.perfil
    FROM public.usuario_empresas ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.empresa_id = COALESCE(old.empresa_id, new.empresa_id)
    LIMIT 1
  );

  -- Admin e Superadmin passam direto
  IF public.occ_is_role_admin(role_txt) THEN
    IF tg_op = 'DELETE' THEN RETURN old; END IF;
    RETURN new;
  END IF;

  -- Se não for dentista, passa direto (outras regras podem se aplicar depois)
  IF NOT public.occ_is_role_dentist(role_txt) THEN
    IF tg_op = 'DELETE' THEN RETURN old; END IF;
    RETURN new;
  END IF;

  budget_id := COALESCE(old.orcamento_id, new.orcamento_id);
  SELECT * INTO b FROM public.orcamentos WHERE id = budget_id LIMIT 1;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado para o item.';
  END IF;

  -- Verifica se é o dono do orçamento (criador)
  is_owner := FALSE;
  
  -- Checagem direta (caso profissional_id grave o auth.uid)
  IF b.profissional_id::text = auth.uid()::text THEN
    is_owner := TRUE;
  ELSE
    -- Checagem via tabela de mapeamento (caso profissional_id seja ID da tabela profissionais)
    SELECT EXISTS (
      SELECT 1
      FROM public.profissional_usuarios pu
      JOIN public.profissionais p ON p.id = pu.profissional_id
      WHERE pu.usuario_id = auth.uid()
        AND pu.empresa_id = b.empresa_id
        AND (
           b.profissional_id::text = p.id::text 
           OR b.profissional_id::text = p.seqid::text
        )
    ) INTO is_owner;
  END IF;

  -- Verifica se ele está criando o orçamento ou criando um item para um orçamento novo que ainda não gravou direito
  -- Em transações assíncronas do frontend, a tabela de orçamentos pode já ter o registro, mas talvez o profissional não bate.
  -- Exceção temporária: Se for uma inserção (INSERT), e o orçamento foi criado nos últimos 5 minutos
  IF tg_op = 'INSERT' AND b.created_at >= (now() - interval '5 minutes') THEN
      is_owner := TRUE;
  END IF;

  -- EXCEÇÃO: O profissional que criou o orçamento e possui status Aprovado/Pendente/Em Execução
  -- tem direito de alterar os seus próprios itens. 
  -- E, na tela de Atendimento, o Dentista precisa poder dar UPDATE no item para FINALIZADO
  -- caso esteja agendado com ele ou ele seja o executor, mas a policy real disso será checada em nível superior.
  -- Para evitar travar o fluxo de atendimento, permitimos a gravação se o status não for Finalizado/Executado
  IF is_owner AND lower(COALESCE(b.status, '')) NOT IN ('finalizado', 'executado') THEN
    IF tg_op = 'DELETE' THEN RETURN old; END IF;
    RETURN new;
  END IF;

  -- EXCEÇÃO 2 (Check-out): Se for apenas uma alteração de status do ITEM para 'Finalizado' 
  -- (que é o que acontece no check-out do atendimento), não barramos por autoria do orçamento, 
  -- pois o dentista da cadeira está executando o serviço.
  -- Usamos ILIKE/lower para garantir que variações como 'FINALIZADO', 'Finalizado' passem.
  -- A tabela financeiro_apuracao_servicos precisa do update, então permitimos a passagem.
  IF tg_op = 'UPDATE' AND lower(COALESCE(new.status, '')) = 'finalizado' AND lower(COALESCE(old.status, '')) NOT IN ('finalizado', 'executado') THEN
      RETURN new;
  END IF;

  -- Regra original de segurança (4 horas / sem pagamentos)
  allowed := public.occ_budget_is_editable_for_dentist(b.empresa_id, b.status, b.created_at, b.id, b.seqid::bigint);
  IF NOT allowed THEN
    RAISE EXCEPTION 'P0001: Orçamento travado para Dentista. Apenas o criador pode alterar orçamentos Pendentes/Aprovados.';
  END IF;

  IF tg_op = 'DELETE' THEN RETURN old; END IF;
  RETURN new;
END;
$$;

-- 2. Atualizar Trigger do Cabeçalho do Orçamento
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
       -- ATENÇÃO: NÃO damos "NULL" aqui porque a lógica prosseguiria e bateria na restrição original de 4h.
       -- Nós precisamos retornar o NEW imediatamente para interromper as validações,
       -- garantindo que a trigger finalize sem lançar erro.
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
