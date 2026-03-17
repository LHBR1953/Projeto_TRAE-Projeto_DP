begin;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'orcamento_itens_protese_laboratorio_fk'
  ) then
    alter table public.orcamento_itens drop constraint orcamento_itens_protese_laboratorio_fk;
  end if;
  if exists (
    select 1 from pg_constraint where conname = 'orcamento_itens_protese_tipo_execucao_chk'
  ) then
    alter table public.orcamento_itens drop constraint orcamento_itens_protese_tipo_execucao_chk;
  end if;
end $$;

drop index if exists public.orcamento_itens_empresa_protese_laboratorio_idx;

alter table public.orcamento_itens
  drop column if exists protese_laboratorio_id;

alter table public.orcamento_itens
  drop column if exists protese_tipo_execucao;

commit;

