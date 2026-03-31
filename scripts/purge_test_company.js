import { createClient } from '@supabase/supabase-js';

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function cleanSupabaseUrl(input) {
  let v = String(input || '').trim();
  v = v.replace(/^`|`$/g, '').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
  v = v.replace(/\\+/g, '/');
  v = v.replace(/\/+$/, '');
  const u = new URL(v);
  if (u.protocol !== 'https:') throw new Error('SUPABASE_URL must start with https://');
  return u.toString().replace(/\/+$/, '');
}

async function main() {
  const supabaseUrl = cleanSupabaseUrl(reqEnv('SUPABASE_URL'));
  const supabaseAnonKey = reqEnv('SUPABASE_ANON_KEY');
  const superEmail = normalizeEmail(reqEnv('SUPERADMIN_EMAIL'));
  const superPassword = reqEnv('SUPERADMIN_PASSWORD');
  const empresaId = String(process.env.EMPRESA_ID || '').trim();

  if (!empresaId) throw new Error('Missing env: EMPRESA_ID');

  const db = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await db.auth.signInWithPassword({
    email: superEmail,
    password: superPassword,
  });
  if (authErr) throw authErr;
  if (!authData.session) throw new Error('No session after signIn.');

  const fnUrl = `${supabaseUrl}/functions/v1/purge-tenant-company`;
  let resp;
  try {
    resp = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ empresa_id: empresaId }),
    });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    throw new Error(`Fetch failed for ${fnUrl}: ${msg}`);
  }

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(JSON.stringify(payload));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
