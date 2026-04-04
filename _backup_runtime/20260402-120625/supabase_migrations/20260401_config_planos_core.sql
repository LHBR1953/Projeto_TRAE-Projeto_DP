begin;

create table if not exists public.config_planos (
  id uuid primary key default gen_random_uuid(),
  tipo_assinatura text not null,
  valor_plano text not null,
  modulos_texto text not null,
  destaque boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists config_planos_tipo_assinatura_uidx
on public.config_planos (lower(tipo_assinatura));

alter table public.config_planos enable row level security;

drop policy if exists "config_planos_select_public" on public.config_planos;
create policy "config_planos_select_public"
on public.config_planos
for select
using (true);

drop policy if exists "config_planos_write_superadmin" on public.config_planos;
create policy "config_planos_write_superadmin"
on public.config_planos
for all
using (public.is_superadmin())
with check (public.is_superadmin());

grant select on public.config_planos to anon, authenticated;
grant insert, update, delete on public.config_planos to authenticated;

insert into public.config_planos (tipo_assinatura, valor_plano, modulos_texto, destaque)
select 'R$ 100', 'R$ 100', 'Rotina completa, financeiro e suporte por mensagem', false
where not exists (select 1 from public.config_planos);

insert into public.config_planos (tipo_assinatura, valor_plano, modulos_texto, destaque)
select 'R$ 200', 'R$ 200', 'Tudo do R$ 100 com suporte telefônico e prioridade', true
where not exists (
  select 1 from public.config_planos where lower(tipo_assinatura) = lower('R$ 200')
);

notify pgrst, 'reload schema';

commit;
