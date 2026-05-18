const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  // Prefer dotenv when installed (local .env)
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // Fallback manual parser below keeps compatibility without dependency.
}

function loadDotEnvIfPresent() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const s = String(line || '').trim();
    if (!s || s.startsWith('#')) return;
    const idx = s.indexOf('=');
    if (idx <= 0) return;
    const key = s.slice(0, idx).trim();
    let val = s.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

loadDotEnvIfPresent();

const root = __dirname;
const port = Number(process.env.PORT || 8282);
const host = process.env.HOST ? String(process.env.HOST) : null;

const mimes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += String(chunk || ''); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function supabaseRest(pathname, { method = 'GET', body = null, prefer = '' } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.');
  }
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`Supabase REST ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function toYmd(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
}

async function insertPagamentoLog(payload) {
  const attempts = [
    { empresa_id: payload.empresa_id, customer_id: payload.customer_id, status: payload.status, valor: payload.valor, transacao_id: payload.transacao_id, payload_json: payload.payload_json, created_at: payload.created_at },
    { empresa_id: payload.empresa_id, customer_id: payload.customer_id, status: payload.status, valor: payload.valor, transacao_id: payload.transacao_id, payload: payload.payload_json, data_evento: payload.created_at },
    { empresa_id: payload.empresa_id, status: payload.status, valor: payload.valor, transacao_id: payload.transacao_id }
  ];
  let lastErr = null;
  for (const body of attempts) {
    try {
      await supabaseRest('/rest/v1/pagamentos_log', { method: 'POST', body, prefer: 'return=minimal' });
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return false;
}

function safeJoin(base, target) {
  const targetPath = path.resolve(base, '.' + target);
  if (!targetPath.startsWith(path.resolve(base))) return null;
  return targetPath;
}

const server = http.createServer((req, res) => {
  try {
    process.stdout.write(`${new Date().toISOString()} ${req.method || 'GET'} ${req.url || '/'}\n`);
    const reqPathRaw = decodeURIComponent((req.url || '/').split('?')[0]);
    const reqPath = reqPathRaw.replace(/\/+$/, '') || '/';
    if ((req.method || 'GET').toUpperCase() === 'POST' && reqPath === '/api/pagamentos/callback') {
      (async () => {
        try {
          const body = await readJsonBody(req);
          const customerId = String(body.customer_id || body.empresa_id || body.unidade_id || body.id || '').trim();
          const status = String(body.status || '').trim().toLowerCase();
          const valor = Number(body.valor || 0) || 0;
          const transacaoId = String(body.transacao_id || body.transaction_id || body.txid || '').trim();
          if (!customerId) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'customer_id/empresa_id obrigatório' }));
            return;
          }
          if (!status) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'status obrigatório' }));
            return;
          }
          if (status !== 'pago') {
            await insertPagamentoLog({
              empresa_id: customerId,
              customer_id: customerId,
              status,
              valor,
              transacao_id: transacaoId,
              payload_json: body,
              created_at: new Date().toISOString()
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, message: 'Callback recebido sem ativação (status diferente de pago).' }));
            return;
          }

          const empresaRows = await supabaseRest(`/rest/v1/empresas?id=eq.${encodeURIComponent(customerId)}&select=id,data_vencimento,assinatura_status&limit=1`);
          const empresa = Array.isArray(empresaRows) ? empresaRows[0] : null;
          if (!empresa) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Empresa não encontrada.' }));
            return;
          }

          const now = new Date();
          const vencAtual = empresa.data_vencimento ? new Date(`${String(empresa.data_vencimento).slice(0, 10)}T23:59:59.999Z`) : null;
          const base = (vencAtual && Number.isFinite(vencAtual.getTime()) && vencAtual > now) ? vencAtual : now;
          const novoVenc = new Date(base.getTime());
          novoVenc.setDate(novoVenc.getDate() + 30);
          const novoVencYmd = toYmd(novoVenc);

          await supabaseRest(`/rest/v1/empresas?id=eq.${encodeURIComponent(customerId)}`, {
            method: 'PATCH',
            body: { assinatura_status: 'ATIVO', data_vencimento: novoVencYmd },
            prefer: 'return=minimal'
          });

          await insertPagamentoLog({
            empresa_id: customerId,
            customer_id: customerId,
            status: 'pago',
            valor,
            transacao_id: transacaoId,
            payload_json: body,
            created_at: new Date().toISOString()
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, empresa_id: customerId, assinatura_status: 'ATIVO', data_vencimento: novoVencYmd }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e && e.message ? e.message : 'callback_error', detail: e && e.payload ? e.payload : null }));
        }
      })();
      return;
    }
    const urlPath = reqPath;
    const normalized = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = safeJoin(root, normalized);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      });

      fs.createReadStream(filePath).pipe(res);
    });
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

const onListening = () => {
  console.log(`Serving ${root}`);
  console.log(`Open http://localhost:${port}/`);
  console.log(`Open http://127.0.0.1:${port}/`);
  console.log('Keep this window open while using the system.');
};

if (host) {
  server.listen(port, host, onListening);
} else {
  server.listen(port, onListening);
}
