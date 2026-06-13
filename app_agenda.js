


async function loadCurrentEmpresaHorarios() {
    if (!currentEmpresaId) return;
    try {
        const { data, error } = await db.from('empresas').select('*').eq('id', currentEmpresaId).maybeSingle();
        
        // Fallback para o cache da memória caso o Supabase não retorne as colunas novas imediatamente
        const empCache = (typeof activeEmpresasList !== 'undefined' ? activeEmpresasList : []).find(e => String(e.id) === String(currentEmpresaId)) || {};

        if (data || empCache.id) {
            const source = data || empCache;
            currentEmpresaHorarios = {
                inicio_semana: source.horario_inicio_semana || empCache.horario_inicio_semana || '08:00',
                fim_semana: source.horario_fim_semana || empCache.horario_fim_semana || '20:30',
                inicio_sabado: source.horario_inicio_sabado || empCache.horario_inicio_sabado || '08:30',
                fim_sabado: source.horario_fim_sabado || empCache.horario_fim_sabado || '14:00',
                domingo_fechado: source.domingo_fechado !== undefined ? source.domingo_fechado : (empCache.domingo_fechado !== undefined ? empCache.domingo_fechado : true)
            };
            console.log('--- Horários da Empresa Carregados ---', currentEmpresaHorarios);
        } else {
            currentEmpresaHorarios = getDefaultHorarios();
            console.log('--- Horários da Empresa (DEFAULT) ---', currentEmpresaHorarios);
        }
    } catch(err) {
        console.error("Erro ao carregar horarios da empresa", err);
        currentEmpresaHorarios = getDefaultHorarios();
    }
}
const navAgenda = document.getElementById('navAgenda');
const agendaView = document.getElementById('agendaView');

const agendaCard = document.getElementById('agendaCard');
const agendaFields = Array.from({ length: 7 }).map((_, i) => {
    const day = i + 1;
    return {
        day,
        enabled: document.getElementById(`agendaDay${day}Enabled`),
        start: document.getElementById(`agendaDay${day}Start`),
        end: document.getElementById(`agendaDay${day}End`),
        slot: document.getElementById(`agendaDay${day}Slot`)
    };
});

let currentAgendaAgendamentos = [];

// Agenda DOM Elements
const agendaDate = document.getElementById('agendaDate');
const agendaProfessional = document.getElementById('agendaProfessional');
const btnAgendaRefresh = document.getElementById('btnAgendaRefresh');
const btnAgendaNew = document.getElementById('btnAgendaNew');
const agendaSummary = document.getElementById('agendaSummary');
const agendaSlotsBody = document.getElementById('agendaSlotsBody');
const agendaEmptyState = document.getElementById('agendaEmptyState');
const modalAgenda = document.getElementById('modalAgenda');
const btnCloseModalAgenda = document.getElementById('btnCloseModalAgenda');
const btnAgendaCancel = document.getElementById('btnAgendaCancel');
const btnAgendaDelete = document.getElementById('btnAgendaDelete');
const modalAgendaTitle = document.getElementById('modalAgendaTitle');
const formAgenda = document.getElementById('formAgenda');
const agendaId = document.getElementById('agendaId');
const agendaPaciente = document.getElementById('agendaPaciente');
const agendaPacienteBusca = document.getElementById('agendaPacienteBusca');
const agendaPacienteDropdown = document.getElementById('agendaPacienteDropdown');
const agendaTitulo = document.getElementById('agendaTitulo');
const agendaDataInput = document.getElementById('agendaDataInput');
const agendaInicio = document.getElementById('agendaInicio');
const agendaFim = document.getElementById('agendaFim');
const agendaStatus = document.getElementById('agendaStatus');
const agendaObs = document.getElementById('agendaObs');

async function fetchAgendaRowsForFechamento({ dateStr, profSeqId }) {
    const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
    let q = db.from('agenda_agendamentos')
        .select('id,paciente_id,profissional_id,inicio,status,titulo,observacoes')
        .eq('empresa_id', currentEmpresaId)
        .gte('inicio', startIso)
        .lte('inicio', endIso)
        .order('inicio', { ascending: true });
    if (profSeqId) q = q.eq('profissional_id', Number(profSeqId));
    const { data, error } = await withTimeout(q, 20000, 'agenda_agendamentos:fechamento');
    if (error) throw error;
    return data || [];
}

function buildAtendimentoRowsFromAgenda({ agendaRows, profSeqId, dateStr }) {
    const list = (agendaRows || []).filter(a => String(a.status || '') !== 'CANCELADO');
    const byPaciente = new Map();
    list.forEach(a => {
        if (a.paciente_id == null) return;
        const k = String(a.paciente_id);
        if (!byPaciente.has(k)) byPaciente.set(k, []);
        byPaciente.get(k).push(a);
    });
    byPaciente.forEach(arr => arr.sort((a, b) => String(a.inicio || '').localeCompare(String(b.inicio || ''))));

    const rows = [];
    byPaciente.forEach((arr, pacienteSeqIdStr) => {
        const paciente = getPacienteDetailsBySeqId(pacienteSeqIdStr);
        const pacienteUuid = paciente?.id || null;
        if (!pacienteUuid) return;

        const firstAg = arr[0];
        const hora = firstAg && firstAg.inicio ? formatTimeHHMM(new Date(firstAg.inicio)) : '--:--';

        const patientBudgets = (budgets || []).filter(b => String(b.pacienteid || b.paciente_id || '') === String(pacienteUuid));
        patientBudgets.forEach(b => {
            const itens = (b.orcamento_itens || b.itens || []);
            const tipoKey = normalizeKey(String(b.tipo || 'Normal'));
            const isFreeBudget = tipoKey === 'CORTESIA' || tipoKey === 'RETRABALHO';
            itens.forEach(it => {
                const executor = it.profissional_id ?? it.profissionalId ?? it.executor_id ?? it.executorId;
                const execProf = findProfessionalByAnyId(executor);
                const execSeqId = execProf && execProf.seqid != null ? String(execProf.seqid) : String(executor || '');
                if (profSeqId && execSeqId !== String(profSeqId)) return;

                const st = String(it.status || it.item_status || '').trim();
                const stKey = normalizeStatusKey(st);
                if (stKey === 'CANCELADO') return;
                
                // Exigir que a data do item finalizado seja compatível com a data do Fechamento
                // Como updated_at muda em qualquer edição do orçamento, usamos data_finalizacao (se existir) ou o created_at como fallback para evitar que itens antigos apareçam hoje.
                const itemDateStr = it.data_finalizacao ? it.data_finalizacao.split('T')[0] : (it.created_at ? it.created_at.split('T')[0] : (it.updated_at ? it.updated_at.split('T')[0] : ''));
                if (stKey === 'FINALIZADO' && itemDateStr && dateStr && itemDateStr !== dateStr) return;

                const eligible = isFreeBudget || stKey === 'LIBERADO' || stKey === 'EMEXECUCAO' || stKey === 'FINALIZADO';
                if (!eligible) return;

                const serv = (services || []).find(s => String(s.id) === String(it.servico_id || it.servicoId || ''));
                const desc = serv ? serv.descricao : (it.servicoDescricao || it.descricao || `#${it.servico_id || it.servicoId || it.id || ''}`);
                const sub = String(it.subdivisao || it.sub_divisao || '').trim();
                const itemLabel = sub ? `${desc} — ${sub}` : desc;

                const qtde = Number(it.qtde || 1);
                const valor = Number(it.valor || 0);
                const total = (Number.isFinite(qtde) && qtde > 0 ? qtde : 1) * (Number.isFinite(valor) ? valor : 0);

                rows.push({
                    hora,
                    pacienteNome: String(paciente?.nome || ''),
                    budgetSeq: b.seqid,
                    itemLabel,
                    itemStatus: it.status || it.item_status || '',
                    itemTotal: total
                });
            });
        });
    });

    rows.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')) || String(a.pacienteNome || '').localeCompare(String(b.pacienteNome || ''), 'pt-BR'));
    return rows;
}

async function printAgendaDayFromUI() {
    if (!agendaDate || !agendaProfessional || !agendaSlotsBody) { showToast('Agenda indisponível.', true); return; }
    const dateStr = String(agendaDate.value || '');
    const profSeqId = String(agendaProfessional.value || '');
    if (!dateStr || !profSeqId) { showToast('Selecione Data e Profissional.', true); return; }
    const profName = getProfessionalNameBySeqId(Number(profSeqId));
    const humanDate = dateStr.split('-').reverse().join('/');
    const titulo = `Agenda do Dia - ${profName} - ${humanDate}`;

    const rows = Array.from(agendaSlotsBody.querySelectorAll('tr')).map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        const hora = tds[0] ? tds[0].textContent.trim() : '';
        const paciente = tds[1] ? tds[1].textContent.trim() : '';
        const status = tds[2] ? tds[2].textContent.trim() : '';
        if (!hora) return null;
        return { hora, paciente, status };
    }).filter(Boolean);

    const itens = rows.map(r => `<tr><td>${escapeHtml(r.hora)}</td><td>${escapeHtml(r.paciente || '-')}</td><td>${escapeHtml(r.status || '-')}</td></tr>`).join('')
        || `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem agendamentos</td></tr>`;

    const legacyHtml = `
        <html><head><title>${escapeHtml(titulo)}</title>
        <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
        h2 { margin: 0 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
        th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
        </style>
        </head><body>
        <h2>${escapeHtml(titulo)}</h2>
        <table>
            <thead><tr><th>Horário</th><th>Paciente/Título</th><th>Status</th></tr></thead>
            <tbody>${itens}</tbody>
        </table>
        </body></html>
    `;
    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: titulo, legacyHtml, width: 980, height: 720 });
    if (!ok) return;
}

async function printAgendaWeekFromUI(compact = false) {
    if (!agendaProfessional) { showToast('Selecione o profissional.', true); return; }
    const profSeqId = Number(agendaProfessional.value || 0);
    if (!profSeqId) { showToast('Selecione o profissional.', true); return; }
    try {
        const q = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', profSeqId)
            .eq('ativo', true)
            .order('dia_semana', { ascending: true })
            .order('hora_inicio', { ascending: true });
        const { data, error } = await withTimeout(q, 15000, 'agenda_disponibilidade:print_week');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const byDay = new Map();
        rows.forEach(r => {
            const d = Number(r.dia_semana || 0);
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d).push(r);
        });
        const dayNames = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' };
        const profName = getProfessionalNameBySeqId(profSeqId);
        const titulo = compact ? `Agenda Semanal Reduzida - ${profName}` : `Agenda Semanal - ${profName}`;

        const content = [1, 2, 3, 4, 5, 6, 7].map(d => {
            const arr = (byDay.get(d) || []).slice();
            const items = arr.map(r => {
                const ini = String(r.hora_inicio || '');
                const fim = String(r.hora_fim || '');
                const slot = Number(r.slot_minutos || 30);
                return compact
                    ? `<div>${escapeHtml(ini)}-${escapeHtml(fim)} • ${slot}min</div>`
                    : `<tr><td>${escapeHtml(ini)}</td><td>${escapeHtml(fim)}</td><td>${escapeHtml(String(slot))}</td></tr>`;
            }).join('') || (compact ? `<div style="color:#6b7280;">Sem disponibilidade</div>` : `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem disponibilidade</td></tr>`);

            return compact
                ? `<div style="margin-bottom:10px;"><div style="font-weight:700;margin:6px 0;">${dayNames[d]}</div>${items}</div>`
                : `<h3 style="margin:12px 0 6px 0;">${dayNames[d]}</h3>
                   <table><thead><tr><th>Início</th><th>Fim</th><th>Slot (min)</th></tr></thead><tbody>${items}</tbody></table>`;
        }).join('');

        const legacyHtml = `
            <html><head><title>${escapeHtml(titulo)}</title>
            <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            h2 { margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
            th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
            </style>
            </head><body>
            <h2>${escapeHtml(titulo)}</h2>
            ${content}
            </body></html>
        `;
        const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: titulo, legacyHtml, width: 980, height: 720 });
        if (!ok) return;
    } catch (e) {
        showToast('Falha ao gerar impressão da agenda semanal.', true);
    }
}

async function printAgendaWeekAppointmentsFromUI() {
    if (!agendaProfessional || !agendaDate) { showToast('Agenda indisponível.', true); return; }
    const profSeqId = Number(agendaProfessional.value || 0);
    const dateStr = String(agendaDate.value || '');
    if (!profSeqId || !dateStr) { showToast('Selecione Data e Profissional.', true); return; }
    const base = new Date(`${dateStr}T00:00:00`);
    const day = base.getDay() || 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - (day - 1));
    const days = Array.from({ length: 7 }).map((_, i) => {
        const x = new Date(monday);
        x.setDate(monday.getDate() + i);
        const yyyy = x.getFullYear();
        const mm = String(x.getMonth() + 1).padStart(2, '0');
        const dd = String(x.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    try {
        const profName = getProfessionalNameBySeqId(profSeqId);
        const titulo = `Agenda Semanal (Agendamentos) - ${profName}`;
        const sections = [];
        for (const d of days) {
            const rows = await fetchAgendaRowsForFechamento({ dateStr: d, profSeqId });
            const valid = rows.filter(a => String(a.status || '') !== 'CANCELADO');
            const itens = valid.map(a => {
                const dt = new Date(a.inicio);
                const hh = String(dt.getHours()).padStart(2, '0');
                const mi = String(dt.getMinutes()).padStart(2, '0');
                const ini = `${hh}:${mi}`;
                const st = a.status || '—';
                const pacienteId = a.paciente_id != null ? String(a.paciente_id) : '';
                const pacienteNome = pacienteId ? getPacienteNameBySeqId(pacienteId) : '';
                const tit = String(a.titulo || '').trim();
                const label = pacienteNome
                    ? (tit && normalizeKey(tit) !== normalizeKey(pacienteNome) ? `${pacienteNome} — ${tit}` : pacienteNome)
                    : (tit || '-');
                return `<tr><td>${ini}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(st)}</td></tr>`;
            }).join('') || `<tr><td colspan="3" style="text-align:center;color:#6b7280;padding:12px;">Sem agendamentos</td></tr>`;
            sections.push(`
                <h3 style="margin:12px 0 6px 0;">${d}</h3>
                <table><thead><tr><th>Início</th><th>Paciente/Título</th><th>Status</th></tr></thead><tbody>${itens}</tbody></table>
            `);
        }
        const legacyHtml = `
            <html><head><title>${escapeHtml(titulo)}</title>
            <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            h2 { margin: 0 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
            th { background: #f3f4f6; font-size: 12px; color: #6b7280; }
            </style>
            </head><body>
            <h2>${escapeHtml(titulo)}</h2>
            ${sections.join('')}
            </body></html>
        `;
        const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: titulo, legacyHtml, width: 980, height: 720 });
        if (!ok) return;
    } catch (e) {
        showToast('Falha ao gerar impressão semanal com agendamentos.', true);
    }
}

function updateAgendaEndOptions(f, tcValue) {
    if (!f.end) return;
    const currEnd = f.end.getAttribute('data-curr-end') || f.end.value || '';
    const endOpts = [];
    const limits = getDayLimits(f.day);
    
    if (f.start && f.start.value) {
        const parts = f.start.value.split(':');
        const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const firstEndMins = startMins + tcValue;

        // A hora final não pode exceder o horário estipulado na empresa
        const limiteMaximoFim = limits.end;

        for (let mTotal = firstEndMins; mTotal <= limiteMaximoFim; mTotal += tcValue) {
            const h = Math.floor(mTotal / 60);
            const m = mTotal % 60;
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            endOpts.push(`${hh}:${mm}`);
        }
        
        if (currEnd && !endOpts.includes(currEnd)) {
            const cParts = currEnd.split(':');
            if (cParts.length === 2) {
                const cMins = parseInt(cParts[0], 10) * 60 + parseInt(cParts[1], 10);
                if (cMins >= firstEndMins && cMins <= limiteMaximoFim) {
                    endOpts.push(currEnd);
                }
            }
        }
        endOpts.sort();
    }

    const endOptsHtml = ['<option value="">--:--</option>'];
    endOpts.forEach(val => endOptsHtml.push(`<option value="${val}">${val}</option>`));
    
    f.end.innerHTML = endOptsHtml.join('');
    f.end.value = endOpts.includes(currEnd) ? currEnd : '';
}

function updateAgendaSteps() {
    const tcInput = document.getElementById('profTempoConsulta');
    if (!tcInput) return;
    const tcValue = parseInt(tcInput.value, 10);
    if (isNaN(tcValue) || tcValue <= 0) return;

    // LIMPEZA ABSOLUTA DA MEMÓRIA VISUAL: 
    // Zera o innerHTML e o valor de todos os select boxes ANTES do recálculo.
    // Isso previne qualquer acúmulo de lixo ou duplicação de horários passados/inválidos 
    // quando o usuário digita/muda o tempo de consulta várias vezes.
    agendaFields.forEach(f => {
        if (f.start) {
            if (f.start.options && f.start.options.length > 0) {
                f.start.setAttribute('data-curr-start', f.start.value);
            }
            f.start.innerHTML = '';
            f.start.value = '';
        }
        if (f.end) {
            if (f.end.options && f.end.options.length > 0) {
                f.end.setAttribute('data-curr-end', f.end.value);
            }
            f.end.innerHTML = '';
            f.end.value = '';
        }
    });

    agendaFields.forEach(f => {
        if (f.start) {
            const currStart = f.start.getAttribute('data-curr-start') || '';
            const actualOpts = [];
            const limits = getDayLimits(f.day);
            
            if (limits.fechado) {
                if (f.enabled) { f.enabled.checked = false; f.enabled.disabled = true; }
                f.start.disabled = true;
                if (f.end) f.end.disabled = true;
                if (f.slot) f.slot.disabled = true;
                return;
            } else {
                if (f.enabled) f.enabled.disabled = false;
            }
            
            // 1. Tenta pegar o intervalo específico da linha da agenda (f.slot)
            // Se não for válido ou não existir, usa o tcValue global (Consulta Minutos)
            let currentLineTcValue = tcValue;
            if (f.slot && f.slot.value) {
                const parsedSlot = parseInt(f.slot.value, 10);
                if (!isNaN(parsedSlot) && parsedSlot > 0) {
                    currentLineTcValue = parsedSlot;
                }
            }
            
            // O ÚLTIMO HORÁRIO DE INÍCIO DISPONÍVEL NO COMBOBOX É: (HORA_FIM_DA_EMPRESA - INTERVALO_DA_CONSULTA)
            // Isso garante que, ao iniciar uma consulta no último horário, ela termine exatamente no horário de fechamento da empresa.
            const limiteMaximoInicio = limits.end - currentLineTcValue;

            for (let m = limits.start; m <= limiteMaximoInicio; m += currentLineTcValue) {
                const hh = String(Math.floor(m / 60)).padStart(2, '0');
                const mm = String(m % 60).padStart(2, '0');
                actualOpts.push(`${hh}:${mm}`);
            }
            
            if (currStart && !actualOpts.includes(currStart)) {
                // Validação extra para não permitir restaurar lixo acima do limite no recálculo
                const cParts = currStart.split(':');
                if (cParts.length === 2) {
                    const cMins = parseInt(cParts[0], 10) * 60 + parseInt(cParts[1], 10);
                    if (cMins <= limiteMaximoInicio) {
                        actualOpts.push(currStart);
                    }
                }
            }
            actualOpts.sort();
            
            const startOptsHtml = ['<option value="">--:--</option>'];
            actualOpts.forEach(val => startOptsHtml.push(`<option value="${val}">${val}</option>`));
            
            f.start.innerHTML = startOptsHtml.join('');
            f.start.value = currStart || '';

            updateAgendaEndOptions(f, currentLineTcValue);

            if (!f.start.hasAttribute('data-bound-end-update')) {
                f.start.addEventListener('change', () => {
                    // Recalcula qual é o TC atual na hora do change (caso o usuário tenha mudado depois)
                    let runtimeTcValue = parseInt(document.getElementById('profTempoConsulta').value, 10) || tcValue;
                    if (f.slot && f.slot.value) {
                        const parsedRuntimeSlot = parseInt(f.slot.value, 10);
                        if (!isNaN(parsedRuntimeSlot) && parsedRuntimeSlot > 0) {
                            runtimeTcValue = parsedRuntimeSlot;
                        }
                    }
                    
                    // Limpa a memória do campo de Fim para forçar o recálculo a partir do novo Início selecionado
                    if (f.end) {
                        f.end.removeAttribute('data-curr-end');
                        f.end.value = '';
                    }
                    updateAgendaEndOptions(f, runtimeTcValue);
                });
                f.start.setAttribute('data-bound-end-update', 'true');
            }
        }
    });
}

function resetAgendaForm() {
    agendaFields.forEach(f => {
        if (f.enabled) f.enabled.checked = false;
        if (f.start) { f.start.value = ''; f.start.disabled = true; }
        if (f.end) { f.end.value = ''; f.end.disabled = true; }
        if (f.slot) { f.slot.value = ''; f.slot.disabled = true; }
    });
    updateAgendaSteps();
}

function attachAgendaListeners() {
    const tcInput = document.getElementById('profTempoConsulta');
    if (tcInput) {
        tcInput.addEventListener('input', updateAgendaSteps);
        tcInput.addEventListener('change', updateAgendaSteps);
    }
    agendaFields.forEach(f => {
        if (!f.enabled) return;
        f.enabled.addEventListener('change', () => {
            const on = Boolean(f.enabled.checked);
            if (f.start) f.start.disabled = !on;
            if (f.end) f.end.disabled = !on;
            if (f.slot) f.slot.disabled = !on;
            
            if (!on) {
                if (f.start) f.start.value = '';
                if (f.end) f.end.value = '';
                if (f.slot) f.slot.value = '';
            }
        });
        
        // Listener no INTERVALO (MIN) da linha para forçar o recálculo dos horários DESSA linha
        if (f.slot && !f.slot.hasAttribute('data-bound-slot-update')) {
            f.slot.addEventListener('change', () => {
                // Apenas refazemos os steps gerais (a função updateAgendaSteps já lê o slot individual de cada linha)
                updateAgendaSteps();
            });
            f.slot.setAttribute('data-bound-slot-update', 'true');
        }
    });
}

function renderAgendaPlaceholder(msg = 'Selecione a data e o profissional.') {
    if (agendaSlotsBody) {
        agendaSlotsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">${msg}</td></tr>`;
    }
    if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
    if (agendaSummary) agendaSummary.textContent = '—';
}

function jsDayToAgendaDiaSemana(jsDay) {
    if (jsDay === 0) return 7;
    return jsDay;
}

async function fetchAgendaForUI() {
    if (!agendaProfessional || !agendaDate) return;
    const profSeqId = agendaProfessional.value;
    const dateStr = agendaDate.value;
    if (!profSeqId || !dateStr) {
        renderAgendaPlaceholder();
        return;
    }
    await fetchAgendaDay({ empresaId: currentEmpresaId, profSeqId: Number(profSeqId), dateStr });
}

async function fetchAgendaDay({ empresaId, profSeqId, dateStr }) {
    try {
        if (!empresaId) {
            renderAgendaPlaceholder('Empresa não definida.');
            return;
        }
        if (agendaSlotsBody) {
            agendaSlotsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
        
        const warningMsgEl = document.getElementById('agendaWarningMsg');
        if (warningMsgEl) warningMsgEl.style.display = 'none';
        if (btnAgendaNew) btnAgendaNew.disabled = true;

        const parts = dateStr.split('-');
        const jsDay = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
        const diaSemana = jsDayToAgendaDiaSemana(jsDay);

        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .lt('inicio', endIso)
            .gt('fim', startIso)
            .order('inicio', { ascending: true });
        const { data: ags, error: agErr } = await withTimeout(agQ, 15000, 'agenda_agendamentos');
        if (agErr) throw agErr;
        
        currentAgendaAgendamentos = ags || [];

        const allDispQ = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('ativo', true);
        const { data: allDisp, error: dispErr } = await withTimeout(allDispQ, 15000, 'agenda_disponibilidade_all');
        if (dispErr) throw dispErr;

        const disp = (allDisp || []).filter(d => String(d.dia_semana) === String(diaSemana));

        if (!disp || disp.length === 0) {
            if (btnAgendaNew) btnAgendaNew.disabled = true;
            if (warningMsgEl) {
                const mapDias = {1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado', 7: 'Domingo'};
                const diasTexto = (allDisp || []).map(d => `${mapDias[d.dia_semana]} de ${d.hora_inicio} às ${d.hora_fim}`).join(', ');
                warningMsgEl.innerHTML = `Profissional não atende neste dia da semana. Atendimentos apenas às: ${diasTexto || 'Nenhum dia cadastrado'}`;
                warningMsgEl.style.display = 'block';
            }
            renderAgendaAppointmentsOnly({ dateStr, profSeqId, agendamentos: ags || [] });
            return;
        }

        if (btnAgendaNew) btnAgendaNew.disabled = false;
        if (warningMsgEl) warningMsgEl.style.display = 'none';

        renderAgendaSlots({ dateStr, profSeqId, disponibilidade: disp, agendamentos: ags || [] });
    } catch (err) {
        console.error('Erro ao carregar agenda:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        renderAgendaPlaceholder(`Falha ao carregar Agenda (${code}).`);
        showToast(`Erro ao carregar Agenda (${code}): ${msg}`, true);
    }
}

function renderAgendaAppointmentsOnly({ dateStr, profSeqId, agendamentos }) {
    if (!agendaSlotsBody) return;
    const list = (Array.isArray(agendamentos) ? agendamentos : []).slice().sort((a, b) => {
        const da = new Date(a && a.inicio || 0).getTime();
        const dbt = new Date(b && b.inicio || 0).getTime();
        return da - dbt;
    });
    const profName = getProfessionalNameBySeqId(profSeqId);
    if (agendaSummary) agendaSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')} — Sem disponibilidade cadastrada.`;
    agendaSlotsBody.innerHTML = '';
    if (!list.length) {
        if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
        return;
    }
    if (agendaEmptyState) agendaEmptyState.classList.add('hidden');
    list.forEach(a => {
        const start = new Date(a.inicio);
        const t = Number.isFinite(start.getTime()) ? formatTimeHHMM(start) : '—';
        const pacienteNome = getPacienteNameBySeqId(a.paciente_id) || (a.titulo || '-');
        const status = String(a.status || 'MARCADO');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${t}</td>
            <td>${pacienteNome || '-'}</td>
            <td>${status}</td>
            <td><button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button></td>
        `;
        agendaSlotsBody.appendChild(tr);
    });
    agendaSlotsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const a = (agendamentos || []).find(x => String(x.id) === String(id));
            if (a) openAgendaModalEdit(a);
        });
    });
}

function renderAgendaSlots({ dateStr, profSeqId, disponibilidade, agendamentos }) {
    if (!agendaSlotsBody) return;

    const slots = [];
    disponibilidade.forEach(d => {
        const startM = parseTimeToMinutes(d.hora_inicio);
        const endM = parseTimeToMinutes(d.hora_fim);
        const prof = professionals.find(p => String(p.seqid) === String(profSeqId));
        const step = prof && prof.tempo_consulta ? parseInt(prof.tempo_consulta, 10) : Number(d.slot_minutos || 30);
        if (startM == null || endM == null || !step) return;

        for (let m = startM; m + step <= endM; m += step) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            slots.push({ time: `${hh}:${mm}`, step });
        }
    });

    if (!slots.length) {
        agendaSlotsBody.innerHTML = '';
        if (agendaEmptyState) agendaEmptyState.classList.remove('hidden');
        if (agendaSummary) agendaSummary.textContent = 'Sem slots para este dia.';
        return;
    }

    const byStart = new Map();
    (agendamentos || []).forEach(a => {
        const start = new Date(a.inicio);
        const key = formatTimeHHMM(start);
        if (!byStart.has(key)) byStart.set(key, a);
    });

    const profName = getProfessionalNameBySeqId(profSeqId);
    if (agendaSummary) agendaSummary.textContent = `${profName} — ${dateStr.split('-').reverse().join('/')}`;

    agendaSlotsBody.innerHTML = '';
    slots.sort((a, b) => a.time.localeCompare(b.time)).forEach(s => {
        const a = byStart.get(s.time);
        const pacienteNome = a ? (getPacienteNameBySeqId(a.paciente_id) || (a.titulo || '')) : '';
        const status = a ? String(a.status || 'MARCADO') : 'LIVRE';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${s.time}</td>
            <td>${a ? (pacienteNome || a.titulo || '-') : '-'}</td>
            <td>${status}</td>
            <td>
                ${a ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}"><i class="ri-edit-line"></i> Editar</button>` :
            `<button class="btn btn-primary btn-sm" data-action="new" data-time="${s.time}" data-step="${s.step}"><i class="ri-add-line"></i> Agendar</button>`}
            </td>
        `;
        agendaSlotsBody.appendChild(tr);
    });

    agendaSlotsBody.querySelectorAll('button[data-action="new"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const time = btn.getAttribute('data-time');
            const step = parseInt(btn.getAttribute('data-step') || '30', 10);
            openAgendaModalNew({ dateStr, time, step, profSeqId });
        });
    });
    agendaSlotsBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const a = (agendamentos || []).find(x => String(x.id) === String(id));
            if (a) openAgendaModalEdit(a);
        });
    });
}

function populateAgendaModalTimeOptions(fStart, fEnd, startMinsBase, tcValue, selectedStart, selectedEnd, dayConfigMaxMins = null) {
    if (!fStart || !fEnd) return;

    // Zera os combos logo de cara para garantir que não haja lixo visual de datas anteriores
    fStart.innerHTML = '';
    fEnd.innerHTML = '';

    // Use dayConfigMaxMins se existir (Hora_Fim estipulada na agenda_disponibilidade ou pela empresa), senão cai pro fallback de meia-noite (1440)
    const limitMins = dayConfigMaxMins ? dayConfigMaxMins : 1440;
    
    // A pedido do usuário: A Regra Matemática Obrigatória: última opção do combo FIM = Horário fim da empresa - Intervalo do Profissional.
    const maxEndMins = limitMins - tcValue;
    
    // A última hora de INÍCIO possível é a hora fim máxima permitida - tempo de consulta
    let maxStartMins = maxEndMins - tcValue;
    if (maxStartMins < startMinsBase) {
        maxStartMins = startMinsBase;
    }

    const startOpts = ['<option value="">--:--</option>'];
    
    // Objeto Set para garantir unicidade e facilitar a ordenação se inserirmos selectedStart manualmente
    const addedStartOpts = new Set();
    
    for (let m = startMinsBase; m <= maxStartMins; m += tcValue) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const val = `${hh}:${mm}`;
        addedStartOpts.add(val);
    }
    
    // Se selectedStart foi passado, verificamos se ele deve ser forçado
    if (selectedStart) {
        const sParts = selectedStart.split(':');
        if (sParts.length === 2) {
            const sMins = parseInt(sParts[0], 10) * 60 + parseInt(sParts[1], 10);
            // Só força a entrada se estiver dentro dos limites do dia, OU se for modo de edição (tem ID)
            const isEditMode = document.getElementById('agendaId') && document.getElementById('agendaId').value !== '';
            if (isEditMode || (sMins >= startMinsBase && sMins <= maxStartMins)) {
                addedStartOpts.add(selectedStart);
            } else {
                // Se for fora dos limites e não for edição, ignoramos o selectedStart antigo (ex: ao trocar de dia)
                selectedStart = null; 
            }
        }
    }
    
    // Converte o Set para Array, ordena e adiciona ao HTML
    Array.from(addedStartOpts).sort().forEach(val => {
        startOpts.push(`<option value="${val}">${val}</option>`);
    });
    
    fStart.innerHTML = startOpts.join('');
    if (selectedStart) fStart.value = selectedStart;

    const updateEnd = () => {
        // Zera o innerHTML primeiro para garantir que opções antigas não fiquem presas
        fEnd.innerHTML = '';
        if (!fStart.value) {
            fEnd.innerHTML = '<option value="">--:--</option>';
            return;
        }
        const parts = fStart.value.split(':');
        const sMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const firstEndMins = sMins + tcValue;
        
        const endOpts = ['<option value="">--:--</option>'];
        for (let m = firstEndMins; m <= maxEndMins; m += tcValue) {
            const hh = String(Math.floor(m / 60)).padStart(2, '0');
            const mm = String(m % 60).padStart(2, '0');
            endOpts.push(`<option value="${hh}:${mm}">${hh}:${mm}</option>`);
        }
        
        // Em casos de selectedEnd pré-existente ou em edição (onde selectedEnd não bate com os múltiplos de tcValue)
        if (selectedEnd && !endOpts.some(opt => opt.includes(`value="${selectedEnd}"`))) {
            const eParts = selectedEnd.split(':');
            if (eParts.length === 2) {
                const eMins = parseInt(eParts[0], 10) * 60 + parseInt(eParts[1], 10);
                const isEditMode = document.getElementById('agendaId') && document.getElementById('agendaId').value !== '';
                // Se estiver dentro dos limites OU for edição, adicionamos à lista
                if (isEditMode || (eMins >= firstEndMins && eMins <= maxEndMins)) {
                    endOpts.push(`<option value="${selectedEnd}">${selectedEnd}</option>`);
                }
            }
        }
        
        // Ordenamos os endOpts (tirando o '--:--' que é o primeiro) para não ficar fora de ordem
        const defaultOpt = endOpts.shift();
        endOpts.sort((a, b) => {
            const valA = a.match(/value="([^"]+)"/)[1];
            const valB = b.match(/value="([^"]+)"/)[1];
            return valA.localeCompare(valB);
        });
        endOpts.unshift(defaultOpt);

        fEnd.innerHTML = endOpts.join('');
        
        const ehh = String(Math.floor(firstEndMins / 60)).padStart(2, '0');
        const emm = String(firstEndMins % 60).padStart(2, '0');
        const defaultCalculatedEnd = `${ehh}:${emm}`;
        
        // Verifica se a opção default calculada existe no select antes de ativá-la
        if (endOpts.some(opt => opt.includes(`value="${defaultCalculatedEnd}"`))) {
            fEnd.value = defaultCalculatedEnd;
        } else {
            fEnd.value = '';
        }
    };

    fStart.onchange = updateEnd;
    
    updateEnd();
    if (selectedEnd) {
        // If an explicit end was passed (e.g. edit mode), try to select it
        const hasOpt = Array.from(fEnd.options).some(o => o.value === selectedEnd);
        if (hasOpt) fEnd.value = selectedEnd;
    }
}

async function openAgendaModalNew({ dateStr, time, step, profSeqId }) {
    if (!modalAgenda) return;
    if (modalAgendaTitle) modalAgendaTitle.textContent = 'Novo Agendamento';
    if (agendaId) agendaId.value = '';
    if (btnAgendaDelete) btnAgendaDelete.classList.add('hidden');
    if (agendaPacienteBusca) agendaPacienteBusca.value = '';
    if (agendaPacienteDropdown) agendaPacienteDropdown.style.display = 'none';
    if (cadastroExpressoContainer) cadastroExpressoContainer.style.display = 'none';
    if (agendaPaciente) agendaPaciente.value = '';
    if (agendaTitulo) agendaTitulo.value = 'Consulta';
    if (agendaObs) agendaObs.value = '';
    if (agendaStatus) agendaStatus.value = 'MARCADO';

    if (agendaDataInput) agendaDataInput.value = dateStr;

    const parts = dateStr.split('-');
    const yyyy = parseInt(parts[0], 10);
    const MM = parseInt(parts[1], 10) - 1;
    const dd = parseInt(parts[2], 10);
    
    const now = new Date();
    const isToday = (now.getFullYear() === yyyy && now.getMonth() === MM && now.getDate() === dd);
    
    let startMinsBase = 480; // fallback
    const dObj = new Date(yyyy, MM, dd);
    const dayOfWeek = dObj.getDay(); // 0=Dom, 1=Seg...
    
    console.log('--- DEBUG MODAL AGENDAMENTO ---');
    console.log('Data detectada:', dateStr);
    console.log('Dia da semana JS (0=Dom, 5=Sex):', dayOfWeek);
    
    // Find prof schedule for this day
    let tcValue = step; // fallback
    let dayConfig = null;
    
    const dbDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    console.log('Dia da semana mapeado para o banco (1=Seg, 7=Dom):', dbDay);
    
    console.log('--- DIAGNÓSTICO CRÍTICO DE MEMÓRIA ---');
    console.log('O que tem dentro de profSeqId atualmente?:', profSeqId);
    console.log('O array currentAgendaDisponibilidade tem quantas linhas?:', typeof currentAgendaDisponibilidade !== 'undefined' && currentAgendaDisponibilidade ? currentAgendaDisponibilidade.length : 'Não existe');
    console.log('Conteúdo COMPLETO do array currentAgendaDisponibilidade:', typeof currentAgendaDisponibilidade !== 'undefined' ? currentAgendaDisponibilidade : null);
    
    // Try to get from loaded availability or DB if possible.
    if (typeof currentAgendaDisponibilidade !== 'undefined' && Array.isArray(currentAgendaDisponibilidade) && currentAgendaDisponibilidade.length > 0) {
        dayConfig = currentAgendaDisponibilidade.find(x => 
            String(x.dia_semana) === String(dbDay) && 
            String(x.profissional_id) === String(profSeqId)
        );
    } else {
        // Fallback robusto: buscar direto no banco
        try {
            const { data } = await db.from('agenda_disponibilidade')
                .select('*')
                .eq('empresa_id', currentEmpresaId)
                .eq('profissional_id', profSeqId)
                .eq('dia_semana', dbDay)
                .eq('ativo', true)
                .maybeSingle();
            
            if (data) {
                dayConfig = data;
            }
        } catch (err) {
            console.error('Erro ao buscar disponibilidade no banco:', err);
        }
    }
    
    console.log('Dados de disponibilidade recuperados para este dia:', dayConfig);
    
    if (dayConfig && dayConfig.slot_minutos) {
        tcValue = parseInt(dayConfig.slot_minutos, 10);
    } else {
        const prof = professionals.find(p => String(p.seqid) === String(profSeqId));
        if (prof && prof.tempo_consulta) tcValue = parseInt(prof.tempo_consulta, 10);
    }
    
    console.log('Intervalo (Step) que será aplicado no loop:', tcValue);
    
    if (dayConfig && dayConfig.hora_inicio) {
        const parts = dayConfig.hora_inicio.split(':');
        startMinsBase = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } else {
        // Fallback to company hours
        const limits = getDayLimits(dbDay);
        startMinsBase = limits.start;
    }

    const limitsNew = getDayLimits(dbDay);
    let companyEndMinsNew = limitsNew.end;
    let limitMins = companyEndMinsNew; 

    if (dayConfig && dayConfig.hora_fim) {
        const parts = dayConfig.hora_fim.split(':');
        const profEndMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        limitMins = Math.min(companyEndMinsNew, profEndMins);
    }

    if (isToday) {
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (currentMins > startMinsBase) {
            startMinsBase = Math.ceil((currentMins + 1) / tcValue) * tcValue;
        }
    }

    populateAgendaModalTimeOptions(agendaInicio, agendaFim, startMinsBase, tcValue, time, null, limitMins);

    // Listen to date changes
    if (agendaDataInput) {
        agendaDataInput.addEventListener('change', async () => {
            const dateStr = agendaDataInput.value;
            if (!dateStr) return;
            const profSeqId = agendaProfessional ? agendaProfessional.value : null;
            if (!profSeqId) return;

            const selectedStart = agendaInicio.value;
            const selectedEnd = agendaFim.value;

            const dateParts = dateStr.split('-');
            const y = parseInt(dateParts[0], 10);
            const m = parseInt(dateParts[1], 10) - 1;
            const d = parseInt(dateParts[2], 10);
            const dObj = new Date(y, m, d);
            const dayOfWeek = dObj.getDay();
            const dbDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            
            console.log('--- DEBUG MODAL AGENDAMENTO (CHANGE DATA) ---');
            console.log('Data detectada:', dateStr);
            console.log('Dia mapeado para o banco:', dbDay);
            
            let tcValue = 30;
            let startMinsBase = 480;
            let limitMinsChange = 1440;

            const prof = professionals.find(p => String(p.seqid) === String(profSeqId));
            if (prof && prof.tempo_consulta) tcValue = parseInt(prof.tempo_consulta, 10);

            let dayConfig = null;

            console.log('--- DIAGNÓSTICO CRÍTICO DE MEMÓRIA ---');
            console.log('O que tem dentro de profSeqId atualmente?:', profSeqId);
            console.log('O array currentAgendaDisponibilidade tem quantas linhas?:', typeof currentAgendaDisponibilidade !== 'undefined' && currentAgendaDisponibilidade ? currentAgendaDisponibilidade.length : 'Não existe');
            console.log('Conteúdo COMPLETO do array currentAgendaDisponibilidade:', typeof currentAgendaDisponibilidade !== 'undefined' ? currentAgendaDisponibilidade : null);

            if (typeof currentAgendaDisponibilidade !== 'undefined' && Array.isArray(currentAgendaDisponibilidade) && currentAgendaDisponibilidade.length > 0) {
                dayConfig = currentAgendaDisponibilidade.find(x => 
                    String(x.dia_semana) === String(dbDay) && 
                    String(x.profissional_id) === String(profSeqId)
                );
            } else {
                // Fallback robusto: buscar direto no banco
                try {
                    const { data } = await db.from('agenda_disponibilidade')
                        .select('*')
                        .eq('empresa_id', currentEmpresaId)
                        .eq('profissional_id', profSeqId)
                        .eq('dia_semana', dbDay)
                        .eq('ativo', true)
                        .maybeSingle();

                    if (data) {
                        dayConfig = data;
                    }
                } catch (err) {
                    console.error('Erro ao buscar disponibilidade no banco:', err);
                }
            }
            
            console.log('Dados de disponibilidade recuperados para este dia:', dayConfig);

            if (dayConfig && dayConfig.slot_minutos) {
                tcValue = parseInt(dayConfig.slot_minutos, 10);
            }
            
            console.log('Intervalo (Step) que será aplicado no loop:', tcValue);
            
            if (dayConfig && dayConfig.hora_inicio) {
                const parts = dayConfig.hora_inicio.split(':');
                startMinsBase = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            } else {
                const limits = getDayLimits(dbDay);
                startMinsBase = limits.start;
            }
            
            const limitsNewListener = getDayLimits(dbDay);
            let companyEndMinsNewListener = limitsNewListener.end;
            limitMinsChange = companyEndMinsNewListener;
            
            if (dayConfig && dayConfig.hora_fim) {
                const parts = dayConfig.hora_fim.split(':');
                const profEndMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                limitMinsChange = Math.min(companyEndMinsNewListener, profEndMins);
            }

            const parts = dateStr.split('-');
            const now = new Date();
            const isToday = (now.getFullYear() === parseInt(parts[0], 10) && now.getMonth() === parseInt(parts[1], 10) - 1 && now.getDate() === parseInt(parts[2], 10));
            if (isToday) {
                const currentMins = now.getHours() * 60 + now.getMinutes();
                if (currentMins > startMinsBase) {
                    startMinsBase = Math.ceil((currentMins + 1) / tcValue) * tcValue;
                }
            }

            populateAgendaModalTimeOptions(agendaInicio, agendaFim, startMinsBase, tcValue, null, null, limitMinsChange);
        });
    }

    modalAgenda.classList.remove('hidden');
}

function openAgendaModalEdit(a) {
    if (!modalAgenda) return;
    if (modalAgendaTitle) modalAgendaTitle.textContent = 'Editar Agendamento';
    if (agendaId) agendaId.value = a.id;
    if (btnAgendaDelete) btnAgendaDelete.classList.remove('hidden');
    if (agendaPacienteBusca) {
        if (a.paciente_id) {
            const p = (patients || []).find(x => String(x.seqid) === String(a.paciente_id));
            agendaPacienteBusca.value = p ? p.nome : '';
        } else {
            agendaPacienteBusca.value = '';
        }
    }
    if (agendaPacienteDropdown) agendaPacienteDropdown.style.display = 'none';
    if (cadastroExpressoContainer) cadastroExpressoContainer.style.display = 'none';
    if (agendaPaciente) agendaPaciente.value = a.paciente_id ? String(a.paciente_id) : '';
    if (agendaTitulo) agendaTitulo.value = a.titulo || '';
    if (agendaObs) agendaObs.value = a.observacoes || '';
    if (agendaStatus) agendaStatus.value = a.status || 'MARCADO';
    
    const startDt = new Date(a.inicio);
    const endDt = new Date(a.fim);
    
    const yyyy = startDt.getFullYear();
    const mm = String(startDt.getMonth() + 1).padStart(2, '0');
    const dd = String(startDt.getDate()).padStart(2, '0');
    if (agendaDataInput) agendaDataInput.value = `${yyyy}-${mm}-${dd}`;
    
    const startH = String(startDt.getHours()).padStart(2, '0');
    const startM = String(startDt.getMinutes()).padStart(2, '0');
    const endH = String(endDt.getHours()).padStart(2, '0');
    const endM = String(endDt.getMinutes()).padStart(2, '0');
    
    const prof = professionals.find(p => String(p.seqid) === String(a.profissional_id));
    const step = prof && prof.tempo_consulta ? parseInt(prof.tempo_consulta, 10) : 30;

    // Detect day of week and limits for edit mode
    const dObj = new Date(yyyy, startDt.getMonth(), parseInt(dd, 10));
    const dayOfWeek = dObj.getDay();
    const dbDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const limits = getDayLimits(dbDay);
    const limitMinsEdit = limits.end;

    // For edit mode, we allow all times from 06:00 (360 mins) to make sure the saved time is listed
    populateAgendaModalTimeOptions(agendaInicio, agendaFim, 360, step, `${startH}:${startM}`, `${endH}:${endM}`, limitMinsEdit);

    modalAgenda.classList.remove('hidden');
}

function closeAgendaModal() {
    if (modalAgenda) modalAgenda.classList.add('hidden');
}

async function saveAgendaFromModal() {
    if (!agendaProfessional || !agendaDate) return;
    const profSeqId = agendaProfessional.value;
    if (!profSeqId) { showToast('Selecione o profissional.', true); return; }
    
    const id = agendaId ? agendaId.value : '';
    const dateVal = agendaDataInput ? agendaDataInput.value : '';
    const inicioTime = agendaInicio ? agendaInicio.value : '';
    const fimTime = agendaFim ? agendaFim.value : '';
    
    if (!dateVal || !inicioTime || !fimTime) { showToast('Informe a data, horário de início e fim.', true); return; }

    const inicioIso = new Date(`${dateVal}T${inicioTime}:00`).toISOString();
    const fimIso = new Date(`${dateVal}T${fimTime}:00`).toISOString();
    if (fimIso <= inicioIso) { showToast('Fim deve ser maior que início.', true); return; }

    const pacienteIdVal = agendaPaciente && agendaPaciente.value ? Number(agendaPaciente.value) : null;
    const tituloVal = agendaTitulo ? agendaTitulo.value : '';

    if (!pacienteIdVal) {
        showToast('É obrigatório selecionar ou cadastrar um paciente.', true);
        if (agendaPacienteBusca) agendaPacienteBusca.focus();
        return;
    }
    
    if (!tituloVal) {
        showToast('É obrigatório selecionar um Título para o agendamento.', true);
        if (agendaTitulo) agendaTitulo.focus();
        return;
    }

    const payload = {
        empresa_id: currentEmpresaId,
        profissional_id: Number(profSeqId),
        paciente_id: pacienteIdVal,
        inicio: inicioIso,
        fim: fimIso,
        status: agendaStatus ? agendaStatus.value : 'MARCADO',
        titulo: tituloVal,
        observacoes: agendaObs ? agendaObs.value : null,
        criado_por: currentUser?.id || null,
        updated_at: new Date().toISOString()
    };

    try {
        if (id) {
            const { error } = await withTimeout(db.from('agenda_agendamentos').update(payload).eq('id', id).eq('empresa_id', currentEmpresaId), 15000, 'agenda_agendamentos:update');
            if (error) throw error;
            showToast('Agendamento atualizado.');
        } else {
            const { error } = await withTimeout(db.from('agenda_agendamentos').insert(payload), 15000, 'agenda_agendamentos:insert');
            if (error) throw error;
            showToast('Agendamento criado.');
        }
        closeAgendaModal();
        await fetchAgendaForUI();
    } catch (err) {
        console.error('Erro ao salvar agendamento:', err);
        const code = err && err.code ? err.code : '-';
        const msg = err && err.message ? err.message : 'Erro desconhecido';
        showToast(`Erro ao salvar agendamento (${code}): ${msg}`, true);
    }
}

async function deleteAgendaFromModal() {
    const id = agendaId ? agendaId.value : '';
    if (!id) return;
    if (!confirm('Excluir este agendamento?')) return;
    try {
        const { error } = await withTimeout(db.from('agenda_agendamentos').delete().eq('id', id).eq('empresa_id', currentEmpresaId), 15000, 'agenda_agendamentos:delete');
        if (error) throw error;
        showToast('Agendamento excluído.');
        closeAgendaModal();
        await fetchAgendaForUI();
    } catch (err) {
        console.error('Erro ao excluir agendamento:', err);
        showToast('Erro ao excluir agendamento.', true);
    }
}

async function loadAgendaDisponibilidade(profSeqId, empresaId, prof = null) {
    try {
        resetAgendaForm();
        if (!profSeqId || !empresaId) return;

        const q = db.from('agenda_disponibilidade')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId))
            .eq('ativo', true);

        const { data, error } = await withTimeout(q, 15000, 'agenda_disponibilidade');
        if (error) throw error;

        const byDay = new Map();
        (data || []).forEach(r => {
            const d = Number(r.dia_semana);
            if (!byDay.has(d)) byDay.set(d, r);
        });

        agendaFields.forEach(f => {
            const r = byDay.get(f.day);
            if (!r || !f.enabled) return;
            
            console.log('Dados da agenda sendo renderizados:', {
                dia: f.day,
                inicio: r.hora_inicio,
                fim: r.hora_fim,
                slot: r.slot_minutos
            });
            
            f.enabled.checked = true;
            if (f.start) {
                const startVal = String(r.hora_inicio || '').slice(0, 5);
                f.start.setAttribute('data-curr-start', startVal);
                if (startVal && !Array.from(f.start.options).some(o => o.value === startVal)) {
                    f.start.insertAdjacentHTML('beforeend', `<option value="${startVal}">${startVal}</option>`);
                }
                f.start.value = startVal;
            }
            if (f.end) {
                const endVal = String(r.hora_fim || '').slice(0, 5);
                f.end.setAttribute('data-curr-end', endVal);
                if (endVal && !Array.from(f.end.options).some(o => o.value === endVal)) {
                    f.end.insertAdjacentHTML('beforeend', `<option value="${endVal}">${endVal}</option>`);
                }
                f.end.value = endVal;
            }
            if (f.slot) {
                // If there's a specific slot for this day, use it. Otherwise set to empty string ("Padrão")
                const slotVal = r.slot_minutos ? String(r.slot_minutos) : '';
                if (slotVal && !Array.from(f.slot.options).some(o => o.value === slotVal)) {
                    f.slot.insertAdjacentHTML('beforeend', `<option value="${slotVal}">${slotVal}</option>`);
                }
                f.slot.value = slotVal;
            }
            if (f.start) f.start.disabled = false;
            if (f.end) f.end.disabled = false;
            if (f.slot) f.slot.disabled = false;
        });

        const tcInput = document.getElementById('profTempoConsulta');
        if (tcInput && prof) {
            const p = prof;
            const tcValStr = String(p.tempo_consulta || 30);
            if (tcInput.tagName === 'SELECT' && !Array.from(tcInput.options).some(o => o.value === tcValStr)) {
                tcInput.insertAdjacentHTML('beforeend', `<option value="${tcValStr}">${tcValStr}</option>`);
            }
            tcInput.value = tcValStr;
        }

        // Força a regeneração visual dos comboboxes da agenda para refletir o banco
        if (typeof updateAgendaSteps === 'function') updateAgendaSteps();
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        console.warn('Agenda indisponível:', msg);
        if (agendaCard) {
            showToast('Agenda ainda não habilitada. Execute o SQL da agenda no Supabase.', true);
        }
    }
}

function buildAgendaPayload(empresaId, profSeqId) {
    const rows = [];
    const errors = [];

    const tcInput = document.getElementById('profTempoConsulta');
    const defaultTcValue = tcInput && tcInput.value ? parseInt(tcInput.value, 10) : 30;

    agendaFields.forEach(f => {
        if (!f.enabled || !f.enabled.checked) return;
        const start = f.start ? String(f.start.value || '') : '';
        const end = f.end ? String(f.end.value || '') : '';
        
        // Verifica se o slot está definido e não é o valor "Padrão" vazio, caso contrário envia nulo (para que seja interpretado corretamente se quiser) ou fallback
        let slot = defaultTcValue; // Fallback hardcoded: envia o tcValue mestre para o banco.
        if (f.slot && f.slot.value && f.slot.value.trim() !== '') {
            const parsed = parseInt(f.slot.value, 10);
            if (!isNaN(parsed)) {
                slot = parsed;
            }
        }

        console.log('Salvando dia', f.day, 'start:', start, 'end:', end, 'slot:', slot);

        if (!start || !end) {
            errors.push(`Dia ${f.day}: informe início e fim.`);
            return;
        }
        if (end <= start) {
            if (timeToMins(end) <= timeToMins(start)) {
                errors.push(`Dia ${f.day}: horário final deve ser maior que o inicial.`);
                return;
            }
        }

        rows.push({
            empresa_id: empresaId,
            profissional_id: Number(profSeqId),
            dia_semana: f.day,
            hora_inicio: start,
            hora_fim: end,
            slot_minutos: slot,
            ativo: true,
            updated_at: new Date().toISOString()
        });
    });

    return { rows, errors };
}

async function saveAgendaDisponibilidade(profSeqId, empresaId) {
    console.log('Iniciando saveAgendaDisponibilidade para prof:', profSeqId, 'empresa:', empresaId);
    const { rows, errors } = buildAgendaPayload(empresaId, profSeqId);
    console.log('Payload construído. Linhas:', rows.length, 'Erros:', errors.length);
    if (errors.length) {
        showToast(errors[0], true);
        return false;
    }

    try {
        console.log('Iniciando delete da agenda anterior...');
        const del = db.from('agenda_disponibilidade')
            .delete()
            .eq('empresa_id', empresaId)
            .eq('profissional_id', Number(profSeqId));
        const { error: delError } = await withTimeout(del, 15000, 'agenda_disponibilidade:delete');
        if (delError) {
            console.error('Falha no delete:', delError);
            throw delError;
        }

        if (rows.length) {
            console.log('Iniciando insert de', rows.length, 'linhas:', JSON.stringify(rows));
            const { data, error: insError } = await withTimeout(db.from('agenda_disponibilidade').insert(rows).select(), 15000, 'agenda_disponibilidade:insert');
            if (insError) {
                console.error('Falha no insert:', insError);
                throw insError;
            }
            console.log('Insert realizado com sucesso. Dados retornados:', data);
        } else {
            console.log('Nenhuma linha para inserir (agenda totalmente desmarcada).');
        }

        return true;
    } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        console.error('Erro ao salvar agenda:', msg);
        showToast('Erro ao salvar agenda. Verifique se o SQL da agenda foi aplicado.', true);
        return false;
    }
}
function findNextAvailableAgendaSlotTime(dateStr, stepMins = 30) {
    const now = new Date();
    const parts = dateStr.split('-');
    const yyyy = parseInt(parts[0], 10);
    const MM = parseInt(parts[1], 10) - 1;
    const dd = parseInt(parts[2], 10);
    
    const isToday = (now.getFullYear() === yyyy && now.getMonth() === MM && now.getDate() === dd);
    let nextSlotTime;
    
    if (isToday) {
        nextSlotTime = new Date(yyyy, MM, dd, now.getHours(), now.getMinutes(), 0, 0);
    } else {
        nextSlotTime = new Date(yyyy, MM, dd, 8, 0, 0, 0);
    }

    let m = nextSlotTime.getMinutes();
    let rem = m % stepMins;
    if (rem > 0) {
        nextSlotTime.setMinutes(m + (stepMins - rem));
    }

    const msPerStep = stepMins * 60 * 1000;
    const MAX_ITERATIONS = 48;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        const slotEnd = new Date(nextSlotTime.getTime() + msPerStep);
        
        const isOverlapping = currentAgendaAgendamentos.some(ag => {
            if (ag.status === 'CANCELADO') return false;
            const agStart = new Date(ag.inicio);
            const agEnd = new Date(ag.fim);
            return nextSlotTime < agEnd && slotEnd > agStart;
        });

        if (!isOverlapping) {
            break;
        }
        
        nextSlotTime = new Date(nextSlotTime.getTime() + msPerStep);
        iterations++;
    }

    const hh = String(nextSlotTime.getHours()).padStart(2, '0');
    const mm = String(nextSlotTime.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}
window.attachAgendaListeners = attachAgendaListeners;
window.resetAgendaForm = resetAgendaForm;

window.closeAgendaModal = closeAgendaModal;
window.saveAgendaFromModal = saveAgendaFromModal;
window.deleteAgendaFromModal = deleteAgendaFromModal;
window.findNextAvailableAgendaSlotTime = findNextAvailableAgendaSlotTime;
window.openAgendaModalNew = openAgendaModalNew;
