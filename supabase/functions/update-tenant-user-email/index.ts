import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const { data: { user: callerUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    if (verifyError || !callerUser) throw new Error("Unauthorized caller. Invalid token.");
    if (callerUser.email !== SUPER_ADMIN_EMAIL) throw new Error("Forbidden. SuperAdmin required.");

    const body = await req.json();
    const userId = String(body.user_id || "").trim();
    const newEmail = String(body.new_email || "").trim().toLowerCase();

    if (!userId || !newEmail) throw new Error("Missing required fields: user_id, new_email");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) throw updErr;

    const { error: mapErr } = await supabaseAdmin
      .from("usuario_empresas")
      .update({ user_email: newEmail })
      .eq("usuario_id", userId);
    if (mapErr) throw new Error(`Failed to sync usuario_empresas.user_email: ${mapErr.message}`);

    return new Response(
      JSON.stringify({ message: "Email updated successfully", userId, newEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error updating tenant user email:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});

