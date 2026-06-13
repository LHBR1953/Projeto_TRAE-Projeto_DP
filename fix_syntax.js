const fs = require('fs');

const fixes = [
    {
        file: 'app_atendimento.js',
        oldStr: `if (typeof  }target !== 'undefined' && target) { target.disabled = false; }`,
        newStr: `if (typeof target !== 'undefined' && target) { target.disabled = false; }`
    },
    {
        file: 'app_atendimento_profissional.js',
        oldStr: `if (typeof  }target !== 'undefined' && target) { target.disabled = false; }`,
        newStr: `if (typeof target !== 'undefined' && target) { target.disabled = false; }`
    },
    {
        file: 'app_config_audit.js',
        oldStr: `if } (typeof out !== 'undefined' && out) { out.value = \`Falha ao carregar auditoria de schema: \${msg}\`; }`,
        newStr: `if (typeof out !== 'undefined' && out) { out.value = \`Falha ao carregar auditoria de schema: \${msg}\`; }`
    },
    {
        file: 'app_dashboard.js',
        oldStr: `if (ty }peof btn !== 'undefined' && btn) { btn.disabled = false; }`,
        newStr: `if (typeof btn !== 'undefined' && btn) { btn.disabled = false; }`
    },
    {
        file: 'app_estoque_inventario.js',
        oldStr: `                if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
 }
                if (window.__forceInventoryAreaOptions) window.__forceInventoryAreaOptions(tipoInventario || document.getElementById('inventoryTipoInventario'));`,
        newStr: `                if (window.updateInventoryAreaOptionsForTipoInventario) window.updateInventoryAreaOptionsForTipoInventario();
                if (window.__forceInventoryAreaOptions) window.__forceInventoryAreaOptions(tipoInventario || document.getElementById('inventoryTipoInventario'));`
    },
    {
        file: 'app_orcamentos.js',
        oldStr: `if (typeof picker !== 'undefined' && picker) { picker.value = opt && opt.va }lue ? String(opt.text || '') : ''; }`,
        newStr: `if (typeof picker !== 'undefined' && picker) { picker.value = opt && opt.value ? String(opt.text || '') : ''; }`
    },
    {
        file: 'app_pacientes.js',
        oldStr: `if (ty }peof btn !== 'undefined' && btn) { btn.disabled = false; }`,
        newStr: `if (typeof btn !== 'undefined' && btn) { btn.disabled = false; }`
    },
    {
        file: 'app_profissionais.js',
        oldStr: `if (typeof btn !== 'undefined' && btn) { } btn.disabled = false; }`,
        newStr: `if (typeof btn !== 'undefined' && btn) { btn.disabled = false; }`
    },
    {
        file: 'app_servicos.js',
        oldStr: `showToast(err && err.message ? String(err.message) : 'Falha ao salvar v├¡ }nculo.', true);`,
        newStr: `showToast(err && err.message ? String(err.message) : 'Falha ao salvar vínculo.', true);`
    },
    {
        file: 'app_v22.js',
        oldStr: `if (typeof btn !== 'undefined' && b }tn) { btn.disabled = false; }`,
        newStr: `if (typeof btn !== 'undefined' && btn) { btn.disabled = false; }`
    }
];

for (const fix of fixes) {
    const path = 'C:/Projeto_TRAE/Projeto_DP/' + fix.file;
    let code = fs.readFileSync(path, 'utf8');
    if (code.includes(fix.oldStr)) {
        code = code.replace(fix.oldStr, fix.newStr);
        fs.writeFileSync(path, code, 'utf8');
        console.log(`Fixed ${fix.file}`);
    } else {
        console.log(`Could not find old string in ${fix.file}`);
    }
}
