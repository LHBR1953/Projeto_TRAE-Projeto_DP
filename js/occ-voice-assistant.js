document.addEventListener('DOMContentLoaded', () => {
    initAgendaVoiceAssistant();
});

function initAgendaVoiceAssistant() {
    const agendaMicBtn = document.querySelector('#agendaView .btn-occ-voice');
    const indicator = document.querySelector('#agendaView .occ-voice-indicator');
    const statusText = document.querySelector('#agendaView .occ-voice-status-text');

    if (!agendaMicBtn) return;

    // Garante que o evento será atrelado corretamente removendo listeners antigos (clonando)
    const newAgendaMicBtn = agendaMicBtn.cloneNode(true);
    agendaMicBtn.parentNode.replaceChild(newAgendaMicBtn, agendaMicBtn);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('[VOICE] SpeechRecognition não suportado neste navegador.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    newAgendaMicBtn.addEventListener('click', () => {
        try {
            recognition.start();
            console.log('[VOICE] Escuta iniciada na tela de Agenda.');
            if (indicator) indicator.style.display = 'block';
            if (statusText) statusText.style.display = 'block';
        } catch (error) {
            console.error('[VOICE] Erro ao iniciar escuta:', error);
            if (indicator) indicator.style.display = 'none';
            if (statusText) statusText.style.display = 'none';
        }
    });

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        console.log('[VOICE] Texto reconhecido na Agenda:', text);
        if (typeof window.processAgendaVoiceCommand === 'function') {
            window.processAgendaVoiceCommand(text);
        }
    };

    recognition.onerror = (event) => {
        console.error('[VOICE] Erro de reconhecimento:', event.error);
        if (indicator) indicator.style.display = 'none';
        if (statusText) statusText.style.display = 'none';
    };

    recognition.onend = () => {
        console.log('[VOICE] Escuta finalizada.');
        if (indicator) indicator.style.display = 'none';
        if (statusText) statusText.style.display = 'none';
    };
}

window.processAgendaVoiceCommand = (text) => {
    const isAgendaView = document.querySelector('#agendaView') && !document.querySelector('#agendaView').classList.contains('hidden');
    
    // Funções auxiliares caso 'this' não exista
    const parseDate = (dateStr) => {
        const parts = dateStr.match(/(\d{1,2})[\/\-\s]+(\d{1,2})[\/\-\s]+(\d{4})/);
        if (parts) {
            return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
        return null;
    };
    
    const fillInput = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };
        if (/(?:novo agendamento|criar agendamento|nova consulta|nova agenda)/i.test(text)) {
            let btnNew = null;
            if (isAgendaView) btnNew = document.querySelector('#btnAgendaNew');
            
            if (btnNew) {
                btnNew.click();
                console.log('[VOICE] Comando de Novo Agendamento acionado.');
                text = text.replace(/(?:novo agendamento|criar agendamento|nova consulta|nova agenda)/gi, '');
            }
        }

        // ====================================================================
        // COMANDOS DE MODAL DE AGENDAMENTO
        // ====================================================================
        const isAgendaModal = document.querySelector('#modalAgenda') && !document.querySelector('#modalAgenda').classList.contains('hidden');
        
        // Tratar Data e Profissional na tela de listagem de agenda (filtros)
        if (isAgendaView && !isAgendaModal) {
            const dataMatch = text.match(/data\s+(\d{1,2}[\/\-\s]+\d{1,2}[\/\-\s]+\d{4})/i);
            if (dataMatch && dataMatch[1]) {
                const parsedDate = parseDate(dataMatch[1].trim());
                if (parsedDate) {
                    fillInput('#agendaDate', parsedDate, 'Data da Agenda');
                    text = text.replace(dataMatch[0], '');
                }
            }
        }

            const profAgendaMatch = text.match(/(?:profissional|dentista|doutor|doutora|dr|dra)\s+(.*?)(?=\s+(?:data|imprimir|gerar|relatório|reduzida|semana|dia|novo|criar|agenda|agendamento|consulta|salvar|cancelar|voltar|limpar|apagar)|$)/i);
            if (profAgendaMatch && profAgendaMatch[1].trim()) {
                let profName = profAgendaMatch[1].trim();
                const selectProf = document.querySelector('#agendaProfessional');
                if (selectProf) {
                    const clean = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                    const cleanedSpoken = clean(profName);
                    
                    for (let i = 0; i < selectProf.options.length; i++) {
                        const opt = selectProf.options[i];
                        const cleanOptText = clean(opt.text);
                        if (!cleanOptText || opt.value === "" || opt.disabled) continue;
                        
                        if (cleanedSpoken.includes(cleanOptText) || cleanOptText.includes(cleanedSpoken.replace(/PROFISSIONAL|DENTISTA|DR\s|DRA\s|DOUTOR|DOUTORA/gi, '').trim())) {
                            selectProf.selectedIndex = i;
                            selectProf.value = opt.value;
                            selectProf.dispatchEvent(new Event('change', { bubbles: true }));
                            selectProf.dispatchEvent(new Event('input', { bubbles: true }));
                            console.log(`[VOICE] Profissional da Agenda selecionado com sucesso: ${opt.text}`);
                            text = text.replace(profAgendaMatch[0], '');
                            break;
                        }
                    }
                }
            }
        }