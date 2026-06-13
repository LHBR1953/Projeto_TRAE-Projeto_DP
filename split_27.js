const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('C:/Projeto_TRAE/Projeto_DP/app_v22_FUNCIONANDO_SABADO_07_06_2026.js', 'utf8');

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
    'app_atendimento_consulta.js': [],
    'app_atendimento_profissional.js': [],
    'app_orcamentos.js': [],
    'app_financeiro.js': [],
    'app_comissoes.js': [],
    'app_laboratorio.js': [],
    'app_estoque_inventario.js': [],
    'app_estoque_modelos.js': [],
    'app_estoque_vinculo.js': [],
    'app_estoque_movimentacoes.js': [],
    'app_estoque_relatorios.js': [],
    'app_profissionais.js': [],
    'app_especialidades.js': [],
    'app_servicos.js': [],
    'app_marketing.js': [],
    'app_producao_protetica.js': [],
    'app_suporte_central.js': [],
    'app_suporte_tickets.js': [],
    'app_config_empresas.js': [],
    'app_config_assinaturas.js': [],
    'app_config_minhaclinica.js': [],
    'app_config_parametros.js': [],
    'app_config_usuarios.js': [],
    'app_config_audit.js': [],
    'app_v22.js': [] // the core
};

const rules = [
    { file: 'app_dashboard.js', pattern: /(dashboard|dash|kpi|ticket|renewals|superadmin)/i },
    { file: 'app_agenda.js', pattern: /(agenda|agendamento|calendar|horario|bloqueio|workhours)/i },
    { file: 'app_pacientes.js', pattern: /(paciente|prontuario|anamnese|evolucao|patient)/i },
    { file: 'app_atendimento_consulta.js', pattern: /(consulta|queue|fila)/i },
    { file: 'app_atendimento_profissional.js', pattern: /(atendimento|laudo|confirmAtendimento)/i },
    { file: 'app_orcamentos.js', pattern: /(orcamento|budget|proposta)/i },
    { file: 'app_financeiro.js', pattern: /(financeiro|caixa|pagamento|payment|transacao|transaction|receipt|recibo|conciliacao)/i },
    { file: 'app_comissoes.js', pattern: /(comissao|commission)/i },
    { file: 'app_producao_protetica.js', pattern: /(producao|protetica|protese|laboratorio|lab)/i },
    { file: 'app_estoque_relatorios.js', pattern: /(relatorio.*estoque)/i },
    { file: 'app_estoque_modelos.js', pattern: /(modelo)/i },
    { file: 'app_estoque_vinculo.js', pattern: /(vinculo)/i },
    { file: 'app_estoque_movimentacoes.js', pattern: /(movimentacao|moviment|entrada|saida)/i },
    { file: 'app_estoque_inventario.js', pattern: /(estoque|inventory|produto)/i },
    { file: 'app_profissionais.js', pattern: /(profissional|professional)/i },
    { file: 'app_especialidades.js', pattern: /(especialidade|specialty)/i },
    { file: 'app_servicos.js', pattern: /(servico|service|procedimento|subdivisao)/i },
    { file: 'app_marketing.js', pattern: /(marketing|campanha|lead)/i },
    { file: 'app_suporte_tickets.js', pattern: /(ticket|kpiTicket)/i },
    { file: 'app_suporte_central.js', pattern: /(faq|help|suporte)/i },
    { file: 'app_config_assinaturas.js', pattern: /(assinatura|plan|renewals)/i },
    { file: 'app_config_minhaclinica.js', pattern: /(clinica|tenant)/i },
    { file: 'app_config_parametros.js', pattern: /(parametro|config)/i },
    { file: 'app_config_usuarios.js', pattern: /(usuario|user|perm)/i },
    { file: 'app_config_audit.js', pattern: /(audit|log)/i },
    { file: 'app_config_empresas.js', pattern: /(empresa)/i }
];

const corePattern = /^(mask|isValid|fetchWithTimeout|supabase|APP_BUILD|AUTO_SEED|db|currentUser|currentEmpresa|login|logout|auth|init|boot|showToast|showLoading|closeModal|openModal|clear|format|get|set|has|is)/i;

let lastEnd = 0;

ast.body.forEach(node => {
    let dest = 'app_v22.js';
    
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
        if (nodeCode.includes('document.getElementById') && !nodeCode.includes('function ')) {
            dest = 'app_v22.js';
        }
    }

    files[dest].push(nodeCode);
});

if (lastEnd < code.length) {
    files['app_v22.js'].push(code.slice(lastEnd));
}

// Remove old files to avoid conflicts, then write the new ones.
// We will just write/overwrite them.
for (const [filename, chunks] of Object.entries(files)) {
    // Only write if it's app_v22.js OR if it has more than just an empty array
    if (chunks.length > 0 || filename === 'app_v22.js') {
        fs.writeFileSync(`C:/Projeto_TRAE/Projeto_DP/${filename}`, chunks.join(''), 'utf8');
        console.log(`Created ${filename} with ${chunks.length} blocks.`);
    }
}
