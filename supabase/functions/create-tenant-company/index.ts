import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
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

function isEmailAlreadyRegisteredError(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err ? String((err as any).message || "") : String(err || "");
  return /already been registered/i.test(msg) || /already registered/i.test(msg) || /already exists/i.test(msg);
}

async function findAuthUserIdByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const target = normalizeEmail(email);
  if (!target) return null;
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data && Array.isArray(data.users) ? data.users : [];
    const hit = users.find((u) => normalizeEmail(u.email) === target);
    if (hit && hit.id) return String(hit.id);
    if (users.length < perPage) return null;
    page += 1;
    if (page > 200) return null;
  }
}

function deriveInitialAdminPassword(supervisorPin: string): string {
  const pin = String(supervisorPin || "").trim();
  const base = pin ? `${pin}occ` : `occ${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  if (base.length >= 8) return base;
  return (base + "00000000").slice(0, 8);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }

    const SUPER_ADMIN_EMAIL = "lhbr@lhbr.com.br";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header.");
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user: callerUser },
      error: verifyError,
    } = await supabaseAdmin.auth.getUser(token);
    if (verifyError || !callerUser) throw new Error("Unauthorized caller. Invalid token.");
    if (normalizeEmail(callerUser.email) !== normalizeEmail(SUPER_ADMIN_EMAIL)) {
      throw new Error("Forbidden. Only SuperAdmin can create a new company with onboarding.");
    }

    const body = await req.json();

    const empresaId = String(body.empresa_id || body.id || "").trim();
    const nome = String(body.nome || "").trim();
    const email = normalizeEmail(body.email || body.empresa_email || "");
    const supervisorPin = String(body.supervisor_pin || body.supervisorPin || "").trim();
    const telefone = String(body.telefone || "").trim() || null;
    const celular = String(body.celular || "").trim() || null;
    const logotipo = String(body.logotipo || "").trim() || null;
    const identificador = String(body.identificador || empresaId || "").trim();
    const assinaturaStatus = String(body.assinatura_status || body.assinaturaStatus || "ATIVA").trim();

    if (!empresaId || !nome || !email) {
      throw new Error("Missing required fields: empresa_id, nome, email.");
    }

    const initialPassword = "123456";

    const { data: existingEmpresa, error: empChkErr } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .maybeSingle();
    if (empChkErr) throw empChkErr;
    if (existingEmpresa) throw new Error(`Empresa '${empresaId}' já existe.`);

    const { error: empInsErr } = await supabaseAdmin.from("empresas").insert({
      id: empresaId,
      identificador,
      nome,
      email,
      assinatura_status: assinaturaStatus,
      supervisor_pin: supervisorPin || null,
      telefone,
      celular,
      logotipo,
    });
    if (empInsErr) throw empInsErr;

    let authUserId: string | null = null;
    let createdNewAuthUser = false;
    try {
      const { data: newUserObj, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
      });
      if (createErr) {
        if (!isEmailAlreadyRegisteredError(createErr)) throw createErr;
        authUserId = await findAuthUserIdByEmail(supabaseAdmin, email);
        if (!authUserId) throw new Error(`Usuário já existe no Auth, mas não foi possível localizar pelo email (${email}).`);
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: initialPassword,
          email_confirm: true,
        });
        if (updErr) throw updErr;
      } else {
        authUserId = newUserObj.user.id;
        createdNewAuthUser = true;
      }

      const permissoes = buildFullPermissions();
      const { error: linkError } = await supabaseAdmin.from("usuario_empresas").upsert(
        {
          usuario_id: authUserId,
          empresa_id: empresaId,
          perfil: "admin",
          user_email: email,
          permissoes,
          require_password_change: true,
        },
        { onConflict: "usuario_id,empresa_id" },
      );
      if (linkError) throw linkError;
      await seedSpecialtiesForEmpresa(supabaseAdmin, empresaId);
    } catch (e) {
      if (createdNewAuthUser && authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch {}
      }
      try {
        if (authUserId) {
          await supabaseAdmin.from("usuario_empresas").delete().eq("usuario_id", authUserId).eq("empresa_id", empresaId);
        }
      } catch {}
      try {
        await supabaseAdmin.from("empresas").delete().eq("id", empresaId);
      } catch {}
      throw e;
    }

    return new Response(
      JSON.stringify({
        message: `Clínica ${nome} cadastrada! O acesso do Administrador (${email}) já está ativo.`,
        empresa_id: empresaId,
        admin_email: email,
        admin_password: initialPassword,
        created_new_auth_user: createdNewAuthUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any).message || "Unknown error occurred" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
