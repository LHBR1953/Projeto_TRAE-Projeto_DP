const fs = require('fs');
let out = '';

const app_v22 = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf-8');
const lines_app = app_v22.split('\n');
out += '--- app_v22.js ---\n';
lines_app.forEach((l, i) => {
    if (l.includes('finalizeBudgetItem') || l.includes('processStockOut')) {
        out += `${i+1}: ${l.trim()}\n`;
    }
});

const app_html = fs.readFileSync('c:/Projeto_TRAE/Projeto_DP/app.html', 'utf-8');
const lines_html = app_html.split('\n');
out += '--- app.html ---\n';
lines_html.forEach((l, i) => {
    if (l.includes('app_v22.js')) {
        out += `${i+1}: ${l.trim()}\n`;
    }
});

fs.writeFileSync('c:/Projeto_TRAE/Projeto_DP/out2.log', out);
