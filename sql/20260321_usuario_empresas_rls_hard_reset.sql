begin;

alter table public.usuario_empresas enable row level security;

do $$
declare
  r record;
begin
  if to_regclass('public.usuario_empresas') is null then
    return;
  end if;

  for r in (
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'usuario_empresas'
  ) loop
    execute format('drop policy if exists %I on public.usuario_empresas', r.policyname);
  end loop;
end $$;

create or replace function public.is_admin_of_empresa(target_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id::text = auth.uid()::text
      and ue.empresa_id = target_empresa_id
      and lower(ue.perfil) = 'admin'
  );
$$;

grant execute on function public.is_admin_of_empresa(text) to authenticated;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'email', current_setting('request.jwt.claim.email', true), '') = 'lhbr@lhbr.com.br';
$$;

grant execute on function public.is_superadmin() to authenticated;

create policy "Users can view their own tenant mappings"
on public.usuario_empresas
for select
using (auth.uid()::text = usuario_id::text);

create policy "Admins can view all users in their company"
on public.usuario_empresas
for select
using (public.is_admin_of_empresa(usuario_empresas.empresa_id) or public.is_superadmin());

create policy "Admins can insert users in their company"
on public.usuario_empresas
for insert
with check (public.is_admin_of_empresa(usuario_empresas.empresa_id) or public.is_superadmin());

create policy "Admins can update users in their company"
on public.usuario_empresas
for update
using (public.is_admin_of_empresa(usuario_empresas.empresa_id) or public.is_superadmin())
with check (public.is_admin_of_empresa(usuario_empresas.empresa_id) or public.is_superadmin());

create policy "Admins can delete users in their company"
on public.usuario_empresas
for delete
using (public.is_admin_of_empresa(usuario_empresas.empresa_id) or public.is_superadmin());

notify pgrst, 'reload schema';

commit;

