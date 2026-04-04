const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TOTAL = Number(process.env.TARGET_TOTAL || 500);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getEmpresaId() {
  const { data, error } = await db.from('empresas').select('id').limit(1);
  if (error) throw error;
  if (!Array.isArray(data) || !data.length) throw new Error('Nenhuma empresa encontrada.');
  return String(data[0].id || '').trim();
}

async function getCount(empresaId) {
  const { count, error } = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
  if (error) throw error;
  return Number(count || 0);
}

async function deleteNewest(empresaId, qty, onlyComplementar) {
  if (qty <= 0) return 0;
  let query = db.from('inventory').select('id').eq('empresa_id', empresaId);
  if (onlyComplementar) query = query.ilike('nome', 'Item Complementar %');
  const { data, error } = await query.order('created_at', { ascending: false }).limit(qty);
  if (error) throw error;
  const ids = (data || []).map(r => String(r.id || '')).filter(Boolean);
  if (!ids.length) return 0;
  const { error: miErr } = await db.from('model_items').delete().in('inventory_id', ids);
  if (miErr) throw miErr;
  const { error: logErr } = await db.from('inventory_logs').delete().in('inventory_id', ids);
  if (logErr) throw logErr;
  const { error: delErr } = await db.from('inventory').delete().in('id', ids);
  if (delErr) throw delErr;
  return ids.length;
}

async function run() {
  const empresaId = await getEmpresaId();
  let current = await getCount(empresaId);
  if (current <= TARGET_TOTAL) {
    process.stdout.write(`inventory_total_count=${current}\n`);
    return;
  }
  let excess = current - TARGET_TOTAL;
  const delComp = await deleteNewest(empresaId, excess, true);
  current = await getCount(empresaId);
  excess = current - TARGET_TOTAL;
  if (excess > 0) {
    await deleteNewest(empresaId, excess, false);
  }
  current = await getCount(empresaId);
  process.stdout.write(`inventory_total_count=${current}\n`);
  process.stdout.write(`deleted_complementar=${delComp}\n`);
}

run().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
