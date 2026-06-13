
const navConsultaAvaliacao = document.getElementById('navConsultaAvaliacao');
const consultaAvaliacaoView = document.getElementById('consultaAvaliacaoView');
const consultaProfessionalGroup = document.getElementById('consultaProfessionalGroup');

// Consulta/Avaliação DOM Elements
const consultaDate = document.getElementById('consultaDate');
const consultaProfessional = document.getElementById('consultaProfessional');
const btnConsultaRefresh = document.getElementById('btnConsultaRefresh');
const consultaEmptyState = document.getElementById('consultaEmptyState'); 

function liberarFila() { 
    // Reabilita todos os botões que não foram finalizados 
    const todosBotoes = document.querySelectorAll('.btn-copiar'); 
    todosBotoes.forEach(btn => { 
        // Só libera se não tiver sido marcado como enviado 
        if (!btn.classList.contains('finalizado')) { 
            btn.disabled = false; 
            btn.style.opacity = "1"; 
            btn.style.cursor = "pointer";
        } 
    }); 
}

async function fetchConsultaAvaliacaoForUI() {
    if (!consultaDate || !consultaProfessional) return;
    const dateStr = consultaDate.value;
    const profSeqId = consultaProfessional.value;
    if (!dateStr || !profSeqId) {
        if (consultaPacientesTableBody) consultaPacientesTableBody.innerHTML = '';
        if (consultaEmptyState) consultaEmptyState.classList.remove('hidden');
        return;
    }
    
    try {
        if (consultaPacientesTableBody) {
            consultaPacientesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando...</td></tr>';
        }
        if (consultaEmptyState) consultaEmptyState.classList.add('hidden');

        // Limpeza do array global/local de agendamentos, se houver
        if (typeof window.agendamentosData !== 'undefined') {
            window.agendamentosData = [];
        }

        const { startIso, endIso } = buildDayDateRangeUTC(dateStr);
        const agQ = db.from('agenda_agendamentos')
            .select('*')
            .eq('empresa_id', currentEmpresaId)
            .eq('profissional_id', Number(profSeqId))
            .gte('inicio', startIso)
            .lt('inicio', endIso)
            .order('inicio', { ascending: true });
            
        const { data: ags, error: agErr } = await agQ;
        if (agErr) throw agErr;
        
        // Filter out canceled and concluded
        const validAgs = (ags || []).filter(a => {
            const st = String(a.status || '').toUpperCase();
            // A regra de negócio exige que agendamentos Concluídos não apareçam mais na fila do dia
            return st !== 'CANCELADO' && st !== 'CONCLUIDO' && st !== 'CONCLUÍDO';
        });
        
        if (!validAgs.length) {
            if (consultaPacientesTableBody) consultaPacientesTableBody.innerHTML = '';
            if (consultaEmptyState) consultaEmptyState.classList.remove('hidden');
            return;
        }
        
        // Get patient info
        const patIds = [...new Set(validAgs.map(a => a.paciente_id).filter(Boolean))];
        let pMap = {};
        if (patIds.length > 0) {
            const { data: pats } = await db.from('pacientes')
                .select('id, seqid, nome, telefone')
                .eq('empresa_id', currentEmpresaId)
                .in('seqid', patIds);
            (pats || []).forEach(p => { pMap[p.seqid] = p; });
        }
        
        let html = '';
        let visibleCount = 0;
        validAgs.forEach(ag => {
            const pInfo = pMap[ag.paciente_id];
            
            // Segurança: Se o paciente não foi encontrado no pMap (ou seja, não pertence à empresa atual), ignorar.
            if (!pInfo) return;
            
            const pUuid = pInfo.id;
            
            // Check budgets for this patient
            let avaliacaoBudget = null;
            let wasLiberated = false;
            let hasNormalBudgetOpen = false;
            
            if (pUuid) {
                // Find if there's an 'Avaliação' budget
                avaliacaoBudget = budgets.find(b => {
                    const isSamePat = b.pacienteid === pUuid || String(b.paciente_id) === String(pUuid);
                    const statusNorm = String(b.status || '').trim().toLowerCase();
                    return isSamePat && (statusNorm === 'avaliação' || statusNorm === 'avaliacao');
                });
                
                // If no avaliacao budget, check if there's a 'Pendente' budget created today (meaning it was liberated)
                if (!avaliacaoBudget) {
                    wasLiberated = budgets.some(b => {
                        const isSamePat = b.pacienteid === pUuid || String(b.paciente_id) === String(pUuid);
                        const statusNorm = String(b.status || '').trim().toLowerCase();
                        return isSamePat && statusNorm === 'pendente' && (b.created_at || '').startsWith(dateStr);
                    });
                }

                // Check if patient already has a normal budget in progress (created via menu)
                // that is not canceled and not concluded, which means they don't need a new evaluation today
                hasNormalBudgetOpen = budgets.some(b => {
                    const isSamePat = b.pacienteid === pUuid || String(b.paciente_id) === String(pUuid);
                    const statusNorm = normalizeKey(String(b.status || ''));
                    // Se tem qualquer orçamento normal que não seja 'AVALIACAO', 'CANCELADO', 'EXECUTADO', 'CONCLUIDO'
                    return isSamePat && 
                           !statusNorm.includes('AVALIA') && 
                           statusNorm !== 'CANCELADO' && 
                           statusNorm !== 'EXECUTADO' && 
                           statusNorm !== 'CONCLUIDO';
                });
            }
            
            // If it was liberated today OR already has an open normal budget, don't show in the grid
            if (wasLiberated || hasNormalBudgetOpen) return;
            
            visibleCount++;
            
            const d = new Date(ag.inicio);
            const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const pName = escapeHtml(pInfo.nome || 'Paciente não encontrado');
            const pPhone = escapeHtml(pInfo.telefone || '-');
            const statusBadge = `<span class="status-badge" style="background:var(--bg-color); color:var(--text-color); border:1px solid var(--border-color);">${escapeHtml(ag.status || 'Agendado')}</span>`;
            
            let actionButtons = '';
            
            // 3. REGRA DE NEGÓCIO: Se o status já for 'CONCLUIDO', a linha não deveria nem chegar aqui (pois foi filtrada acima),
            // mas mantemos este fallback de segurança.
            if (String(ag.status || '').toUpperCase() === 'CONCLUIDO' || String(ag.status || '').toUpperCase() === 'CONCLUÍDO') {
                return; // Pula a renderização da linha completamente
            } else {
                // Sincronia de Renderização: passar o UUID correto (pUuid) e não o seqId para evitar confusões
                actionButtons += `
                    <button class="btn btn-sm btn-primary" onclick="iniciarConsultaAvaliacao('${pUuid}', '${ag.id}')">
                        <i class="ri-play-circle-line"></i> Iniciar Avaliação
                    </button>
                `;
                
                // NOVO BOTÃO FINALIZAR AVALIAÇÃO: Resolve o fluxo fechando a agenda e liberando o orçamento (se houver)
                const budgetIdStr = avaliacaoBudget ? avaliacaoBudget.id : '';
                actionButtons += `
                    <button class="btn btn-sm btn-success" onclick="finalizarConsultaAvaliacao('${ag.id}', '${budgetIdStr}')" style="margin-left: 4px;" title="Finalizar Atendimento de Avaliação">
                        <i class="ri-check-double-line"></i> Finalizar
                    </button>
                `;
            }
            
            html += `
                <tr>
                    <td style="font-weight:bold;">${timeStr}</td>
                    <td>${pName}</td>
                    <td>${pPhone}</td>
                    <td>${statusBadge}</td>
                    <td style="white-space: nowrap;">
                        ${actionButtons}
                    </td>
                </tr>
            `;
        });
        
        if (visibleCount === 0) {
            if (consultaPacientesTableBody) consultaPacientesTableBody.innerHTML = '';
            if (consultaEmptyState) consultaEmptyState.classList.remove('hidden');
        } else {
            if (consultaPacientesTableBody) consultaPacientesTableBody.innerHTML = html;
            if (consultaEmptyState) consultaEmptyState.classList.add('hidden');
        }
        
    } catch (e) {
        console.error('Error fetching consulta/avaliacao:', e);
        if (consultaPacientesTableBody) consultaPacientesTableBody.innerHTML = '';
        if (consultaEmptyState) consultaEmptyState.classList.remove('hidden');
        showToast('Erro ao carregar agenda de avaliação.', true);
    }
}