begin;

alter table public.financeiro_comissoes enable row level security;

drop policy if exists "Users can view commissions of their company" on public.financeiro_comissoes;
create policy "Users can view commissions of their company"
on public.financeiro_comissoes
for select
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = financeiro_comissoes.empresa_id
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

drop policy if exists "Admins can manage commissions of their company" on public.financeiro_comissoes;
create policy "Admins can manage commissions of their company"
on public.financeiro_comissoes
for insert
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = financeiro_comissoes.empresa_id
      and lower(coalesce(ue.perfil, '')) in ('admin', 'supervisor')
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

create policy "Admins can update commissions of their company"
on public.financeiro_comissoes
for update
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = financeiro_comissoes.empresa_id
      and lower(coalesce(ue.perfil, '')) in ('admin', 'supervisor')
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
)
with check (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = financeiro_comissoes.empresa_id
      and lower(coalesce(ue.perfil, '')) in ('admin', 'supervisor')
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

create policy "Admins can delete commissions of their company"
on public.financeiro_comissoes
for delete
using (
  exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = financeiro_comissoes.empresa_id
      and lower(coalesce(ue.perfil, '')) in ('admin', 'supervisor')
  )
  or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
);

notify pgrst, 'reload schema';

commit;

