const fs = require('fs');

let appV22 = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
const lines = appV22.split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (budPacienteNomeInput) {')) {
        start = i;
    }
    if (start !== -1 && lines[i].includes('window.addEventListener(\'scroll\', (e) => window.hideSuggestions(e), true);')) {
        end = i + 1; // including the '}'
        break;
    }
}

if (start !== -1 && end !== -1) {
    const block = lines.slice(start, end + 1).join('\n'); // +1 to include closing brace
    
    // Remove from app_v22.js
    const newLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
    fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', newLines.join('\n'), 'utf8');
    
    // Append to app_orcamentos.js inside DOMContentLoaded
    let appOrcamentos = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', 'utf8');
    const toAppend = `
// --- budPacienteNomeInput LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const budPacienteNomeInput = document.getElementById('budPacienteNome');
${block}
});
`;
    fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_orcamentos.js', appOrcamentos + toAppend, 'utf8');
    console.log('Moved budPacienteNomeInput block successfully');
} else {
    console.log('Could not find block', start, end);
}
