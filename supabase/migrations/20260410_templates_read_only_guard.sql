create or replace function public.guard_template_read_only()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Ação Bloqueada: Tabelas de Template são apenas leitura para garantir a integridade do sistema. Use migrations oficiais para alterações.';
end;
$$;

do $$
begin
  if to_regclass('public.usage_models_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_usage_models on public.usage_models_template';
    execute 'create trigger trg_guard_template_read_only_usage_models before insert or update or delete on public.usage_models_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.model_items_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_model_items on public.model_items_template';
    execute 'create trigger trg_guard_template_read_only_model_items before insert or update or delete on public.model_items_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.inventory_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_inventory on public.inventory_template';
    execute 'create trigger trg_guard_template_read_only_inventory before insert or update or delete on public.inventory_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.servicos_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_servicos on public.servicos_template';
    execute 'create trigger trg_guard_template_read_only_servicos before insert or update or delete on public.servicos_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.services_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_services on public.services_template';
    execute 'create trigger trg_guard_template_read_only_services before insert or update or delete on public.services_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.specialties_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_specialties on public.specialties_template';
    execute 'create trigger trg_guard_template_read_only_specialties before insert or update or delete on public.specialties_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.especialidades_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_especialidades on public.especialidades_template';
    execute 'create trigger trg_guard_template_read_only_especialidades before insert or update or delete on public.especialidades_template for each row execute function public.guard_template_read_only()';
  end if;

  if to_regclass('public.service_mapping_template') is not null then
    execute 'drop trigger if exists trg_guard_template_read_only_service_mapping on public.service_mapping_template';
    execute 'create trigger trg_guard_template_read_only_service_mapping before insert or update or delete on public.service_mapping_template for each row execute function public.guard_template_read_only()';
  end if;
end
$$;

notify pgrst, 'reload schema';
