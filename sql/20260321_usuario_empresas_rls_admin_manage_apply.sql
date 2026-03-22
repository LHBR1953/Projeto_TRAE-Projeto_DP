begin;

alter table public.usuario_empresas enable row level security;

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

drop policy if exists "Users can view their own tenant mappings" on public.usuario_empresas;
create policy "Users can view their own tenant mappings"
on public.usuario_empresas
for select
using (auth.uid()::text = usuario_id::text);

drop policy if exists "Admins can view all users in their company" on public.usuario_empresas;
create policy "Admins can view all users in their company"
on public.usuario_empresas
for select
using (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  or public.is_superadmin()
);

drop policy if exists "Admins can manage users in their company" on public.usuario_empresas;
create policy "Admins can manage users in their company"
on public.usuario_empresas
for all
using (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  or public.is_superadmin()
)
with check (
  public.is_admin_of_empresa(usuario_empresas.empresa_id)
  or public.is_superadmin()
);

notify pgrst, 'reload schema';

commit;
