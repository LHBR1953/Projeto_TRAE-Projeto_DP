import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function normalizeRole(input: unknown): string {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "admim" || raw === "administrador" || raw === "administrator") return "admin";
  if (raw === "protético" || raw === "protetico" || raw === "lab" || raw === "laboratorio") return "protetico";
  if (raw === "recepção" || raw === "recepcao" || raw === "recepcionista") return "recepcao";
  if (raw === "auxiliar") return "auxiliar";
  return raw;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const SUPER_ADMIN_EMAIL = "lhbr@lhbr.com.br";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header.");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    if (verifyError || !callerUser) throw new Error("Unauthorized caller. Invalid token.");

    const body = await req.json();
    const usuarioId = String(body.usuario_id || "").trim();
    const empresaId = String(body.empresa_id || "").trim();
    const role = normalizeRole(body.role);
    const permissoes = role === "admin"
      ? buildFullPermissions()
      : ((body.permissoes && typeof body.permissoes === "object") ? body.permissoes : {});

    if (!usuarioId || !empresaId || !role) throw new Error("Missing required fields: usuario_id, empresa_id, role");

    const allowedRoles = new Set(["admin", "supervisor", "dentista", "protetico", "recepcao", "auxiliar"]);
    if (!allowedRoles.has(role)) throw new Error(`Invalid role: '${role}'. Allowed: ${Array.from(allowedRoles).join(", ")}`);

    const isSuperAdminCaller = String(callerUser.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
    if (!isSuperAdminCaller) {
      const { data: callerTenantStatus, error: tenantCheckError } = await supabaseAdmin
        .from("usuario_empresas")
        .select("perfil")
        .eq("usuario_id", callerUser.id)
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (tenantCheckError) throw new Error(`Database error checking tenant status: ${tenantCheckError.message}`);
      if (!callerTenantStatus) throw new Error("Forbidden. No usuario_empresas mapping for caller in this tenant.");
      if (normalizeRole(callerTenantStatus.perfil) !== "admin") throw new Error("Forbidden. Admin required.");
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("usuario_empresas")
      .update({ perfil: role, permissoes })
      .eq("usuario_id", usuarioId)
      .eq("empresa_id", empresaId)
      .select("usuario_id, empresa_id, perfil")
      .maybeSingle();

    if (updErr) throw new Error(`Failed to update usuario_empresas: ${updErr.message}`);
    if (!updated) throw new Error("No rows updated (mapping not found).");

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = (error && (error as any).message) ? (error as any).message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

