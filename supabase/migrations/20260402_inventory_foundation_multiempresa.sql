create extension if not exists "uuid-ossp";

create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references auth.users(id),
  nome text not null,
  unidade text,
  estoque_atual decimal default 0,
  estoque_minimo decimal default 0,
  created_at timestamp with time zone default now()
);

create table if not exists usage_models (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references auth.users(id),
  nome_modelo text not null,
  created_at timestamp with time zone default now()
);

create table if not exists model_items (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references usage_models(id) on delete cascade,
  inventory_id uuid references inventory(id),
  quantidade_sugerida decimal default 1
);

create table if not exists service_mapping (
  service_id uuid references services(id),
  model_id uuid references usage_models(id)
);

create table if not exists inventory_logs (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references auth.users(id),
  inventory_id uuid references inventory(id),
  atendimento_id uuid,
  tipo text,
  quantidade decimal,
  responsavel_id uuid references auth.users(id),
  data_hora timestamp with time zone default now()
);
