const fs = require('fs');

let c = fs.readFileSync('app_v22.js', 'utf8');

// 1. Orçamentos
const startOrc = c.indexOf("let { data: orcs, error: errOrc } = await db.from('orcamentos').select('*')");
const endOrc = c.indexOf("console.log('[ORCAMENTOS RAW SUPABASE DATA]':");
// fallback se não achar
let finalEndOrc = c.indexOf("console.log('[ORCAMENTOS RAW SUPABASE DATA]');");
if (finalEndOrc === -1) {
    finalEndOrc = c.indexOf("console.log('[ORCAMENTOS RAW SUPABASE DATA]'");
}

if (startOrc > -1 && finalEndOrc > -1) {
    const replacement = `let { data: rpcOrcs, error: rpcErr } = await db.rpc('get_paciente_orcamentos', { p_empresa_id: paciente.empresa_id, p_paciente_id: paciente_id });
            let orcs = Array.isArray(rpcOrcs) ? rpcOrcs : (rpcOrcs ? [rpcOrcs] : []);
            let errOrc = rpcErr;
            `;
    c = c.slice(0, startOrc) + replacement + c.slice(finalEndOrc);
    console.log("Replaced Orçamentos.");
}

// 2. Financeiro
const startFin = c.indexOf("let { data: fins, error: errFin } = await db.from('financeiro_transacoes').select('*')");
let finalEndFin = c.indexOf("console.log('[PORTAL DATA DEBUG] Financeiro retornado:'");

if (startFin > -1 && finalEndFin > -1) {
    const replacementFin = `let { data: rpcFins, error: rpcErr } = await db.rpc('get_paciente_financeiro', { p_empresa_id: paciente.empresa_id, p_paciente_id: paciente_id });
            let fins = Array.isArray(rpcFins) ? rpcFins : (rpcFins ? [rpcFins] : []);
            let errFin = rpcErr;
            `;
    c = c.slice(0, startFin) + replacementFin + c.slice(finalEndFin);
    console.log("Replaced Financeiro.");
}

// 3. Agendamentos
const startAgen = c.indexOf("const q = db.from('agenda_agendamentos')");
let finalEndAgen = c.indexOf("console.log('[PORTAL DATA DEBUG] Agendamentos retornados:'");

if (startAgen > -1 && finalEndAgen > -1) {
    const replacementAgen = `let { data: rpcData, error: rpcErr } = await db.rpc('get_paciente_agendamentos', { p_empresa_id: paciente.empresa_id, p_paciente_id: paciente_id });
        let data = Array.isArray(rpcData) ? rpcData : (rpcData ? [rpcData] : []);
        let error = rpcErr;
        `;
    c = c.slice(0, startAgen) + replacementAgen + c.slice(finalEndAgen);
    console.log("Replaced Agendamentos.");
}

fs.writeFileSync('app_v22.js', c, 'utf8');
console.log("Done");