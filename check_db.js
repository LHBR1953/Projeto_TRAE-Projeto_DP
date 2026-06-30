const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
    const code = fs.readFileSync('c:\\Projeto_TRAE\\Projeto_DP\\app_v22.js', 'utf8');
    const urlMatch = code.match(/const\s+supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
    const keyMatch = code.match(/const\s+supabaseKey\s*=\s*['"]([^'"]+)['"]/);
    if (urlMatch && keyMatch) {
        const supabase = createClient(urlMatch[1], keyMatch[1]);
        const { data, error } = await supabase.from('orcamento_pagamentos').select('*').limit(1);
        if (error) console.error("Error:", error);
        else console.log("Columns:", data && data.length ? Object.keys(data[0]) : "No data");
    }
}
check();