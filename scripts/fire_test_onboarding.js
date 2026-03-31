import { createClient } from '@supabase/supabase-js';

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

async function main() {
  const supabaseUrl = reqEnv('SUPABASE_URL');
  const supabaseAnonKey = reqEnv('SUPABASE_ANON_KEY');
  const superEmail = normalizeEmail(reqEnv('SUPERADMIN_EMAIL'));
  const superPassword = reqEnv('SUPERADMIN_PASSWORD');

  const db = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authData, error: authErr } = await db.auth.signInWithPassword({
    email: superEmail,
    password: superPassword,
  });
  if (authErr) throw authErr;
  if (!authData.session) throw new Error('No session after signIn.');

  const empresa_id = 'gemini_teste';
  const nome = 'Clínica de Teste Gemini';
  const email = 'gemini.teste@occ.local';

  const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/create-tenant-company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.session.access_token}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      empresa_id,
      identificador: empresa_id,
      nome,
      email,
      assinatura_status: 'ATIVA',
      supervisor_pin: '0000',
    }),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Function error: ${JSON.stringify(payload)}`);
  }

  const adminEmail = normalizeEmail(payload.admin_email || email);

  const { data: linkRows, error: linkErr } = await db
    .from('usuario_empresas')
    .select('usuario_id, empresa_id, perfil, user_email, permissoes')
    .eq('empresa_id', empresa_id)
    .eq('user_email', adminEmail)
    .limit(1);
  if (linkErr) throw linkErr;
  const link = Array.isArray(linkRows) ? linkRows[0] : null;
  if (!link) throw new Error('No usuario_empresas link found.');

  const perm = link.permissoes || {};
  const okAll = ['dashboard', 'pacientes', 'profissionais', 'especialidades', 'servicos', 'orcamentos', 'financeiro', 'comissoes', 'marketing', 'atendimento', 'agenda', 'protese']
    .every((k) => perm && perm[k] && perm[k].select === true && perm[k].insert === true && perm[k].update === true && perm[k].delete === true);

  const report = {
    empresa_id,
    empresa_nome: nome,
    admin_email: adminEmail,
    perfil: link.perfil,
    full_permissions: okAll,
    admin_password: payload.admin_password || null,
    message: payload.message || null,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});

