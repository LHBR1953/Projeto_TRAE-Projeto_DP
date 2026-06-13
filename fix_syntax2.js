const fs = require('fs');

const missingBraceFiles = [
    'app_atendimento.js',
    'app_atendimento_profissional.js',
    'app_config_audit.js',
    'app_dashboard.js',
    'app_pacientes.js',
    'app_profissionais.js',
    'app_servicos.js'
];

for (const file of missingBraceFiles) {
    const path = 'C:/Projeto_TRAE/Projeto_DP/' + file;
    let code = fs.readFileSync(path, 'utf8');
    code += '\n}\n';
    fs.writeFileSync(path, code, 'utf8');
    console.log('Appended } to ' + file);
}

// Fix app_estoque_inventario.js
let invCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', 'utf8');
invCode = invCode.replace('window.updateInventoryAreaOptionsForTipoInventario();\n }\n                if (window.__forceInventoryAreaOptions)', 'window.updateInventoryAreaOptionsForTipoInventario();\n                if (window.__forceInventoryAreaOptions)');
invCode = invCode.replace('window.updateInventoryAreaOptionsForTipoInventario();\r\n }\r\n                if (window.__forceInventoryAreaOptions)', 'window.updateInventoryAreaOptionsForTipoInventario();\n                if (window.__forceInventoryAreaOptions)');
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', invCode, 'utf8');

// Fix app_orcamentos.js
let orcCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');
orcCode = orcCode.replace('btn.getAtt }ribute', 'btn.getAttribute');
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', orcCode, 'utf8');

// Fix app_v22.js
let v22Code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
v22Code = v22Code.replace(/if \(typeof el !== 'undefined' && \} el\)/g, "if (typeof el !== 'undefined' && el)");
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', v22Code, 'utf8');

console.log('Done fixes');
