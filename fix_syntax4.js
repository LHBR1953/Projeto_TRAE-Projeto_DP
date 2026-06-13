const fs = require('fs');

// Fix app_estoque_inventario.js (remove line 817 if it's just ' }')
let invLines = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', 'utf8').split('\n');
invLines = invLines.filter((l, i) => i !== 816); // 0-indexed
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_estoque_inventario.js', invLines.join('\n'), 'utf8');

// Fix app_orcamentos.js
let orcCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');
orcCode = orcCode.replace('val }idateBudgetMasterForm();', 'validateBudgetMasterForm();');
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', orcCode, 'utf8');

// Fix app_pacientes.js, app_profissionais.js, app_servicos.js (remove last line if it's just '}')
['app_pacientes.js', 'app_profissionais.js', 'app_servicos.js'].forEach(f => {
    const p = 'C:/Projeto_TRAE/Projeto_DP/' + f;
    let lines = fs.readFileSync(p, 'utf8').split('\n');
    while (lines[lines.length - 1].trim() === '') lines.pop();
    if (lines[lines.length - 1].trim() === '}') lines.pop();
    fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
});

// Fix app_v22.js
let v22Code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
v22Code = v22Code.replace(`if (type }of eyeBtn !== 'undefined' && eyeBtn)`, `if (typeof eyeBtn !== 'undefined' && eyeBtn)`);
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', v22Code, 'utf8');
