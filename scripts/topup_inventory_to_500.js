const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_TOTAL = Number(process.env.TARGET_TOTAL || 500);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  const emp = await db.from('empresas').select('id').limit(1);
  if (emp.error) throw emp.error;
  const empresaId = String(emp.data[0].id);
  const models = await db.from('usage_models').select('id,nome_modelo').eq('empresa_id', empresaId);
  if (models.error) throw models.error;
  const modelIds = (models.data || [])
    .filter(m => String(m.nome_modelo || '').toLowerCase().startsWith('kit '))
    .map(m => String(m.id));
  if (!modelIds.length) throw new Error('Nenhum modelo Kit encontrado.');

  const countRes = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
  if (countRes.error) throw countRes.error;
  let total = Number(countRes.count || 0);
  let seq = 1;

  while (total < TARGET_TOTAL) {
    const nome = `Item Complementar ${String(seq).padStart(4, '0')}`;
    const up = await db.from('inventory').upsert({
      empresa_id: empresaId,
      nome,
      unidade: 'un',
      estoque_atual: 0,
      estoque_minimo: 0,
      eh_consumivel: seq % 5 !== 0,
      codigo_barras: null,
    }, { onConflict: 'empresa_id,nome' }).select('id').single();
    if (up.error) throw up.error;
    const inventoryId = String(up.data.id);
    const modelId = modelIds[(seq - 1) % modelIds.length];
    const ex = await db.from('model_items').select('id').eq('model_id', modelId).eq('inventory_id', inventoryId).maybeSingle();
    if (ex.error) throw ex.error;
    if (!(ex.data && ex.data.id)) {
      const mi = await db.from('model_items').insert({ model_id: modelId, inventory_id: inventoryId, quantidade_sugerida: 1 });
      if (mi.error) throw mi.error;
    }
    seq += 1;
    const c = await db.from('inventory').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId);
    if (c.error) throw c.error;
    total = Number(c.count || 0);
  }

  process.stdout.write(`inventory_total_count=${total}\n`);
}

run().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : JSON.stringify(e)) + '\n');
  process.exit(1);
});
