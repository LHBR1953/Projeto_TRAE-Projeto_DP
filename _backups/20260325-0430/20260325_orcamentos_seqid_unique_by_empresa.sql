begin;

do $$
begin
  if to_regclass('public.orcamentos') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orcamentos'
      and column_name = 'empresa_id'
  ) then
    raise exception 'public.orcamentos não possui coluna empresa_id. Não é possível aplicar unique por empresa.';
  end if;

  alter table public.orcamentos
    drop constraint if exists orcamentos_seqid_unique;

  alter table public.orcamentos
    drop constraint if exists orcamentos_empresa_seqid_unique;

  if exists (
    select 1
    from public.orcamentos
    group by empresa_id, seqid
    having count(*) > 1
  ) then
    raise exception 'Existem duplicidades de (empresa_id, seqid) em public.orcamentos. Corrija antes de aplicar a constraint.';
  end if;

  alter table public.orcamentos
    add constraint orcamentos_empresa_seqid_unique unique (empresa_id, seqid);

  if to_regclass('public.orcamento_pagamentos') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orcamento_pagamentos'
        and column_name = 'orcamento_id'
        and data_type in ('bigint','integer')
    ) then
      alter table public.orcamento_pagamentos
        drop constraint if exists orcamento_pagamentos_orcamento_id_fkey;
      alter table public.orcamento_pagamentos
        add constraint orcamento_pagamentos_orcamento_id_fkey
        foreign key (empresa_id, orcamento_id)
        references public.orcamentos(empresa_id, seqid)
        on delete restrict
        not valid;
    end if;
  end if;

  if to_regclass('public.financeiro_transacoes') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'financeiro_transacoes'
        and column_name = 'orcamento_id'
        and data_type in ('bigint','integer')
    ) then
      alter table public.financeiro_transacoes
        drop constraint if exists financeiro_transacoes_orcamento_id_fkey;
      alter table public.financeiro_transacoes
        add constraint financeiro_transacoes_orcamento_id_fkey
        foreign key (empresa_id, orcamento_id)
        references public.orcamentos(empresa_id, seqid)
        on delete restrict
        not valid;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

