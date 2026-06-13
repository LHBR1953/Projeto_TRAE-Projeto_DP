const fs = require('fs');

let code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');

// We will find lines that have `bud[A-Za-z0-9_]+\.something`
// and if they are not already wrapped in `if (bud...)`, we wrap them.
// Actually, it's safer to just wrap the whole line if it starts with `bud` or `if (bud...` is missing.

const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // match variable starting with bud and then .addEventListener or .value = or .innerHTML = or .style.
    const match = line.match(/^(\s*)(bud[A-Za-z0-9_]+)\.(addEventListener|value|innerHTML|style|classList|removeAttribute|setAttribute|focus|blur)\b(.*)$/);
    if (match) {
        const indent = match[1];
        const varName = match[2];
        
        // Wrap it
        lines[i] = `${indent}if (typeof ${varName} !== 'undefined' && ${varName}) { ${line.trim()} }`;
    }
}

fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', lines.join('\n'), 'utf8');

// Do the same for app_v22.js just in case
let v22 = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
const v22Lines = v22.split('\n');
for (let i = 0; i < v22Lines.length; i++) {
    const line = v22Lines[i];
    const match = line.match(/^(\s*)(bud[A-Za-z0-9_]+)\.(addEventListener|value|innerHTML|style|classList|removeAttribute|setAttribute|focus|blur)\b(.*)$/);
    if (match) {
        const indent = match[1];
        const varName = match[2];
        v22Lines[i] = `${indent}if (typeof ${varName} !== 'undefined' && ${varName}) { ${line.trim()} }`;
    }
}
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', v22Lines.join('\n'), 'utf8');

console.log('Done wrapping bud variables');
