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

function buildDefaultSpecialtyTemplate() {
  return [
    { seqid: 1, nome: "1 - CLÍNICA GERAL", subs: ["1.1 - CONSULTA / AVALIAÇÃO", "1.2 - PROFILAXIA", "1.3 - RESTAURAÇÃO"] },
    { seqid: 2, nome: "2 - ORTODONTIA", subs: ["2.1 - PREVENTIVA", "2.2 - INTERCEPTATIVA"] },
    { seqid: 3, nome: "3 - IMPLANTODONTIA", subs: ["3.1 - PLANEJAMENTO", "3.2 - IMPLANTE UNITÁRIO"] },
  ];
}

async function seedSpecialtiesForEmpresa(
  supabaseAdmin: ReturnType<typeof createClient>,
  empresaId: string,
): Promise<void> {
  const target = String(empresaId || "").trim();
  if (!target) return;

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("especialidades")
    .select("id")
    .eq("empresa_id", target)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) return;

  const templateEmpresaId = String(Deno.env.get("SPECIALTIES_TEMPLATE_EMPRESA_ID") || "emp_master").trim();
  const { data: templateSpecs, error: tplSpecErr } = await supabaseAdmin
    .from("especialidades")
    .select("id,seqid,nome")
    .eq("empresa_id", templateEmpresaId)
    .order("seqid", { ascending: true });
  if (tplSpecErr) throw tplSpecErr;

  const specs = Array.isArray(templateSpecs) ? templateSpecs : [];
  if (specs.length > 0) {
    const oldToNew = new Map<string, string>();
    for (const s of specs) {
      const newId = crypto.randomUUID();
      oldToNew.set(String(s.id || ""), newId);
      const { error } = await supabaseAdmin.from("especialidades").insert({
        id: newId,
        seqid: Number(s.seqid || 0),
        nome: String(s.nome || "").trim(),
        empresa_id: target,
      });
      if (error) throw error;
    }

    const { data: templateSubs, error: tplSubErr } = await supabaseAdmin
      .from("especialidade_subdivisoes")
      .select("especialidade_id,nome")
      .eq("empresa_id", templateEmpresaId);
    if (tplSubErr) throw tplSubErr;

    for (const sub of (templateSubs || [])) {
      const mappedSpecId = oldToNew.get(String(sub && sub.especialidade_id || ""));
      if (!mappedSpecId) continue;
      const { error } = await supabaseAdmin.from("especialidade_subdivisoes").insert({
        id: crypto.randomUUID(),
        especialidade_id: mappedSpecId,
        nome: String(sub && sub.nome || "").trim(),
        empresa_id: target,
      });
      if (error) throw error;
    }
    return;
  }

  const fallback = buildDefaultSpecialtyTemplate();
  for (const spec of fallback) {
    const specId = crypto.randomUUID();
    const { error: specErr } = await supabaseAdmin.from("especialidades").insert({
      id: specId,
      seqid: Number(spec.seqid || 0),
      nome: String(spec.nome || "").trim(),
      empresa_id: target,
    });
    if (specErr) throw specErr;
    for (const subName of (spec.subs || [])) {
      const { error: subErr } = await supabaseAdmin.from("especialidade_subdivisoes").insert({
        id: crypto.randomUUID(),
        especialidade_id: specId,
        nome: String(subName || "").trim(),
        empresa_id: target,
      });
      if (subErr) throw subErr;
    }
  }
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
    const planoTipo = String(body.plano_tipo || body.tipo_assinatura || "").trim() || null;

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
          plano_tipo: planoTipo,
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
      await seedSpecialtiesForEmpresa(supabaseAdmin, empresaId);
    } catch (e) {
      try { await supabaseAdmin.from("empresas").delete().eq("id", empresaId); } catch {}
      try { await supabaseAdmin.from("usuario_empresas").delete().eq("usuario_id", callerUser.id).eq("empresa_id", empresaId); } catch {}
      throw e;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        empresa_id: empresaId,
        empresa_nome: nome,
        plano_tipo: planoTipo,
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
