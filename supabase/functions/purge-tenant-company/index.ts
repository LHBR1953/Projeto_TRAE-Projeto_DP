import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function normalizeEmail(input: unknown): string {
  return String(input ?? "").trim().toLowerCase();
}

function isMissingTableError(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as any).code || "") : "";
  const msg = err && typeof err === "object" && "message" in err ? String((err as any).message || "") : String(err || "");
  return code === "42P01" || /relation .* does not exist/i.test(msg) || /does not exist/i.test(msg);
}

async function safeDeleteByEmpresaId(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  empresaId: string,
): Promise<{ table: string; ok: boolean; deleted: number; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.from(table).delete().eq("empresa_id", empresaId).select("empresa_id");
    if (error) {
      if (isMissingTableError(error)) return { table, ok: true, deleted: 0 };
      return { table, ok: false, deleted: 0, error: error.message };
    }
    const deleted = Array.isArray(data) ? data.length : 0;
    return { table, ok: true, deleted };
  } catch (e) {
    if (isMissingTableError(e)) return { table, ok: true, deleted: 0 };
    return { table, ok: false, deleted: 0, error: String((e as any)?.message || e) };
  }
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
    if (normalizeEmail(callerUser.email) !== normalizeEmail(SUPER_ADMIN_EMAIL)) {
      throw new Error("Forbidden. Only SuperAdmin can purge a company.");
    }

    const body = await req.json();
    const empresaId = String(body.empresa_id || "").trim();
    const dryRun = Boolean(body.dry_run);

    if (!empresaId) throw new Error("Missing required field: empresa_id");

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, empresa_id: empresaId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: empresaRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!empresaRow) throw new Error(`Empresa '${empresaId}' não encontrada.`);

    const deleteReports: any[] = [];

    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "occ_audit_log", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "auditoria_log", empresaId));

    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "ordens_proteticas_anexos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "ordens_proteticas_eventos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "ordens_proteticas_custodia_eventos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "ordens_proteticas_custodia_tokens", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "protese_contas_pagar", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "ordens_proteticas", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "laboratorios_proteticos", empresaId));

    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "orcamento_pagamentos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "orcamento_itens", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "orcamentos", empresaId));

    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "paciente_documentos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "paciente_evolucao", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "pacientes", empresaId));

    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "profissional_usuarios", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "financeiro_comissoes", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "financeiro_transacoes", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "agenda_agendamentos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "agenda_disponibilidade", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "orcamento_cancelados", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "servicos", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "especialidade_subdivisoes", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "especialidades", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "marketing_envios", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "marketing_campanhas", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "marketing_smtp_config", empresaId));
    deleteReports.push(await safeDeleteByEmpresaId(supabaseAdmin, "profissionais", empresaId));

    const { data: maps, error: mapsErr } = await supabaseAdmin
      .from("usuario_empresas")
      .select("usuario_id, user_email")
      .eq("empresa_id", empresaId);
    if (mapsErr) throw mapsErr;

    const candidates = (maps || [])
      .map((r: any) => ({ usuario_id: String(r.usuario_id || "").trim(), email: normalizeEmail(r.user_email || "") }))
      .filter((r) => r.usuario_id && r.email !== normalizeEmail(SUPER_ADMIN_EMAIL));

    let deletedAuth = 0;
    const failedAuth: { usuario_id: string; error: string }[] = [];

    if (candidates.length) {
      const userIds = candidates.map((c) => c.usuario_id);
      const { data: allMaps, error: allMapsErr } = await supabaseAdmin
        .from("usuario_empresas")
        .select("usuario_id, empresa_id")
        .in("usuario_id", userIds);
      if (allMapsErr) throw allMapsErr;

      const countByUser = new Map<string, Set<string>>();
      (allMaps || []).forEach((r: any) => {
        const uid = String(r.usuario_id || "");
        const emp = String(r.empresa_id || "");
        if (!uid || !emp) return;
        if (!countByUser.has(uid)) countByUser.set(uid, new Set());
        countByUser.get(uid)!.add(emp);
      });

      const exclusiveUsers = candidates.filter((c) => {
        const set = countByUser.get(c.usuario_id);
        return set && set.size === 1 && set.has(empresaId);
      });

      for (const row of exclusiveUsers) {
        const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(row.usuario_id);
        if (delUserErr) failedAuth.push({ usuario_id: row.usuario_id, error: delUserErr.message });
        else deletedAuth += 1;
      }
    }

    const { error: delMapsErr } = await supabaseAdmin.from("usuario_empresas").delete().eq("empresa_id", empresaId);
    if (delMapsErr) throw delMapsErr;

    const { error: delEmpErr } = await supabaseAdmin.from("empresas").delete().eq("id", empresaId);
    if (delEmpErr) throw delEmpErr;

    return new Response(
      JSON.stringify({
        ok: true,
        empresa_id: empresaId,
        deleted_auth: deletedAuth,
        failed_auth: failedAuth,
        deletes: deleteReports,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = (error && (error as any).message) ? (error as any).message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

