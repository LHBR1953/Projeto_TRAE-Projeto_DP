// MÓDULO DE SUPORTE - TICKETS
// ==========================================

async function fetchTickets() {
    if (!suporteTicketsBody) return;
    
    suporteTicketsBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Carregando chamados...</td></tr>';
    if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.add('hidden');
    
    try {
        let query = db.from('suporte_tickets').select('*').order('data_criacao', { ascending: false });
        
        if (!isSuperAdmin) {
            if (!currentEmpresaId) {
                suporteTicketsBody.innerHTML = '';
                return;
            }
            query = query.eq('emp_id', currentEmpresaId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        renderTicketsTable(data || []);
    } catch (err) {
        console.error('Erro ao buscar tickets:', err);
        suporteTicketsBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--danger-color);">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

function renderTicketsTable(tickets) {
    if (!tickets || tickets.length === 0) {
        suporteTicketsBody.innerHTML = '';
        if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.remove('hidden');
        return;
    }
    
    if (suporteTicketsEmptyState) suporteTicketsEmptyState.classList.add('hidden');
    suporteTicketsBody.innerHTML = '';
    
    tickets.forEach(t => {
        const tr = document.createElement('tr');
        
        const dateObj = new Date(t.data_criacao);
        const dateStr = dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const shortId = t.id.substring(0, 8).toUpperCase();
        
        let statusBadge = 'bg-secondary';
        if (t.status === 'Aberto') statusBadge = 'bg-primary';
        else if (t.status === 'Em Atendimento') statusBadge = 'bg-warning text-dark';
        else if (t.status === 'Concluído') statusBadge = 'bg-success';
        
        tr.innerHTML = `
            <td><strong style="color: var(--primary-color);">TCK-${shortId}</strong></td>
            <td>${t.nome_empresa || 'N/A'}<br><small class="text-muted" style="font-size: 0.8em;">${t.usuario_nome || 'Usuário'}</small></td>
            <td>${t.titulo || 'Sem Título'}</td>
            <td>${t.categoria || 'Geral'}</td>
            <td><span class="badge ${statusBadge}">${t.status}</span></td>
            <td>${dateStr}</td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-outline-primary btn-view-ticket" title="Visualizar">
                    <i class="ri-eye-line"></i>
                </button>
            </td>
        `;
        
        const btnView = tr.querySelector('.btn-view-ticket');
        btnView.addEventListener('click', () => openViewTicketModal(t));
        
        suporteTicketsBody.appendChild(tr);
    });
}

function openNovoTicketModal() {
    if (suporteTicketId) suporteTicketId.value = '';
    if (suporteTicketTitulo) {
        suporteTicketTitulo.value = '';
        suporteTicketTitulo.readOnly = false;
    }
    if (suporteTicketCategoria) {
        suporteTicketCategoria.value = 'Dúvidas';
        suporteTicketCategoria.disabled = false;
    }
    if (suporteTicketDescricao) {
        suporteTicketDescricao.value = '';
        suporteTicketDescricao.readOnly = false;
    }
    
    if (suporteTicketModalTitle) suporteTicketModalTitle.textContent = 'Abrir Novo Chamado';
    if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.add('hidden');
    
    if (btnSalvarTicket) {
        btnSalvarTicket.style.display = 'inline-flex';
        btnSalvarTicket.innerHTML = 'Salvar';
    }
    
    if (suporteTicketModal) suporteTicketModal.classList.remove('hidden');
}

function openViewTicketModal(ticket) {
    if (suporteTicketId) suporteTicketId.value = ticket.id;
    if (suporteTicketTitulo) {
        suporteTicketTitulo.value = ticket.titulo || '';
        suporteTicketTitulo.readOnly = true;
    }
    if (suporteTicketCategoria) {
        suporteTicketCategoria.value = ticket.categoria || 'Dúvidas';
        suporteTicketCategoria.disabled = true;
    }
    if (suporteTicketDescricao) {
        suporteTicketDescricao.value = ticket.descricao || '';
        suporteTicketDescricao.readOnly = true;
    }
    
    if (suporteTicketModalTitle) suporteTicketModalTitle.textContent = `Chamado TCK-${ticket.id.substring(0,8).toUpperCase()}`;
    
    if (isSuperAdmin) {
        if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.remove('hidden');
        if (suporteTicketStatus) suporteTicketStatus.value = ticket.status || 'Aberto';
        if (btnSalvarTicket) {
            btnSalvarTicket.style.display = 'inline-flex';
            btnSalvarTicket.innerHTML = 'Atualizar Status';
        }
    } else {
        if (suporteTicketAdminStatusGroup) suporteTicketAdminStatusGroup.classList.add('hidden');
        if (btnSalvarTicket) btnSalvarTicket.style.display = 'none';
    }
    
    if (suporteTicketModal) suporteTicketModal.classList.remove('hidden');
}

async function saveTicket() {
    const id = suporteTicketId ? suporteTicketId.value : '';
    const titulo = (suporteTicketTitulo ? suporteTicketTitulo.value : '').trim();
    const categoria = (suporteTicketCategoria ? suporteTicketCategoria.value : '').trim();
    const descricao = (suporteTicketDescricao ? suporteTicketDescricao.value : '').trim();
    
    if (!titulo || !descricao) {
        showToast('Título e Descrição são obrigatórios.', true);
        return;
    }
    
    if (btnSalvarTicket) {
        btnSalvarTicket.disabled = true;
        btnSalvarTicket.innerHTML = 'Salvando...';
    }
    
    try {
        if (id && isSuperAdmin) {
            const status = suporteTicketStatus ? suporteTicketStatus.value : 'Aberto';
            const { error } = await db.from('suporte_tickets').update({
                status: status
            }).eq('id', id);
            
            if (error) throw error;
            showToast('Status do chamado atualizado!');
        } else {
            if (!currentEmpresaId) throw new Error('Empresa não identificada.');
            
            let nomeEmpresa = 'Clínica';
            const emp = empresas.find(e => e.id === currentEmpresaId);
            if (emp) nomeEmpresa = emp.nome_fantasia || emp.razao_social;
            
            let nomeUsuario = 'Usuário';
            if (typeof currentUser !== 'undefined' && currentUser) {
                nomeUsuario = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            }
            
            const { error } = await db.from('suporte_tickets').insert([{
                emp_id: currentEmpresaId,
                nome_empresa: nomeEmpresa,
                usuario_nome: nomeUsuario,
                titulo: titulo,
                categoria: categoria,
                descricao: descricao,
                status: 'Aberto'
            }]);
            
            if (error) throw error;
            showToast('Chamado aberto com sucesso!');
        }
        
        if (suporteTicketModal) suporteTicketModal.classList.add('hidden');
        fetchTickets();
        
    } catch (err) {
        console.error('Erro ao salvar ticket:', err);
        showToast('Erro: ' + err.message, true);
    } finally {
        if (btnSalvarTicket) {
            btnSalvarTicket.disabled = false;
            btnSalvarTicket.innerHTML = id ? 'Atualizar Status' : 'Salvar';
        }
    }
}

if (btnNovoTicket) {
    btnNovoTicket.addEventListener('click', openNovoTicketModal);
}
if (btnSalvarTicket) {
    btnSalvarTicket.addEventListener('click', saveTicket);
}
