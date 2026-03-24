import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
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
    const empresaId = String(body.empresa_id || "").trim();
    const onlyExclusive = Boolean(body.only_exclusive); // default false
    const filterEmail = String(body.email || "").trim(); // optional single email

    if (!empresaId) throw new Error("Missing required field: empresa_id");

    const isSuperAdminCaller = normalizeEmail(callerUser.email) === SUPER_ADMIN_EMAIL;
    if (!isSuperAdminCaller) {
      const { data: callerTenantStatus, error: tenantCheckError } = await supabaseAdmin
        .from("usuario_empresas")
        .select("perfil")
        .eq("usuario_id", callerUser.id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (tenantCheckError) throw new Error(`Database error checking tenant status: ${tenantCheckError.message}`);
      if (!callerTenantStatus || String(callerTenantStatus.perfil).toLowerCase() !== "admin") {
        throw new Error("Forbidden. Admin of this empresa (or SuperAdmin) required.");
      }
    }

    // Candidates = mappings for this empresa
    const { data: empMaps, error: empMapsErr } = await supabaseAdmin
      .from("usuario_empresas")
      .select("usuario_id, user_email")
      .eq("empresa_id", empresaId);
    if (empMapsErr) throw new Error(`Failed to read usuario_empresas for empresa: ${empMapsErr.message}`);

    const candidatesAll = (empMaps || []).map((r: any) => ({
      usuario_id: String(r.usuario_id || "").trim(),
      email: normalizeEmail(r.user_email || ""),
    })).filter(r => r.usuario_id);

    const candidates = candidatesAll.filter(r => {
      if (filterEmail && normalizeEmail(filterEmail) !== r.email) return false;
      if (r.email && r.email === SUPER_ADMIN_EMAIL) return false;
      return true;
    });

    // If onlyExclusive=true, keep only users with mapping only in this empresa
    let toDelete = candidates;
    if (onlyExclusive && candidates.length) {
      const userIds = candidates.map(c => c.usuario_id);
      const { data: allMaps, error: allMapsErr } = await supabaseAdmin
        .from("usuario_empresas")
        .select("usuario_id, empresa_id")
        .in("usuario_id", userIds);
      if (allMapsErr) throw new Error(`Failed to read usuario_empresas for exclusivity check: ${allMapsErr.message}`);
      const countByUser = new Map<string, Set<string>>();
      (allMaps || []).forEach((r: any) => {
        const uid = String(r.usuario_id || "");
        const emp = String(r.empresa_id || "");
        if (!uid || !emp) return;
        if (!countByUser.has(uid)) countByUser.set(uid, new Set());
        countByUser.get(uid)!.add(emp);
      });
      toDelete = candidates.filter(c => {
        const set = countByUser.get(c.usuario_id);
        return set && set.size === 1 && set.has(empresaId);
      });
    }

    // Delete auth users first (cascade should remove mappings; then delete remaining mappings for empresa_id)
    let deletedAuth = 0;
    const failed: { usuario_id: string; error: string }[] = [];
    for (const row of toDelete) {
      const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(row.usuario_id);
      if (delUserErr) {
        failed.push({ usuario_id: row.usuario_id, error: delUserErr.message });
      } else {
        deletedAuth += 1;
      }
    }

    const { error: delMapErr } = await supabaseAdmin
      .from("usuario_empresas")
      .delete()
      .eq("empresa_id", empresaId);
    if (delMapErr) throw new Error(`Failed to delete usuario_empresas for empresa: ${delMapErr.message}`);

    return new Response(JSON.stringify({ ok: true, candidates: candidates.length, deleted_auth: deletedAuth, failed }), {
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
