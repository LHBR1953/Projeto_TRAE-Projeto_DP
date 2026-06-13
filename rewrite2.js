const fs = require('fs');
const path = 'c:\\Projeto_TRAE\\Projeto_DP\\app_v22.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `
        const itensQ = db.from('orcamento_itens')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('status', 'Liberado');
            
        const { data: itensLiberados, error: itensErr } = await withTimeout(itensQ, 15000, 'orcamento_itens:liberados');
        if (itensErr) throw itensErr;

        const itemsRows = [];`;

const replaceStr = `
        const itensQ = db.from('orcamento_itens')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('status', 'Liberado');
            
        const { data: itensLiberados, error: itensErr } = await withTimeout(itensQ, 15000, 'orcamento_itens:liberados');
        if (itensErr) throw itensErr;
        
        // Busca agendamentos do dia para mostrar a hora
        const agQ = db.from('agenda_agendamentos')
            .select('id, paciente_id, hora_inicio')
            .eq('empresa_id', empresaId)
            .eq('data_agendamento', dateStr);
        const { data: agData } = await withTimeout(agQ, 15000, 'agenda_agendamentos:horarios');

        const itemsRows = [];`;

content = content.replace(searchStr, replaceStr);

const pushSearchStr = `              itemsRows.push({
                  hora: '--:--', // Não cruzamos com agendamento direto por instrução, listamos todos do dia.
                  agendamentoId: '',
                  paciente,
                  budget: b,
                  itemId: String(it.id || ''),
                  itemLabel: itemLabelWithEls,
                  itemStatus: it.status || '-'
              });`;

const pushReplaceStr = `              let horaAtend = '--:--';
              let agId = '';
              if (agData && paciente && paciente.id) {
                  const ag = agData.find(a => String(a.paciente_id) === String(paciente.id) || String(a.paciente_id) === String(paciente.seqid));
                  if (ag) {
                      horaAtend = String(ag.hora_inicio || '--:--').substring(0, 5);
                      agId = ag.id;
                  }
              }

              itemsRows.push({
                  hora: horaAtend,
                  agendamentoId: agId,
                  paciente,
                  budget: b,
                  itemId: String(it.id || ''),
                  itemLabel: itemLabelWithEls,
                  itemStatus: it.status || '-'
              });`;

content = content.replace(pushSearchStr, pushReplaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log("Done");