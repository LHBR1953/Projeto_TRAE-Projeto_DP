begin;

alter table public.empresas
  add column if not exists identificador text,
  add column if not exists email text,
  add column if not exists assinatura_status text;

do $$
begin
  update public.empresas
  set identificador = id
  where identificador is null or btrim(identificador) = '';

  update public.empresas
  set email = ('contato+' || id || '@occ.local')
  where email is null or btrim(email) = '';

  update public.empresas
  set assinatura_status = 'ATIVA'
  where assinatura_status is null or btrim(assinatura_status) = '';

  if exists (
    select 1
    from public.empresas
    group by identificador
    having count(*) > 1
  ) then
    raise exception 'empresas.identificador possui duplicidade. Resolva antes de aplicar UNIQUE.';
  end if;

  alter table public.empresas
    alter column identificador set not null,
    alter column email set not null,
    alter column assinatura_status set not null,
    alter column nome set not null;

  if not exists (
    select 1 from pg_constraint
    where conname = 'empresas_identificador_unique'
  ) then
    alter table public.empresas
      add constraint empresas_identificador_unique unique (identificador);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
