-- Script to create RLS policies for Superadmin on template tables
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE '%_template'
    LOOP
        -- Enable RLS just in case
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Create or replace policy for ALL operations
        EXECUTE format('DROP POLICY IF EXISTS superadmin_all_policy ON public.%I;', tbl);
        
        -- Create a policy that allows operations if the JWT email is lhbr@lhbr.com.br or the header is present
        EXECUTE format('
            CREATE POLICY superadmin_all_policy ON public.%I
            FOR ALL
            USING (
                auth.jwt() ->> ''email'' = ''lhbr@lhbr.com.br'' 
                OR current_setting(''request.headers'', true)::json->>''x-superadmin-email'' = ''lhbr@lhbr.com.br''
            )
            WITH CHECK (
                auth.jwt() ->> ''email'' = ''lhbr@lhbr.com.br'' 
                OR current_setting(''request.headers'', true)::json->>''x-superadmin-email'' = ''lhbr@lhbr.com.br''
            );
        ', tbl);
    END LOOP;
END;
$$;
