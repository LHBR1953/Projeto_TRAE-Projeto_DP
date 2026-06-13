const fs = require('fs');
let appContent = fs.readFileSync('c:\\Projeto_TRAE\\projeto_dp\\app_v22.js', 'utf8');

const regex1 = /'Financeiro', 'Comissões', 'Agenda', 'Emitir NFS-e', 'Auditoria', 'Suporte'/g;
const regex2 = /'Financeiro', 'Comiss\u00f5es', 'Agenda', 'Emitir NFS-e', 'Auditoria', 'Suporte'/g;

if (regex1.test(appContent) || regex2.test(appContent)) {
  console.log('Replacing...');
  appContent = appContent.replace(regex1, "'Financeiro', 'Comissões', 'Agenda', 'Emitir NFS-e', 'Auditoria', 'Suporte', 'Central do Paciente'");
  appContent = appContent.replace(regex2, "'Financeiro', 'Comissões', 'Agenda', 'Emitir NFS-e', 'Auditoria', 'Suporte', 'Central do Paciente'");
  fs.writeFileSync('c:\\Projeto_TRAE\\projeto_dp\\app_v22.js', appContent, 'utf8');
  console.log('Fixed');
} else {
  console.log('Not found. Let us check what is actually there:');
  const match = appContent.match(/'Financeiro', 'Comiss(.*?)', 'Agenda', 'Emitir NFS-e', 'Auditoria', 'Suporte'(.*?)]/);
  if (match) {
    console.log(match[0]);
  } else {
    const match2 = appContent.match(/allSystemModules\s*=\s*\[([\s\S]*?)\]/);
    console.log(match2[0]);
  }
}
