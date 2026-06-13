const fs = require('fs');
const path = 'c:\\Projeto_TRAE\\Projeto_DP\\app_v22.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/const idLongo = String\(b && b\.id \|\| ''\)\.trim\(\);/g, "const idLongo = String(b && b.id || '').trim().toLowerCase();");
content = content.replace(/const idBanco = String\(p && p\.orcamento_id \|\| ''\)\.trim\(\);/g, "const idBanco = String(p && p.orcamento_id || '').trim().toLowerCase();");

const searchStr = "                    \\${r.budget && r.budget.id ? \\`<button class=\"btn-icon\" onclick=\"viewBudgetPayments('\\${escapeHtml(r.budget?.id)}', '\\${escapeHtml(String(r.budget?.seqid || ''))}', \\${Number(r.budget?.valor_total || r.budget?.valor || 0)})\" title=\"Orçamento\"><i class=\"ri-file-list-3-line\"></i></button>\\` : ''}";
const replaceStr = "                    \\${r.budget && r.budget.id ? \\`<button class=\"btn-icon\" onclick=\"viewBudgetPayments('\\${escapeHtml(r.budget?.id)}', '\\${escapeHtml(String(r.budget?.seqid || ''))}', \\${Number(r.budget?.valor_total || r.budget?.valor || 0)})\" title=\"Pagamentos e Liberação\"><i class=\"ri-money-dollar-circle-line\"></i></button>\n                    <button class=\"btn-icon\" onclick=\"viewBudgetFromPatient('\\${escapeHtml(r.budget?.id)}')\" title=\"Ver Orçamento Pai\"><i class=\"ri-file-list-3-line\"></i></button>\\` : ''}";
content = content.replace(searchStr, replaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log("Done");