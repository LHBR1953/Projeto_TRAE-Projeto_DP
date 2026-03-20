const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMPRESA_ID = process.env.EMPRESA_ID;
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'backup_empresa');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EMPRESA_ID) {
  process.stderr.write('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMPRESA_ID\n');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = [
  'empresas',
  'usuario_empresas',
  'pacientes',
  'paciente_evolucao',
  'paciente_documentos',
  'profissionais',
  'especialidades',
  'especialidade_subdivisoes',
  'servicos',
  'orcamentos',
  'orcamento_itens',
  'orcamento_pagamentos',
  'agenda_disponibilidade',
  'agenda_agendamentos',
  'financeiro_transacoes',
  'financeiro_comissoes',
  'orcamento_cancelados',
  'laboratorios_proteticos',
  'ordens_proteticas',
  'ordens_proteticas_eventos',
  'ordens_proteticas_anexos',
  'occ_audit_log',
];

async function tableExists(table) {
  const { error } = await db.from(table).select('*', { count: 'exact', head: true }).limit(1);
  if (!error) return true;
  const msg = String(error.message || '');
  if (msg.includes('does not exist') || msg.includes('schema cache')) return false;
  return true;
}

async function exportTable(table) {
  if (!(await tableExists(table))) return { skipped: true };

  if (table === 'empresas') {
    const { data, error } = await db.from('empresas').select('*').eq('id', EMPRESA_ID);
    if (error) throw error;
    return { data: data || [] };
  }

  const { data, error } = await db.from(table).select('*').eq('empresa_id', EMPRESA_ID).limit(100000);
  if (error) throw error;
  return { data: data || [] };
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const meta = {
    empresa_id: EMPRESA_ID,
    exported_at: new Date().toISOString(),
    tables: {},
  };

  for (const table of TABLES) {
    process.stdout.write(`Exporting ${table}...\n`);
    try {
      const res = await exportTable(table);
      if (res.skipped) {
        meta.tables[table] = { skipped: true };
        continue;
      }
      const filePath = path.join(OUT_DIR, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(res.data, null, 2), 'utf8');
      meta.tables[table] = { rows: res.data.length, file: filePath };
    } catch (e) {
      meta.tables[table] = { error: String(e && e.message ? e.message : e) };
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, `_meta.json`), JSON.stringify(meta, null, 2), 'utf8');
  process.stdout.write(`Done. Output: ${OUT_DIR}\n`);
}

run().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});

