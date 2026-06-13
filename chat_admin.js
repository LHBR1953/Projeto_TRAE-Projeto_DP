
// --- CENTRAL DO PACIENTE (CHAT) ---
let chatPacientesData = [];
let currentChatPacienteId = null;
let chatSubscriptionAdmin = null;

async function fetchChatPacientesList() {
    try {
        // Obter mensagens da empresa logada
        const { data, error } = await db.from('portal_mensagens')
            .select('id, paciente_id, conteudo, lida, remetente, created_at, pacientes(nome)')
            .eq('empresa_id', currentEmpresaId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const pacMap = new Map();
        (data || []).forEach(msg => {
            const pId = msg.paciente_id;
            if (!pacMap.has(pId)) {
                pacMap.set(pId, {
                    id: pId,
                    nome: msg.pacientes ? msg.pacientes.nome : 'Paciente Desconhecido',
                    unread: 0,
                    lastMessageAt: msg.created_at
                });
            }
            if (msg.remetente === 'paciente' && !msg.lida) {
                pacMap.get(pId).unread++;
            }
        });
        
        chatPacientesData = Array.from(pacMap.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        renderChatPacientesList();
    } catch (err) {
        console.error('Erro ao buscar lista de chat:', err);
    }
}

function renderChatPacientesList() {
    const listEl = document.getElementById('chatPacientesList');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    if (chatPacientesData.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">Nenhuma conversa encontrada.</p>';
        return;
    }
    
    chatPacientesData.forEach(p => {
        const item = document.createElement('div');
        item.style.padding = '10px';
        item.style.borderRadius = '6px';
        item.style.cursor = 'pointer';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.background = currentChatPacienteId === p.id ? '#e2e8f0' : '#f8fafc';
        item.style.border = '1px solid #cbd5e1';
        
        item.onclick = () => openChatForPaciente(p.id, p.nome);
        
        const nameEl = document.createElement('span');
        nameEl.style.fontSize = '14px';
        nameEl.style.fontWeight = '500';
        nameEl.style.color = '#334155';
        nameEl.textContent = p.nome;
        
        item.appendChild(nameEl);
        
        if (p.unread > 0) {
            const badge = document.createElement('span');
            badge.style.background = '#ef4444';
            badge.style.color = '#fff';
            badge.style.fontSize = '11px';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '10px';
            badge.style.fontWeight = 'bold';
            badge.textContent = p.unread;
            item.appendChild(badge);
        }
        
        listEl.appendChild(item);
    });
}

async function openChatForPaciente(pacienteId, pacienteNome) {
    currentChatPacienteId = pacienteId;
    document.getElementById('chatActivePatientName').textContent = pacienteNome;
    document.getElementById('chatAdminInput').disabled = false;
    document.getElementById('btnSendAdminChat').disabled = false;
    
    renderChatPacientesList();
    
    try {
        await db.from('portal_mensagens')
            .update({ lida: true })
            .eq('paciente_id', pacienteId)
            .eq('empresa_id', currentEmpresaId)
            .eq('remetente', 'paciente')
            .eq('lida', false);
            
        fetchChatPacientesList();
        
        const { data, error } = await db.from('portal_mensagens')
            .select('*')
            .eq('paciente_id', pacienteId)
            .eq('empresa_id', currentEmpresaId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        renderActiveChatMessages(data || []);
    } catch (err) {
        console.error('Erro ao abrir chat:', err);
    }
}

function renderActiveChatMessages(mensagens) {
    const container = document.getElementById('chatActiveMessages');
    if (!container) return;
    
    container.innerHTML = '';
    if (mensagens.length === 0) {
        container.innerHTML = '<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted);">Nenhuma mensagem.</div>';
        return;
    }
    
    mensagens.forEach(msg => {
        adicionarMensagemAdminDOM(msg);
    });
}

function adicionarMensagemAdminDOM(msg) {
    const container = document.getElementById('chatActiveMessages');
    if (!container) return;
    
    const isPaciente = msg.remetente === 'paciente';
    const msgEl = document.createElement('div');
    msgEl.style.maxWidth = '70%';
    msgEl.style.padding = '10px 14px';
    msgEl.style.borderRadius = '8px';
    msgEl.style.fontSize = '13px';
    msgEl.style.wordBreak = 'break-word';
    msgEl.style.marginBottom = '10px';
    
    if (isPaciente) {
        msgEl.style.alignSelf = 'flex-start';
        msgEl.style.background = '#e2e8f0';
        msgEl.style.color = '#334155';
        msgEl.style.borderBottomLeftRadius = '2px';
    } else {
        msgEl.style.alignSelf = 'flex-end';
        msgEl.style.background = 'var(--primary-color)';
        msgEl.style.color = '#ffffff';
        msgEl.style.borderBottomRightRadius = '2px';
    }
    
    msgEl.textContent = msg.conteudo;
    
    const emptyMsg = container.querySelector('div[style*="justify-content: center"]');
    if (emptyMsg) container.innerHTML = '';
    
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('btnSendAdminChat')?.addEventListener('click', enviarMensagemAdmin);
document.getElementById('chatAdminInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensagemAdmin();
});

async function enviarMensagemAdmin() {
    const input = document.getElementById('chatAdminInput');
    const texto = input.value.trim();
    if (!texto || !currentChatPacienteId) return;
    
    input.value = '';
    input.disabled = true;
    document.getElementById('btnSendAdminChat').disabled = true;
    
    try {
        const { error } = await db.from('portal_mensagens')
            .insert([{
                paciente_id: currentChatPacienteId,
                empresa_id: currentEmpresaId,
                conteudo: texto,
                remetente: 'clinica',
                lida: false
            }]);
            
        if (error) throw error;
    } catch (err) {
        console.error('Erro ao enviar mensagem:', err);
        showToast('Erro ao enviar mensagem', true);
    } finally {
        input.disabled = false;
        document.getElementById('btnSendAdminChat').disabled = false;
        input.focus();
    }
}

function setupAdminChatRealtime() {
    if (chatSubscriptionAdmin) return;
    
    chatSubscriptionAdmin = supabase
        .channel('chat_admin')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'portal_mensagens',
                filter: `empresa_id=eq.${currentEmpresaId}`
            },
            async (payload) => {
                const msg = payload.new;
                
                if (msg.paciente_id === currentChatPacienteId) {
                    adicionarMensagemAdminDOM(msg);
                    
                    if (msg.remetente === 'paciente') {
                        await db.from('portal_mensagens')
                            .update({ lida: true })
                            .eq('id', msg.id);
                    }
                }
                
                fetchChatPacientesList();
            }
        )
        .subscribe();
}

// Hook showList to load chat when selected
const _originalShowListChat = showList;
showList = function(type = 'patients') {
    _originalShowListChat(type);
    if (type === 'chatPacientes') {
        fetchChatPacientesList();
        setupAdminChatRealtime();
    }
};
