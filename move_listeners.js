const fs = require('fs');

const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
const lines = code.split('\n');

const start = lines.findIndex(l => l.includes('// Nav Patient'));
const end = lines.findIndex(l => l.includes('// --- PROFESSIONAL LOGIC'));

if (start === -1 || end === -1) {
    console.error('Could not find bounds');
    process.exit(1);
}

const block = lines.slice(start, end);

// Now we need to remove the block from app_v22.js
const newLines = [...lines.slice(0, start), ...lines.slice(end)];
fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', newLines.join('\n'), 'utf8');

// Now let's classify lines in block by looking at comments
let currentModule = 'app_v22.js';
const modules = {
    'app_pacientes.js': [],
    'app_profissionais.js': [],
    'app_agenda.js': [],
    'app_especialidades.js': [],
    'app_servicos.js': [],
    'app_orcamentos.js': [],
    'app_v22.js': [] // catchall
};

for (const line of block) {
    if (line.includes('// Nav Patient')) currentModule = 'app_pacientes.js';
    else if (line.includes('// Nav Professional')) currentModule = 'app_profissionais.js';
    else if (line.includes('if (agendaCard)')) currentModule = 'app_agenda.js';
    else if (line.includes('// Nav Specialty')) currentModule = 'app_especialidades.js';
    else if (line.includes('// Nav Service')) currentModule = 'app_servicos.js';
    else if (line.includes('// Nav Budget')) currentModule = 'app_orcamentos.js';
    else if (line.includes('// Masks')) currentModule = 'app_v22.js';
    else if (line.includes('// Conditional visibility for anamnese')) currentModule = 'app_pacientes.js';
    else if (line.includes('// Real-time search Patients')) currentModule = 'app_pacientes.js';
    else if (line.includes('// Real-time search Professionals')) currentModule = 'app_profissionais.js';
    else if (line.includes('// Real-time search Services')) currentModule = 'app_servicos.js';
    else if (line.includes('function getPatientProfissaoValue')) currentModule = 'app_pacientes.js';
    
    modules[currentModule].push(line);
}

for (const [mod, codeLines] of Object.entries(modules)) {
    if (codeLines.length === 0 || mod === 'app_v22.js') continue;
    
    let toAppend = `\n// --- DEFERRED DOM LISTENERS FROM CORE ---\ndocument.addEventListener('DOMContentLoaded', () => {\n`;
    for (const l of codeLines) {
        toAppend += '    ' + l + '\n';
    }
    toAppend += `});\n`;
    
    fs.appendFileSync('C:/Projeto_TRAE/Projeto_DP/' + mod, toAppend, 'utf8');
}

// Write the catchall to app_v22.js
if (modules['app_v22.js'].length > 0) {
    let toAppend = `\n// --- MASKS AND CORE LISTENERS ---\ndocument.addEventListener('DOMContentLoaded', () => {\n`;
    for (const l of modules['app_v22.js']) {
        toAppend += '    ' + l + '\n';
    }
    toAppend += `});\n`;
    const finalCode = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');
    fs.writeFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', finalCode + toAppend, 'utf8');
}

console.log('Done moving listeners');
