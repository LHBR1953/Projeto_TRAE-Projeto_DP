import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

function normalizeKey(input: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isMissingColumnError(err: unknown): boolean {
  const msg = err && typeof err === "object" && "message" in err ? String((err as any).message || "") : String(err || "");
  return /column .* does not exist/i.test(msg);
}

function isDuplicateKeyError(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as any).code || "") : "";
  const msg = err && typeof err === "object" && "message" in err ? String((err as any).message || "") : String(err || "");
  return code === "23505" || /duplicate key/i.test(msg);
}

function buildFullPermissions() {
  return {
    dashboard: { select: true, insert: true, update: true, delete: true },
    pacientes: { select: true, insert: true, update: true, delete: true },
    profissionais: { select: true, insert: true, update: true, delete: true },
    especialidades: { select: true, insert: true, update: true, delete: true },
    servicos: { select: true, insert: true, update: true, delete: true },
    orcamentos: { select: true, insert: true, update: true, delete: true },
    financeiro: { select: true, insert: true, update: true, delete: true },
    comissoes: { select: true, insert: true, update: true, delete: true },
    marketing: { select: true, insert: true, update: true, delete: true },
    atendimento: { select: true, insert: true, update: true, delete: true },
    agenda: { select: true, insert: true, update: true, delete: true },
    protese: { select: true, insert: true, update: true, delete: true },
  };
}

function generateEmpresaId(): string {
  const raw = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `emp_${raw}`;
}

function addDaysYmd(days: number): string {
  const ms = Math.max(0, Math.floor(Number(days) || 0)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString().slice(0, 10);
}

async function tryInsertEmpresa(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<void> {
  const attempts: Array<Record<string, unknown>> = [];
  attempts.push(payload);
  attempts.push({ id: payload.id, identificador: payload.identificador, nome: payload.nome, email: payload.email, assinatura_status: payload.assinatura_status });
  attempts.push({ id: payload.id, nome: payload.nome });

  let lastErr: any = null;
  for (const p of attempts) {
    const { error } = await supabaseAdmin.from("empresas").insert(p);
    if (!error) return;
    lastErr = error;
    if (!isMissingColumnError(error)) break;
  }
  throw lastErr || new Error("Falha ao criar empresa.");
}

async function tryUpsertMapping(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<void> {
  const attempts: Array<{ row: Record<string, unknown>; opts?: any }> = [];
  attempts.push({ row: payload, opts: { onConflict: "usuario_id,empresa_id" } });
  attempts.push({ row: { usuario_id: payload.usuario_id, empresa_id: payload.empresa_id, perfil: payload.perfil }, opts: { onConflict: "usuario_id,empresa_id" } });
  attempts.push({ row: { usuario_id: payload.usuario_id, empresa_id: payload.empresa_id, perfil: payload.perfil } });

  let lastErr: any = null;
  for (const a of attempts) {
    const { error } = await supabaseAdmin.from("usuario_empresas").upsert(a.row as any, a.opts);
    if (!error) return;
    lastErr = error;
    if (!isMissingColumnError(error)) break;
  }
  throw lastErr || new Error("Falha ao criar vínculo do usuário.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header.");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    if (verifyError || !callerUser) throw new Error("Unauthorized caller. Invalid token.");

    const body = await req.json();
    const nome = String(body.nome || "").trim();
    const email = normalizeEmail(body.email || callerUser.email || "");
    const celular = String(body.celular || "").trim() || null;

    if (!nome) throw new Error("Nome da clínica é obrigatório.");
    if (!email) throw new Error("E-mail é obrigatório.");

    const { data: existingMaps, error: mapErr } = await supabaseAdmin
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("usuario_id", callerUser.id)
      .limit(1);
    if (mapErr) throw mapErr;
    if (existingMaps && existingMaps.length > 0) {
      throw new Error("Seu usuário já está vinculado a uma clínica. Entre em contato para ajustar o vínculo.");
    }

    let empresaId = generateEmpresaId();
    const assinaturaStatus = "TRIAL";
    const dataVencimento = addDaysYmd(30);
    const permissions = buildFullPermissions();

    for (let i = 0; i < 5; i += 1) {
      try {
        await tryInsertEmpresa(supabaseAdmin, {
          id: empresaId,
          identificador: empresaId,
          nome,
          email,
          assinatura_status: assinaturaStatus,
          celular,
          data_vencimento: dataVencimento,
        });
        break;
      } catch (e: any) {
        if (isDuplicateKeyError(e)) {
          empresaId = generateEmpresaId();
          continue;
        }
        throw e;
      }
    }

    try {
      await tryUpsertMapping(supabaseAdmin, {
        usuario_id: callerUser.id,
        empresa_id: empresaId,
        perfil: "admin",
        user_email: email,
        permissoes: permissions,
        require_password_change: false,
      });
    } catch (e) {
      try { await supabaseAdmin.from("empresas").delete().eq("id", empresaId); } catch {}
      throw e;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        empresa_id: empresaId,
        empresa_nome: nome,
        assinatura_status: assinaturaStatus,
        data_vencimento: dataVencimento,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
