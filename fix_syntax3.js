const fs = require('fs');

// Remove extra } from end of files
['app_pacientes.js', 'app_profissionais.js', 'app_servicos.js'].forEach(f => {
    const p = 'C:/Projeto_TRAE/Projeto_DP/' + f;
    let code = fs.readFileSync(p, 'utf8');
    code = code.replace(/\n\}\n$/, '');
    fs.writeFileSync(p, code, 'utf8');
});

// Fix app_estoque_inventario.js
let invCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', 'utf8');
invCode = invCode.replace('window.updateInventoryAreaOptionsForTipoInventario();\n }\n                if (window.__forceInventoryAreaOptions)', 'window.updateInventoryAreaOptionsForTipoInventario();\n                if (window.__forceInventoryAreaOptions)');
invCode = invCode.replace('window.updateInventoryAreaOptionsForTipoInventario();\r\n }\r\n                if (window.__forceInventoryAreaOptions)', 'window.updateInventoryAreaOptionsForTipoInventario();\n                if (window.__forceInventoryAreaOptions)');
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', invCode, 'utf8');

// Fix app_orcamentos.js
let orcCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');
orcCode = orcCode.replace(`if (typeof btn !== 'undefined' && btn) { btn.st }yle.background`, `if (typeof btn !== 'undefined' && btn) { btn.style.background`);
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', orcCode, 'utf8');

// Fix app_v22.js
let v22Code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
v22Code = v22Code.replace(`if (typeof el !== 'undefined' && el) { el.addEventListener('input', () => { if (typeof el !== 'undefined' && el) { el.value = p.mask(el.value); } });`, `if (typeof el !== 'undefined' && el) { el.addEventListener('input', () => { if (typeof el !== 'undefined' && el) { el.value = p.mask(el.value); } }); }`);
v22Code = v22Code.replace(`if (typeof el !== 'undefined' && el) { el.addEventListener('blur', () => { if (typeof el !== 'undefined' && el) { el.value = p.mask(el.value); } });`, `if (typeof el !== 'undefined' && el) { el.addEventListener('blur', () => { if (typeof el !== 'undefined' && el) { el.value = p.mask(el.value); } }); }`);
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', v22Code, 'utf8');

console.log('Done fixes 3');
