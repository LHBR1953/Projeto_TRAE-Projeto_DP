begin;

do $$
declare
  has_data_pagamento boolean := false;
  has_criado_em boolean := false;
begin
  if to_regclass('public.financeiro_comissoes') is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financeiro_comissoes'
      and column_name = 'data_pagamento'
  ) into has_data_pagamento;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financeiro_comissoes'
      and column_name = 'criado_em'
  ) into has_criado_em;

  if has_data_pagamento then
    execute $sql$
      update public.financeiro_comissoes
      set data_geracao = coalesce(data_geracao, data_pagamento, now())
      where data_geracao is null
    $sql$;
  elsif has_criado_em then
    execute $sql$
      update public.financeiro_comissoes
      set data_geracao = coalesce(data_geracao, criado_em, now())
      where data_geracao is null
    $sql$;
  else
    update public.financeiro_comissoes
    set data_geracao = coalesce(data_geracao, now())
    where data_geracao is null;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
