import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, apikey',
};

function normalizeRole(input: unknown): string {
    const raw = String(input ?? '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'admim' || raw === 'administrador' || raw === 'administrator') return 'admin';
    if (raw === 'protético' || raw === 'protetico' || raw === 'lab' || raw === 'laboratorio') return 'protetico';
    if (raw === 'recepção' || raw === 'recepcao' || raw === 'recepcionista') return 'recepcao';
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
    // 1. Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Initialize Supabase Admin Client using Service Role Key
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
        }

        // MASTER CONFIG: Change this email to transfer SuperAdmin ownership
        const SUPER_ADMIN_EMAIL = 'lhbr@lhbr.com.br';

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 3. Parse incoming request body
        const body = await req.json();
        const email = body.email;
        const password = body.password;
        const role = normalizeRole(body.role);
        const empresa_id = body.empresa_id;
        const permissoes = role === 'admin' ? buildFullPermissions() : (body.permissoes || {});

        if (!email || !password || !role || !empresa_id) {
            throw new Error("Missing required fields: email, password, role, form empresa_id");
        }

        const allowedRoles = new Set(['admin', 'supervisor', 'dentista', 'protetico', 'recepcao']);
        if (!allowedRoles.has(role)) {
            throw new Error(`Invalid role: '${role}'. Allowed: ${Array.from(allowedRoles).join(', ')}`);
        }

        // 4. Verify Authorization (Caller Identity)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Missing Authorization header.");
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: callerUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

        if (verifyError || !callerUser) {
            throw new Error("Unauthorized caller. Invalid token.");
        }

        // 5. Verify the caller is an 'admin' for this specific 'empresa_id' OR is the SuperAdmin
        let isSuperAdminCaller = (callerUser.email === SUPER_ADMIN_EMAIL);

        if (!isSuperAdminCaller) {
            const { data: callerTenantStatus, error: tenantCheckError } = await supabaseAdmin
                .from('usuario_empresas')
                .select('perfil')
                .eq('usuario_id', callerUser.id)
                .eq('empresa_id', empresa_id)
                .maybeSingle(); // Use maybeSingle to avoid crash on 0 rows

            if (tenantCheckError) {
                throw new Error(`Database error checking tenant status: ${tenantCheckError.message}`);
            }

            if (!callerTenantStatus) {
                throw new Error(`Forbidden. No record found in usuario_empresas for User ID: ${callerUser.id} and Empresa ID: ${empresa_id}.`);
            }

            if (normalizeRole(callerTenantStatus.perfil) !== 'admin') {
                throw new Error(`Forbidden. Your profile is '${callerTenantStatus.perfil}', but 'admin' is required to create users in this tenant.`);
            }
        }

        // 6. Proceed to create the Auth User using Admin API
        const { data: newUserObj, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (createError) {
            throw createError;
        }

        const newUserId = newUserObj.user.id;

        // 7. Link the new user to the tenant via 'usuario_empresas'
        const { error: linkError } = await supabaseAdmin
            .from('usuario_empresas')
            .insert([
                {
                    usuario_id: newUserId,
                    empresa_id: empresa_id,
                    perfil: role,
                    user_email: email,
                    permissoes: permissoes // Saved so the frontend can display it easily without querying auth.users
                }
            ]);

        // 8. Rollback if linking fails
        if (linkError) {
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw new Error(`Failed to link user to tenant. Auth creation rolled back. Details: ${linkError.message}`);
        }

        // 9. Success Response INCLUDES corsHeaders
        return new Response(
            JSON.stringify({ message: 'User created successfully', userId: newUserId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error("Error creating tenant user:", error.message || error);

        // Ensure error responses ALSO include corsHeaders to prevent "Failed to fetch" masking the real error
        return new Response(
            JSON.stringify({ error: error.message || 'Unknown error occurred' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
