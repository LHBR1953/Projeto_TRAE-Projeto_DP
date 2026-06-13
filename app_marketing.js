
const navMarketingToggle = document.getElementById('navMarketingToggle');
const navMarketingSubmenu = document.getElementById('navMarketingSubmenu');
const navMarketingToggleIcon = document.getElementById('navMarketingToggleIcon');
const navMarketing = document.getElementById('navMarketing');
const navWhatsappMarketing = document.getElementById('navWhatsappMarketing');
const marketingView = document.getElementById('marketingView');
const btnToggleAddItem = document.getElementById('btnToggleAddItem');

function renderWhatsappMarketingList() {
    console.log("--- DEBUG DE PACIENTES ---"); 
    console.log("Total de pacientes carregados (patients):", typeof patients !== 'undefined' && patients ? patients.length : "NULA/UNDEFINED"); 
    if (typeof patients !== 'undefined' && patients && patients.length > 0) { 
        console.log("Exemplo de objeto do primeiro paciente:", patients[0]); 
        
        // Vamos checar TODAS as possíveis chaves de data de nascimento no objeto real
        const keys = Object.keys(patients[0]).filter(k => k.toLowerCase().includes('nasc') || k.toLowerCase().includes('data'));
        console.log("Chaves de data encontradas no objeto:", keys);
        
        const comData = patients.filter(p => p.data_nascimento || p.nascimento || p.dataNascimento || p.birth_date); 
        console.log("Pacientes com data preenchida:", comData.length); 
    }

    const tbody = document.getElementById('waPatientsBody');
    const summary = document.getElementById('waPatientsSummary');
    const selectAll = document.getElementById('waSelectAll');
    if (!tbody) return;

    // Força o botão a iniciar desabilitado toda vez que renderiza a tabela
    const btnSendBulk = document.getElementById('btnWaSendBulk');
    if (btnSendBulk) {
        btnSendBulk.disabled = true;
        btnSendBulk.innerHTML = `<i class="ri-links-line"></i> Gerar Links de Envio (0)`;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Padronização na Fonte (Lógica Infalível em String)
    const todayDayStr = String(now.getDate()).padStart(2, '0');
    const todayMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const hojeFormatado = `${todayDayStr}/${todayMonthStr}`;
    
    let candidates = patients.filter(p => {
        if (!p.datanascimento) return false;
        
        // Filtro de Segurança: não incluir números inválidos
        if (p.status_whatsapp === 'invalido') return false;
        
        // Pega os 10 primeiros caracteres para lidar com YYYY-MM-DDTHH:mm:ss etc.
        const dtStr = String(p.datanascimento).substring(0, 10);
        
        let bDayStr, bMonthStr;
        if (dtStr.includes('/')) {
            const parts = dtStr.split('/');
            bDayStr = parts[0].padStart(2, '0');
            bMonthStr = parts[1].padStart(2, '0');
        } else if (dtStr.includes('-')) {
            const parts = dtStr.split('-');
            if (parts[0].length === 4) { // YYYY-MM-DD
                bMonthStr = parts[1].padStart(2, '0');
                bDayStr = parts[2].padStart(2, '0');
            } else { // DD-MM-YYYY
                bDayStr = parts[0].padStart(2, '0');
                bMonthStr = parts[1].padStart(2, '0');
            }
        } else {
            return false;
        }
        
        if (!bDayStr || !bMonthStr) return false;
        
        // Pega DD/MM formatado com zeros à esquerda
        const dataPacienteFormatada = `${bDayStr}/${bMonthStr}`;
        
        // Debug brutal: ver o que ele está lendo e transformando
        console.log(`[DEBUG WA MARKETING] Paciente: ${p.nome} | DB: ${p.datanascimento} | Extraído: ${dataPacienteFormatada} | Hoje Sistema: ${hojeFormatado}`);
        
        // Comparação Binária Direta e Estrita em String
        p._isHoje = (dataPacienteFormatada === hojeFormatado);
        p._isMes = (bMonthStr === todayMonthStr);
        
        // Cálculo matemático auxiliar apenas para a 'Semana' e para a interface visual
        const bDay = parseInt(bDayStr, 10);
        const bMonth = parseInt(bMonthStr, 10);
        const bDateThisYear = new Date(now.getFullYear(), bMonth - 1, bDay);
        
        const diffTime = bDateThisYear - startOfToday;
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        p._diffDays = diffDays;
        // Força sincronia: se for isHoje por string, a diferença de dias visuais é 0
        if (p._isHoje) p._diffDays = 0; 
        
        p._isSemana = p._diffDays >= 0 && p._diffDays <= 7;
        
        return p._isHoje || p._isSemana || p._isMes;
    });

    tbody.innerHTML = '';
    
    if (candidates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum aniversariante encontrado.</td></tr>`;
        if (summary) summary.innerText = "0 encontrados";
        if (selectAll) selectAll.checked = false;
        updateWaSendButtonState();
        return;
    }

    candidates.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'wa-patient-row';
        tr.setAttribute('data-is-hoje', p._isHoje ? "true" : "false");
        tr.setAttribute('data-is-semana', p._isSemana ? "true" : "false");
        tr.setAttribute('data-is-mes', p._isMes ? "true" : "false");
        
        const fone = p.telefone || p.celular || p.whatsapp || 'Não informado';
        tr.setAttribute('data-telefone', fone);
        
        let diasStr = "HOJE";
        if (p._diffDays > 0) {
            diasStr = `Faltam ${p._diffDays} dia${p._diffDays > 1 ? 's' : ''}`;
        } else if (p._diffDays < 0) {
            const passed = Math.abs(p._diffDays);
            diasStr = `Passou há ${passed} dia${passed > 1 ? 's' : ''}`;
        }

        let badgeHtml = p._diffDays === 0 
            ? `<span class="status-badge status-badge-hoje" style="background:#10b981; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">HOJE</span>` 
            : `<small style="color:var(--primary-color);">${diasStr}</small>`;
        
        tr.innerHTML = `
            <td style="text-align:center;"><input type="checkbox" class="wa-patient-checkbox" data-id="${p.id}" data-nome="${p.nome}" data-fone="${fone}"></td>
            <td style="font-weight:600;">${p.nome}</td>
            <td>${fone}</td>
            <td>${formatDate(p.datanascimento)} <br>${badgeHtml}</td>
            <td id="wa-status-${p.id}">Aguardando</td>
            <td style="text-align:center;">
                <button id="btn-single-${p.id}" class="btn btn-secondary btn-sm" onclick="sendWhatsappSingle('${p.id}', '${p.nome}', '${fone}')" disabled><i class="ri-clipboard-line"></i> Copiar Link</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // O listener de change agora é delegado no #waPatientsBody
    
    // Aplica o filtro atual na DOM
    filterWaTable();
}