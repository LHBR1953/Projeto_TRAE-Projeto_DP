begin;

alter table public.ordens_proteticas
  add column if not exists origem_trabalho text,
  add column if not exists material_tipo text,
  add column if not exists prova_motivo text,
  add column if not exists prova_custo_responsabilidade text,
  add column if not exists prova_reprovada_at timestamptz,
  add column if not exists entregue_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ordens_proteticas_origem_trabalho_chk') then
    alter table public.ordens_proteticas
      add constraint ordens_proteticas_origem_trabalho_chk
      check (origem_trabalho is null or origem_trabalho in ('MOLDAGEM_CLINICA','MOLDE_EXTERNO'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ordens_proteticas_material_tipo_chk') then
    alter table public.ordens_proteticas
      add constraint ordens_proteticas_material_tipo_chk
      check (material_tipo is null or material_tipo in ('FISICO','DIGITAL'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'ordens_proteticas_prova_custo_chk') then
    alter table public.ordens_proteticas
      add constraint ordens_proteticas_prova_custo_chk
      check (prova_custo_responsabilidade is null or prova_custo_responsabilidade in ('GARANTIA_LAB','CUSTO_EXTRA'));
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
