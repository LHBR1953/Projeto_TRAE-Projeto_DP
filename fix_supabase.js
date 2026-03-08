const fs = require('fs');
const file = 'c:\\Projeto_Antigravity\\Projeto_DP\\app.js';
let appJs = fs.readFileSync(file, 'utf8');

appJs = appJs.replace('const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);', 'const db = window.supabase.createClient(supabaseUrl, supabaseKey);');

// Replace all usages of the instance `supabase.from`
appJs = appJs.replace(/\bsupabase\.from\b/g, 'db.from');
appJs = appJs.replace(/\bsupabase\.auth\b/g, 'db.auth');
appJs = appJs.replace(/\bsupabase\.storage\b/g, 'db.storage');
appJs = appJs.replace(/\bsupabase\.rpc\b/g, 'db.rpc');

fs.writeFileSync(file, appJs, 'utf8');
console.log('Successfully renamed supabase variable to db');
