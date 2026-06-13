const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const config = fs.readFileSync('app_v22.js', 'utf8');
const matchUrl = config.match(/const supabaseUrl = '(.*?)'/);
const matchKey = config.match(/const supabaseKey = '(.*?)'/);

if (!matchUrl || !matchKey) {
  console.log('Credentials not found');
  process.exit(1);
}

const supabase = createClient(matchUrl[1], matchKey[1]);

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS paciente_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id TEXT REFERENCES pacientes(id) ON DELETE CASCADE,
        empresa_id TEXT REFERENCES empresas(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE paciente_tokens ENABLE ROW LEVEL SECURITY;
    
    -- Create policies (assuming anonymous users can insert/select their own tokens if they have the token)
    -- Actually, for simplicity, since it's managed via Edge Functions or public if we want.
    -- Let's make it fully open for now and we can tighten it if needed, or use service role.
    -- Wait, if it's accessed from frontend, we need policies.
    CREATE POLICY "Enable read access for all users" ON paciente_tokens FOR SELECT USING (true);
    CREATE POLICY "Enable insert access for all users" ON paciente_tokens FOR INSERT WITH CHECK (true);
    CREATE POLICY "Enable update access for all users" ON paciente_tokens FOR UPDATE USING (true);
    CREATE POLICY "Enable delete access for all users" ON paciente_tokens FOR DELETE USING (true);
  `;
  
  // We don't have direct SQL execution from supabase-js unless we use an RPC.
  // Do we have an RPC to execute arbitrary SQL?
  // Let's check.
}
createTable();
