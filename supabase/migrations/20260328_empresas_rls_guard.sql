begin;

alter table public.empresas enable row level security;

drop policy if exists "empresas_select_member_or_superadmin" on public.empresas;
create policy "empresas_select_member_or_superadmin"
on public.empresas
for select
using (
  public.is_superadmin()
  or exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = empresas.id
  )
);

drop policy if exists "empresas_write_superadmin_only" on public.empresas;
create policy "empresas_write_superadmin_only"
on public.empresas
for all
using (public.is_superadmin())
with check (public.is_superadmin());

notify pgrst, 'reload schema';

commit;
