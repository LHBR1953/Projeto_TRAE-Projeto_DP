const fs = require('fs');

let appV22 = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
const lines = appV22.split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (budPacienteNomeInput) {')) {
        start = i - 1; // get the const budPacienteNomeInput = ...
    }
    if (start !== -1 && lines[i].includes('window.addEventListener(\'scroll\', hideSuggestions, true);')) {
        end = i + 1; // to include the closing }
        break;
    }
}

if (start !== -1 && end !== -1) {
    const block = lines.slice(start, end + 1).join('\n');
    
    // Remove from app_v22.js
    const newLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
    fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', newLines.join('\n'), 'utf8');
    
    // Append to app_orcamentos.js
    let appOrcamentos = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');
    const toAppend = `\n// --- budPacienteNomeInput LISTENERS ---\n` + block + '\n';
    fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', appOrcamentos + toAppend, 'utf8');
    console.log('Moved budPacienteNomeInput block successfully to app_orcamentos.js');
} else {
    console.log('Could not find block', start, end);
}
