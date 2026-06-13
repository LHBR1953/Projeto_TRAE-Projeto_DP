const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22.js', 'utf8');

// Parse the AST
let ast;
try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
} catch (e) {
    console.error("Parse error:", e);
    process.exit(1);
}

const files = {
    'app_dashboard.js': [],
    'app_agenda.js': [],
    'app_pacientes.js': [],
    'app_atendimento.js': [],
    'app_orcamentos.js': [],
    'app_financeiro.js': [],
    'app_comissoes.js': [],
    'app_laboratorio.js': [],
    'app_configuracoes.js': [],
    'app_v22.js': [] // the core
};

// Heuristics for mapping function/variable names to files
const rules = [
    { file: 'app_dashboard.js', pattern: /(dashboard|dash|kpi|ticket|renewals|superadmin)/i },
    { file: 'app_agenda.js', pattern: /(agenda|agendamento|calendar|horario|bloqueio|workhours)/i },
    { file: 'app_pacientes.js', pattern: /(paciente|prontuario|anamnese|evolucao|patient)/i },
    { file: 'app_atendimento.js', pattern: /(atendimento|laudo|fila|confirmAtendimento)/i },
    { file: 'app_orcamentos.js', pattern: /(orcamento|budget|proposta)/i },
    { file: 'app_financeiro.js', pattern: /(financeiro|caixa|pagamento|payment|transacao|transaction|receipt|recibo|conciliacao)/i },
    { file: 'app_comissoes.js', pattern: /(comissao|commission)/i },
    { file: 'app_laboratorio.js', pattern: /(laboratorio|lab|protetico|protese)/i },
    { file: 'app_configuracoes.js', pattern: /(configuracao|clinica|empresa|profissional|convenio|procedimento|specialty|especialidade|tenant)/i }
];

// Core words that should definitely stay in app_v22.js
const corePattern = /^(mask|isValid|fetchWithTimeout|supabase|APP_BUILD|AUTO_SEED|db|currentUser|currentEmpresa|login|logout|auth|init|boot|showToast|showLoading|closeModal|openModal)/i;

let lastEnd = 0;

ast.body.forEach(node => {
    let dest = 'app_v22.js';
    
    // get comments before the node
    let nodeCode = code.slice(lastEnd, node.end);
    lastEnd = node.end;

    let names = [];
    if (node.type === 'FunctionDeclaration') {
        if (node.id) names.push(node.id.name);
    } else if (node.type === 'VariableDeclaration') {
        node.declarations.forEach(d => {
            if (d.id && d.id.name) names.push(d.id.name);
        });
    } else if (node.type === 'ClassDeclaration') {
        if (node.id) names.push(node.id.name);
    }

    if (names.length > 0) {
        let name = names[0];
        if (!corePattern.test(name)) {
            for (let rule of rules) {
                if (rule.pattern.test(name)) {
                    dest = rule.file;
                    break;
                }
            }
        }
    } else {
        // Expressions, event listeners, etc. We can try to regex the code itself, but it's safer to leave in app_v22.js 
        // unless it clearly belongs to a module.
        // Actually, the user asked to remove ALL functions of the other modules.
        // If it's a global event listener, it can stay in app_v22.js
        if (nodeCode.includes('document.getElementById') && !nodeCode.includes('function ')) {
            dest = 'app_v22.js';
        }
    }

    files[dest].push(nodeCode);
});

// append remaining code (if any)
if (lastEnd < code.length) {
    files['app_v22.js'].push(code.slice(lastEnd));
}

// Write the files
for (const [filename, chunks] of Object.entries(files)) {
    if (chunks.length > 0) {
        fs.writeFileSync(`C:/Projeto_TRAE/Projeto_DP/${filename}`, chunks.join(''), 'utf8');
        console.log(`Created ${filename} with ${chunks.length} blocks.`);
    }
}
