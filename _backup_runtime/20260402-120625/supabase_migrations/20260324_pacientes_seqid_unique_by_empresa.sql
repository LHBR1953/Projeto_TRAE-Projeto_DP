begin;

do $$
begin
  if to_regclass('public.pacientes') is null then
    return;
  end if;

  alter table public.pacientes
    drop constraint if exists pacientes_seqid_unique;

  alter table public.pacientes
    drop constraint if exists pacientes_empresa_seqid_unique;

  if exists (
    select 1
    from public.pacientes
    group by empresa_id, seqid
    having count(*) > 1
  ) then
    raise exception 'Existem duplicidades de (empresa_id, seqid) em public.pacientes. Corrija antes de aplicar a constraint.';
  end if;

  alter table public.pacientes
    add constraint pacientes_empresa_seqid_unique unique (empresa_id, seqid);
end $$;

notify pgrst, 'reload schema';

commit;

