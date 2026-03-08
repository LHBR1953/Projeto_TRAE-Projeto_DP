const fs = require('fs');
let appJs = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\app.js', 'utf8');

// Replace property accesses and assignments
appJs = appJs.replace(/\.seqId\b/g, '.seqid');
appJs = appJs.replace(/\bseqId:/g, 'seqid:');

// Inside getNextSeqId function: if (i.seqId && i.seqId > maxId) maxId = i.seqId; 
// is covered by \.seqId\b

appJs = appJs.replace(/\.dataNascimento\b/g, '.datanascimento');
appJs = appJs.replace(/\bdataNascimento:/g, 'datanascimento:');
appJs = appJs.replace(/const dataNascimento/g, 'const datanascimento');

appJs = appJs.replace(/\.especialidadeId\b/g, '.especialidadeid');
appJs = appJs.replace(/\bespecialidadeId:/g, 'especialidadeid:');

appJs = appJs.replace(/\.pacienteId\b/g, '.pacienteid');
appJs = appJs.replace(/\bpacienteId:/g, 'pacienteid:');

appJs = appJs.replace(/\.pacienteNome\b/g, '.pacientenome');
appJs = appJs.replace(/\bpacienteNome:/g, 'pacientenome:');

appJs = appJs.replace(/\.pacienteCelular\b/g, '.pacientecelular');
appJs = appJs.replace(/\bpacienteCelular:/g, 'pacientecelular:');

appJs = appJs.replace(/\.pacienteEmail\b/g, '.pacienteemail');
appJs = appJs.replace(/\bpacienteEmail:/g, 'pacienteemail:');

// Also update the supabase schema file to match the JS just for documentation completeness (optional, but let's leave it as is, or lowercase it to prevent future confusion)
let sql = fs.readFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\supabase_schema.sql', 'utf8');
sql = sql.replace(/seqId/g, 'seqid');
sql = sql.replace(/dataNascimento/g, 'datanascimento');
sql = sql.replace(/especialidadeId/g, 'especialidadeid');
sql = sql.replace(/pacienteId/g, 'pacienteid');
sql = sql.replace(/pacienteNome/g, 'pacientenome');
sql = sql.replace(/pacienteCelular/g, 'pacientecelular');
sql = sql.replace(/pacienteEmail/g, 'pacienteemail');
fs.writeFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\supabase_schema.sql', sql, 'utf8');

fs.writeFileSync('c:\\Projeto_Antigravity\\Projeto_DP\\app.js', appJs, 'utf8');
console.log('Successfully aligned JS with Postgres schema.');
