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
    } catch (e) {
      if (createdNewAuthUser && authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch {}
      }
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
