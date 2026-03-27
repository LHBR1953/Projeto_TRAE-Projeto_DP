begin;

create table if not exists public.profissional_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  profissional_id text not null references public.profissionais(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users(id)
);

create unique index if not exists profissional_usuarios_empresa_usuario_uidx
  on public.profissional_usuarios (empresa_id, usuario_id);

create unique index if not exists profissional_usuarios_empresa_profissional_uidx
  on public.profissional_usuarios (empresa_id, profissional_id);

alter table public.profissional_usuarios enable row level security;

create policy "Users can view profissional_usuarios of their company"
  on public.profissional_usuarios for select
  using (
    exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = profissional_usuarios.empresa_id
    )
  );

create policy "Admins can manage profissional_usuarios"
  on public.profissional_usuarios for all
  using (
    exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = profissional_usuarios.empresa_id
        and ue.perfil = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = auth.uid()
        and ue.empresa_id = profissional_usuarios.empresa_id
        and ue.perfil = 'admin'
    )
  );

notify pgrst, 'reload schema';

commit;
