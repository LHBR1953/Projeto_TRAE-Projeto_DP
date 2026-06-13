const fs = require('fs');
const files = fs.readdirSync('C:/Projeto_TRAE/Projeto_DP/').filter(f => f.startsWith('app_') && f.endsWith('.js'));

for (const file of files) {
    const path = 'C:/Projeto_TRAE/Projeto_DP/' + file;
    let code = fs.readFileSync(path, 'utf8');
    let changed = false;

    // We look for patterns like:
    // if (btnName) btnName.addEventListener(...)
    // or if (agendaCard) { attachAgendaListeners(); ... }
    
    // Just a blanket replace:
    // if (xyz)  -> if (typeof xyz !== 'undefined' && xyz)
    // ONLY inside the // --- DEFERRED DOM LISTENERS FROM CORE --- block
    
    const blockStart = code.indexOf('// --- DEFERRED DOM LISTENERS FROM CORE ---');
    const blockStart2 = code.indexOf('// --- MASKS AND CORE LISTENERS ---');
    const startIdx = Math.max(blockStart, blockStart2);
    
    if (startIdx !== -1) {
        let prefix = code.slice(0, startIdx);
        let suffix = code.slice(startIdx);
        
        // Replace `if (variable)` with `if (typeof variable !== 'undefined' && variable)`
        // Be careful not to replace `if (!variable)` or `if (a || b)`.
        
        // We can just regex replace specifically the known undeclared ones:
        const vars = ['agendaCard', 'agendaDate', 'agendaProfessional', 'btnAgendaRefresh', 'btnAgendaNew', 
        'btnCloseModalAgenda', 'btnAgendaCancel', 'modalAgenda', 'formAgenda', 'btnAgendaDelete',
        'btnNewSpecialty', 'btnBackSpecialty', 'btnCancelSpecialty',
        'btnNewService', 'btnBackService', 'btnCancelService',
        'btnNewBudget',
        'inputCpf', 'inputCelular', 'profCelular', 'inputTelefone', 'inputCep',
        'searchInput', 'searchProfessionalInput', 'searchServiceInput', 'patientForm'];

        for (const v of vars) {
            // regex to find exactly `if (v)` or `if (v `
            const re = new RegExp(`if\\s*\\(\\s*${v}\\s*\\)`, 'g');
            suffix = suffix.replace(re, `if (typeof ${v} !== 'undefined' && ${v})`);
            
            const re2 = new RegExp(`if\\s*\\(\\s*${v}\\s*&&\\s*!${v}\\.__`, 'g');
            suffix = suffix.replace(re2, `if (typeof ${v} !== 'undefined' && ${v} && !${v}.__`);
            
            const re3 = new RegExp(`if\\s*\\(\\s*!${v}\\s*\\|\\|`, 'g');
            suffix = suffix.replace(re3, `if (typeof ${v} === 'undefined' || !${v} ||`);
        }
        
        code = prefix + suffix;
        changed = true;
    }
    
    if (changed) {
        fs.writeFileSync(path, code, 'utf8');
        console.log('Fixed implicit globals in ' + file);
    }
}
