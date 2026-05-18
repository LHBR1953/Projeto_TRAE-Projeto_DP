alter table if exists inventory
  add column if not exists tipo_inventario text;

update inventory
set tipo_inventario = case
  when coalesce(nullif(btrim(tipo_inventario), ''), '') <> '' then tipo_inventario
  when eh_consumivel is true then 'consumiveis'
  when eh_consumivel is false then 'instrumentais'
  else 'consumiveis'
end;
