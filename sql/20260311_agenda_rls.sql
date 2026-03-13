begin;

do $$
begin
  if to_regclass('public.agenda_disponibilidade') is not null then
    execute 'alter table public.agenda_disponibilidade enable row level security';

    execute 'drop policy if exists "Users can view agenda disponibilidade of their company" on public.agenda_disponibilidade';
    execute $p$
      create policy "Users can view agenda disponibilidade of their company"
      on public.agenda_disponibilidade
      for select
      using (
        public.is_member_of_empresa(agenda_disponibilidade.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can insert agenda disponibilidade in their company" on public.agenda_disponibilidade';
    execute $p$
      create policy "Users can insert agenda disponibilidade in their company"
      on public.agenda_disponibilidade
      for insert
      with check (
        public.is_member_of_empresa(agenda_disponibilidade.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can update agenda disponibilidade in their company" on public.agenda_disponibilidade';
    execute $p$
      create policy "Users can update agenda disponibilidade in their company"
      on public.agenda_disponibilidade
      for update
      using (
        public.is_member_of_empresa(agenda_disponibilidade.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
      with check (
        public.is_member_of_empresa(agenda_disponibilidade.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can delete agenda disponibilidade in their company" on public.agenda_disponibilidade';
    execute $p$
      create policy "Users can delete agenda disponibilidade in their company"
      on public.agenda_disponibilidade
      for delete
      using (
        public.is_member_of_empresa(agenda_disponibilidade.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.agenda_agendamentos') is not null then
    execute 'alter table public.agenda_agendamentos enable row level security';

    execute 'drop policy if exists "Users can view agenda agendamentos of their company" on public.agenda_agendamentos';
    execute $p$
      create policy "Users can view agenda agendamentos of their company"
      on public.agenda_agendamentos
      for select
      using (
        public.is_member_of_empresa(agenda_agendamentos.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can insert agenda agendamentos in their company" on public.agenda_agendamentos';
    execute $p$
      create policy "Users can insert agenda agendamentos in their company"
      on public.agenda_agendamentos
      for insert
      with check (
        public.is_member_of_empresa(agenda_agendamentos.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can update agenda agendamentos in their company" on public.agenda_agendamentos';
    execute $p$
      create policy "Users can update agenda agendamentos in their company"
      on public.agenda_agendamentos
      for update
      using (
        public.is_member_of_empresa(agenda_agendamentos.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
      with check (
        public.is_member_of_empresa(agenda_agendamentos.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;

    execute 'drop policy if exists "Users can delete agenda agendamentos in their company" on public.agenda_agendamentos';
    execute $p$
      create policy "Users can delete agenda agendamentos in their company"
      on public.agenda_agendamentos
      for delete
      using (
        public.is_member_of_empresa(agenda_agendamentos.empresa_id)
        or coalesce(auth.jwt() ->> 'email', '') = 'lhbr@lhbr.com.br'
      )
    $p$;
  end if;
end $$;

commit;
