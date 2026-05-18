alter table if exists usage_models
  add column if not exists include_biosseguranca boolean default true;

update usage_models
set include_biosseguranca = true
where include_biosseguranca is null;
