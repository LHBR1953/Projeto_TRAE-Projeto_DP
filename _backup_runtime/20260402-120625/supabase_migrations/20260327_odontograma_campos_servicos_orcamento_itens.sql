begin;

alter table public.servicos
  add column if not exists exige_elemento boolean not null default false;

alter table public.servicos
  add column if not exists tipo_calculo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'servicos_tipo_calculo_chk'
  ) then
    alter table public.servicos
      add constraint servicos_tipo_calculo_chk
      check (tipo_calculo is null or tipo_calculo in ('Fixo','Por Elemento'));
  end if;
end $$;

alter table public.orcamento_itens
  add column if not exists elementos jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';

commit;
