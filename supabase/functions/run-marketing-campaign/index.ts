import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

function applyTemplate(raw: string, vars: Record<string, string>) {
  let out = raw || "";
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replaceAll(`{{${k}}}`, v);
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const empresaId = String(body.empresa_id || "").trim();
    const campaignId = String(body.campaign_id || "").trim();
    const statusKey = String(body.status_key || "").trim().toUpperCase();
    const dryRun = Boolean(body.dry_run);

    if (!empresaId) throw new Error("Missing required field: empresa_id");
    if (!campaignId && !statusKey) throw new Error("Missing required field: campaign_id or status_key");

    const superAdmin = callerUser.email === "lhbr@lhbr.com.br";
    if (!superAdmin) {
      const { data: ue, error: ueErr } = await supabaseAdmin
        .from("usuario_empresas")
        .select("id, perfil")
        .eq("empresa_id", empresaId)
        .eq("usuario_id", callerUser.id)
        .limit(1);
      if (ueErr) throw ueErr;
      if (!ue || !ue.length || ue[0].perfil !== "admin") throw new Error("Forbidden. Admin required.");
    }

    const statusToRange = (s: string) => {
      if (s === "ATIVOS") return { min: 0, max: 6 as number | null };
      if (s === "ATENCAO") return { min: 7, max: 8 as number | null };
      if (s === "REATIVACAO") return { min: 9, max: 11 as number | null };
      if (s === "ALTO_RISCO") return { min: 12, max: 17 as number | null };
      if (s === "PERDIDOS") return { min: 18, max: null as number | null };
      return { min: 0, max: 6 as number | null };
    };

    let campaign: any = null;
    if (campaignId) {
      const { data, error } = await supabaseAdmin
        .from("marketing_campanhas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      campaign = data;
    } else {
      const r = statusToRange(statusKey);
      let data: any = null;
      try {
        const resp = await supabaseAdmin
          .from("marketing_campanhas")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .eq("target_status", statusKey)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (resp.error) throw resp.error;
        data = resp.data;
      } catch {
        let q2 = supabaseAdmin
          .from("marketing_campanhas")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .eq("target_min_meses", r.min);
        q2 = r.max === null ? q2.is("target_max_meses", null) : q2.eq("target_max_meses", r.max);
        const resp2 = await q2
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (resp2.error) throw resp2.error;
        data = resp2.data;
      }
      if (!data) throw new Error(`No active campaign found for status_key=${statusKey}`);
      campaign = data;
    }

    const { data: smtp, error: sErr } = await supabaseAdmin
      .from("marketing_smtp_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .single();
    if (sErr) throw sErr;
    if (!smtp || !smtp.enabled) throw new Error("SMTP not configured/enabled for this empresa.");

    const { data: empresa, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, nome, telefone, celular")
      .eq("id", empresaId)
      .single();
    if (empErr) throw empErr;
    const empresaNome = String((empresa as any)?.nome || empresaId);
    const empresaTelefone = String((empresa as any)?.telefone || "").trim();
    const empresaCelular = String((empresa as any)?.celular || "").trim();

    const minMeses = Number(campaign.target_min_meses ?? 0);
    const maxMeses = campaign.target_max_meses == null ? null : Number(campaign.target_max_meses);
    const limiteDia = Math.max(1, Number(campaign.limite_dia ?? 50));
    const diasReenvio = Math.max(0, Number(campaign.dias_reenvio ?? 0));
    const janelaConv = Math.max(1, Number(campaign.janela_conversao_dias ?? 30));

    const MAX_PER_RUN = 500;
    const MAX_FETCH = 5000;

    const fetchAudience = async (offset: number, limit: number) => {
      const { data, error } = await supabaseAdmin.rpc("rpc_marketing_fidelidade", {
        p_empresa_id: empresaId,
        p_min_meses: minMeses,
        p_max_meses: maxMeses,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map((r: any) => ({
        paciente_id: r.paciente_id,
        nome: String(r.nome || ""),
        email: String(r.email || "").trim(),
        meses_sem_pagamento: Number(r.meses_sem_pagamento ?? 0),
      }));
    };

    const collectEligible = async () => {
      const all: any[] = [];
      let offset = 0;
      while (offset < MAX_FETCH) {
        const batch = await fetchAudience(offset, 500);
        if (!batch.length) break;
        all.push(...batch);
        offset += batch.length;
        if (batch.length < 500) break;
      }
      const hasEmail = all.filter((r) => r.paciente_id != null && r.email && r.email.includes("@"));
      let eligible = hasEmail;
      if (diasReenvio > 0 && eligible.length) {
        const since = new Date(Date.now() - diasReenvio * 24 * 60 * 60 * 1000).toISOString();
        const ids = Array.from(new Set(eligible.map((c) => String(c.paciente_id))));
        const { data: sentRows, error: sentErr } = await supabaseAdmin
          .from("marketing_envios")
          .select("paciente_id")
          .eq("empresa_id", empresaId)
          .eq("campanha_id", campaign.id)
          .gte("enviado_em", since)
          .in("paciente_id", ids);
        if (sentErr) throw sentErr;
        const sentSet = new Set((sentRows || []).map((x: any) => String(x.paciente_id)));
        eligible = eligible.filter((c) => !sentSet.has(String(c.paciente_id)));
      }
      return { allCount: all.length, hasEmailCount: hasEmail.length, eligible };
    };

    const { allCount, hasEmailCount, eligible } = await collectEligible();
    const planned = Math.min(MAX_PER_RUN, limiteDia, eligible.length);
    if (dryRun) {
      return new Response(
        JSON.stringify({
          empresa_id: empresaId,
          status_key: statusKey || String(campaign.target_status || ""),
          campaign_id: String(campaign.id || ""),
          campaign_nome: String(campaign.nome || ""),
          dry_run: true,
          target: { min_meses: minMeses, max_meses: maxMeses, limite_dia: limiteDia, dias_reenvio: diasReenvio, janela_conversao_dias: janelaConv },
          candidates: allCount,
          has_email: hasEmailCount,
          eligible: eligible.length,
          selected_count: planned,
          preview: eligible.slice(0, 20),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const transport = nodemailer.createTransport({
      host: String(smtp.host),
      port: Number(smtp.port),
      secure: Number(smtp.port) === 465,
      auth: smtp.username && smtp.password ? { user: String(smtp.username), pass: String(smtp.password) } : undefined,
    });

    const fromEmail = String(smtp.from_email || "").trim();
    if (!fromEmail) throw new Error("EmailClinica (from_email) is required.");
    const fromName = String(smtp.from_name || "").trim() || empresaNome;
    const from = `${fromName} <${fromEmail}>`;

    let sent = 0;
    let failed = 0;
    const failures: any[] = [];

    const selected = eligible.slice(0, planned);
    for (const r of selected) {
      const vars = {
        NOME_PACIENTE: r.nome || "Paciente",
        EMAIL_PACIENTE: r.email,
        NOME_EMPRESA: empresaNome,
        TELEFONE_EMPRESA: empresaTelefone,
        CELULAR_EMPRESA: empresaCelular,
      };
      const subject = applyTemplate(String(campaign.assunto || ""), vars);
      const core = applyTemplate(String(campaign.corpo || ""), vars);
      const footer = campaign.rodape
        ? applyTemplate(String(campaign.rodape || ""), vars)
        : `Atenciosamente,\n${empresaNome}\n${empresaTelefone || empresaCelular ? `Atendimento: ${[empresaTelefone, empresaCelular].filter(Boolean).join(" / ")}\n` : ""}À Gerência.`;
      const bodyText = `Prezado Sr(a) ${vars.NOME_PACIENTE}\n\n${core}\n\n${footer}`;

      try {
        await transport.sendMail({
          from,
          replyTo: fromEmail,
          to: r.email,
          subject,
          text: bodyText,
        });
        sent += 1;
        await supabaseAdmin.from("marketing_envios").insert({
          empresa_id: empresaId,
          campanha_id: campaign.id,
          paciente_id: r.paciente_id,
          paciente_nome: r.nome,
          paciente_email: r.email,
          status: "SENT",
          erro: null,
          enviado_em: new Date().toISOString(),
        });
      } catch (e: any) {
        failed += 1;
        const msg = String(e?.message || e);
        failures.push({ paciente_id: r.paciente_id, email: r.email, error: msg });
        await supabaseAdmin.from("marketing_envios").insert({
          empresa_id: empresaId,
          campanha_id: campaign.id,
          paciente_id: r.paciente_id,
          paciente_nome: r.nome,
          paciente_email: r.email,
          status: "FAILED",
          erro: msg.slice(0, 500),
          enviado_em: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        empresa_id: empresaId,
        status_key: statusKey || String(campaign.target_status || ""),
        campaign_id: String(campaign.id || ""),
        campaign_nome: String(campaign.nome || ""),
        dry_run: false,
        attempted: selected.length,
        sent,
        failed,
        remaining_estimate: Math.max(0, eligible.length - selected.length),
        failures: failures.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("run-marketing-campaign error:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
