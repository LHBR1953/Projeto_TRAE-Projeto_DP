/**
 * MÓDULO ASSISTENTE DE VOZ (OK, OCC) - FASE 1
 * Isolado e dedicado para manter a arquitetura limpa.
 */
class OCCVoiceAssistant {
    constructor(options = {}) {
        this.btnSelector = options.btnSelector || '#btnOccVoice';
        this.indicatorSelector = options.indicatorSelector || '#occVoiceIndicator';
        this.statusTextSelector = options.statusTextSelector || '#occVoiceStatusText';
        
        // Seletores dos campos de destino
        this.fields = {
            nome: options.nomeSelector || '#occ_paciente_nome',
            cep: options.cepSelector || '#occ_paciente_cep',
            numero: options.numeroSelector || '#occ_paciente_numero',
            complemento: options.complementoSelector || '#occ_paciente_complemento',
            endereco: options.enderecoSelector || '#occ_paciente_endereco',
            bairro: options.bairroSelector || '#occ_paciente_bairro',
            cidade: options.cidadeSelector || '#occ_paciente_cidade',
            uf: options.ufSelector || '#occ_paciente_uf',
            cpf: options.cpfSelector || '#cpf',
            dataNascimento: options.dataNascimentoSelector || '#dataNascimento',
            sexo: options.sexoSelector || '#sexo',
            profissao: options.profissaoSelector || '#profissao',
            telefone: options.telefoneSelector || '#occ_paciente_telefone',
            celular: options.celularSelector || '#occ_paciente_celular',
            email: options.emailSelector || '#occ_paciente_email',
            emTratamentoMedico: options.emTratamentoMedicoSelector || '#emTratamentoMedico',
            tratamentoDesc: options.tratamentoDescSelector || '#tratamentoDesc',
            tomaMedicacao: options.tomaMedicacaoSelector || '#tomaMedicacao',
            medicacaoDesc: options.medicacaoDescSelector || '#medicacaoDesc',
            temAlergia: options.temAlergiaSelector || '#temAlergia',
            alergiaDesc: options.alergiaDescSelector || '#alergiaDesc',
            teveHemorragia: options.teveHemorragiaSelector || '#teveHemorragia',
            doencasPreexistentes: options.doencasPreexistentesSelector || '#doencasPreexistentes',
            naoReceberCampanhas: options.naoReceberCampanhasSelector || '#naoReceberCampanhas',
            btnSalvar: options.btnSalvarSelector || '#btnSavePatient',
            
            // Profissionais
            profNome: options.profNomeSelector || '#profNome',
            profCelular: options.profCelularSelector || '#profCelular',
            profEmail: options.profEmailSelector || '#profEmail',
            profTipo: options.profTipoSelector || '#profTipo',
            profStatus: options.profStatusSelector || '#profStatus',
            comissionCE: options.comissionCESelector || '#comissionCE',
            comissionCC: options.comissionCCSelector || '#comissionCC',
            comissionCP: options.comissionCPSelector || '#comissionCP',
            comissionImp: options.comissionImpSelector || '#comissionImp',
            agendaDay1: options.agendaDay1Selector || '#agendaDay1Enabled',
            agendaDay2: options.agendaDay2Selector || '#agendaDay2Enabled',
            agendaDay3: options.agendaDay3Selector || '#agendaDay3Enabled',
            agendaDay4: options.agendaDay4Selector || '#agendaDay4Enabled',
            agendaDay5: options.agendaDay5Selector || '#agendaDay5Enabled',
            agendaDay6: options.agendaDay6Selector || '#agendaDay6Enabled',
            agendaDay7: options.agendaDay7Selector || '#agendaDay7Enabled',
            agendaDay1Start: '#agendaDay1Start',
            agendaDay1End: '#agendaDay1End',
            agendaDay1Slot: '#agendaDay1Slot',
            agendaDay2Start: '#agendaDay2Start',
            agendaDay2End: '#agendaDay2End',
            agendaDay2Slot: '#agendaDay2Slot',
            agendaDay3Start: '#agendaDay3Start',
            agendaDay3End: '#agendaDay3End',
            agendaDay3Slot: '#agendaDay3Slot',
            agendaDay4Start: '#agendaDay4Start',
            agendaDay4End: '#agendaDay4End',
            agendaDay4Slot: '#agendaDay4Slot',
            agendaDay5Start: '#agendaDay5Start',
            agendaDay5End: '#agendaDay5End',
            agendaDay5Slot: '#agendaDay5Slot',
            agendaDay6Start: '#agendaDay6Start',
            agendaDay6End: '#agendaDay6End',
            agendaDay6Slot: '#agendaDay6Slot',
            agendaDay7Start: '#agendaDay7Start',
            agendaDay7End: '#agendaDay7End',
            agendaDay7Slot: '#agendaDay7Slot',
            btnSaveProfessional: options.btnSaveProfessionalSelector || '#btnSaveProfessional'
        };

        this.btnOccVoiceNodes = document.querySelectorAll(this.btnSelector);
        this.occVoiceIndicatorNodes = document.querySelectorAll(this.indicatorSelector);
        this.occVoiceStatusTextNodes = document.querySelectorAll(this.statusTextSelector);
        
        this.recognition = null;
        this.isListening = false;
        
        // Controle de acúmulo de transcrição
        this.transcriptBuffer = '';
        this.pauseTimeout = null;
        this.lastFetchedCep = null;

        this.init();
    }

    init() {
        if (!this.btnOccVoiceNodes || this.btnOccVoiceNodes.length === 0) {
            console.warn('[OCC Voice] Botões de ativação não encontrados na DOM.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[OCC Voice] Web Speech API não suportada neste navegador.');
            this.btnOccVoiceNodes.forEach(btn => btn.style.display = 'none');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'pt-BR';

        this.bindEvents();
    }

    bindEvents() {
        this.btnOccVoiceNodes.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
        });

        this.recognition.onresult = (event) => this.handleResult(event);
        this.recognition.onerror = (event) => this.handleError(event);
        this.recognition.onend = () => this.handleEnd();
    }

    startListening() {
        try {
            this.transcriptBuffer = '';
            this.lastFetchedCep = null;
            this.recognition.start();
            this.isListening = true;
            this.btnOccVoiceNodes.forEach(btn => {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-secondary');
                btn.style.color = '#fff';
            });
            console.log('[OCC Voice] Escuta ativada em segundo plano.');
        } catch (e) {
            console.error('[OCC Voice] Erro ao iniciar:', e);
        }
    }

    stopListening() {
        this.recognition.stop();
        this.isListening = false;
        this.btnOccVoiceNodes.forEach(btn => {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-primary');
            btn.style.color = '';
        });
        clearTimeout(this.pauseTimeout);
        this.transcriptBuffer = '';
        this.hideIndicator();
        console.log('[OCC Voice] Escuta desativada.');
    }

    showIndicator() {
        this.occVoiceIndicatorNodes.forEach(el => el.style.display = 'block');
        this.occVoiceStatusTextNodes.forEach(el => el.style.display = 'inline');
    }

    hideIndicator() {
        this.occVoiceIndicatorNodes.forEach(el => el.style.display = 'none');
        this.occVoiceStatusTextNodes.forEach(el => el.style.display = 'none');
    }

    handleResult(event) {
        clearTimeout(this.pauseTimeout);

        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
        
        // Acumula a transcrição (Continuous Listening)
        this.transcriptBuffer += " " + transcript;
        console.log(`[OCC Voice Transcrição Acumulada]: "${this.transcriptBuffer.trim()}"`);

        this.showIndicator();
        
        // Processamento Independente de Entidades
        this.processCommand(this.transcriptBuffer.trim());

        // Limpa o buffer após um tempo de silêncio (pause)
        this.pauseTimeout = setTimeout(() => {
            console.log('[OCC Voice] Silêncio detectado. Limpando buffer de transcrição.');
            this.transcriptBuffer = '';
            this.hideIndicator();
        }, 4000);
    }

    handleError(event) {
        console.error('[OCC Voice] Erro:', event.error);
        if (event.error === 'not-allowed') {
            this.stopListening();
        }
    }

    handleEnd() {
        // Se estiver ativado, reinicia automaticamente para escuta contínua
        if (this.isListening) {
            try {
                this.recognition.start();
            } catch(e) {}
        }
    }

    setSpecialtyByVoice(spokenText) {
        // Tenta localizar por ID ou por Name, ou pelo contexto das opções (busca definitiva)
        const selectEl = document.querySelector('#especialidade') || 
                         document.querySelector('#especialidadeProfissional') || 
                         document.querySelector('select[name="especialidade"]') ||
                         document.querySelector('#professionalFormView select:nth-of-type(2)') || 
                         Array.from(document.querySelectorAll('select')).find(s => { 
                             return Array.from(s.options).some(opt => opt.text.toUpperCase().includes('ORTODONTIA')); 
                         }); 
                         
        if (!selectEl) { 
            console.warn('[VOICE] Select de especialidade não encontrado na tela!'); 
            return; 
        } 
      
        // Remove acentos e converte para MAIÚSCULAS 
        const normalize = (str) => String(str || '') 
            .normalize("NFD") 
            .replace(/[\u0300-\u036f]/g, "") 
            .toUpperCase() 
            .trim(); 
            
        const cleanSpoken = normalize(spokenText); 
        
        for (let i = 0; i < selectEl.options.length; i++) { 
            const opt = selectEl.options[i]; 
            const cleanOptText = normalize(opt.text); 
            
            if (!cleanOptText || opt.value === "" || opt.disabled) continue; 
            
            // Se a transcrição contiver a palavra da especialidade ou vice-versa
            if (cleanSpoken.includes(cleanOptText) || cleanOptText.includes(cleanSpoken.replace('ESPECIALIDADE', '').trim())) { 
                selectEl.selectedIndex = i;
                selectEl.value = opt.value; 
                
                // Dispara TODOS os eventos para o framework do OCC reconhecer a mudança 
                selectEl.dispatchEvent(new Event('change', { bubbles: true })); 
                selectEl.dispatchEvent(new Event('input', { bubbles: true })); 
                
                console.log(`[VOICE] Especialidade selecionada com sucesso: ${opt.text} (index ${i})`); 
                return; 
            } 
        } 
        console.warn('[VOICE] Nenhum match de especialidade encontrado para:', spokenText); 
    }

    processCommand(text) {
        // Wake Word Flexível / Tolerante a Erros: aceita qualquer indício de comando
        const hasKeyword = /fechar|gravar|descrição|descricao|subdivisão|subdivisao|categoria|valor|preço|preco|serviço|serviços|servico|servicos|adicionar|pesquisar|pesquise|pesquisa|buscar|procurar|filtrar|importar|inteligência|inteligencia|estoque|cancelar|voltar|nome|capturar|tirar|câmera|camera|escolher|selecionar|anexar|especialidade|prótese|protese|dentística|dentistica|odontopediatria|endodontia|implantodontia|cirurgia|periodontia|profissional|comissão|comissao|taxa|atende|atendimento|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo|clínico|clinico|especialista|ortodontista|ativo|inativo|cadastrar|paciente|cep|número|numero|nº|complemento|apartamento|apto|cpf|nascimento|data de nascimento|sexo|masculino|homem|feminino|mulher|profissão|profissao|telefone|celular|e-mail|email|tratamento|médico|medico|medicação|medicacao|alergia|hemorragia|doença|salvar|campanha|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck|novo|incluir|imprimir|gerar|relatório|editar|alterar|deletar|excluir|cálculo|calculo|fixo|elemento|cheque|unchek|exige|existe|habilita|desabilita/i.test(text);
        if (!hasKeyword) return;

        // Verifica qual formulário está visível
        const isProfessionalView = document.querySelector('#professionalFormView') && !document.querySelector('#professionalFormView').classList.contains('hidden');
        const isProfessionalList = document.querySelector('#professionalListView') && !document.querySelector('#professionalListView').classList.contains('hidden');
        const isServiceView = document.querySelector('#serviceFormView') && !document.querySelector('#serviceFormView').classList.contains('hidden');
        const isServiceList = document.querySelector('#servicesListView') && !document.querySelector('#servicesListView').classList.contains('hidden');
        
        // ====================================================================
        // COMANDOS DE NAVEGAÇÃO
        // ====================================================================
        if (/(?:ir para|abrir)\s+(?:serviços|serviço|estoque)/i.test(text) || /^(?:serviços|serviço)$/i.test(text.trim())) {
            const navServices = document.querySelector('#navServices');
            if (navServices) {
                navServices.click();
                console.log('[VOICE] Navegando para Serviços.');
                text = text.replace(/(?:ir para|abrir)\s+(?:serviços|serviço|estoque)|serviços|serviço/gi, '');
            }
        }

        // ====================================================================
        // COMANDOS DE TELA DE LISTAGEM
        // ====================================================================

        // Novo Paciente / Profissional
        if (/(?:novo|cadastrar|incluir)\s+paciente/i.test(text) && !text.includes('salvar')) {
            console.log('[OCC Voice] Comando: Novo Paciente detectado.');
            const btnAddNew = document.querySelector('#btnAddNew');
            if (btnAddNew) {
                btnAddNew.click();
                console.log('[VOICE] Redirecionando para Novo Paciente (Escuta mantida).');
                // Não chama this.stopListening() para permitir ditado contínuo
                text = text.replace(/(?:novo|cadastrar|incluir)\s+paciente/i, ''); // Limpa o comando da string para não repetir
            }
        }
        
        if (/(?:novo|cadastrar|incluir)\s+profissional/i.test(text) && !text.includes('salvar')) {
            console.log('[OCC Voice] Comando: Novo Profissional detectado.');
            const btnAddNewProf = document.querySelector('#btnAddNewProfessional');
            if (btnAddNewProf) {
                btnAddNewProf.click();
                console.log('[VOICE] Redirecionando para Novo Profissional (Escuta mantida).');
                text = text.replace(/(?:novo|cadastrar|incluir)\s+profissional/i, '');
            }
        }

        if (/(?:novo|cadastrar|incluir|adicionar)\s+(?:serviço|servico|item)/i.test(text) && !text.includes('salvar')) {
            console.log('[OCC Voice] Comando: Novo Serviço detectado.');
            const btnAddNewServ = document.querySelector('#btnNewService');
            if (btnAddNewServ) {
                btnAddNewServ.click();
                console.log('[VOICE] Redirecionando para Novo Serviço (Escuta mantida).');
                text = text.replace(/(?:novo|cadastrar|incluir|adicionar)\s+(?:serviço|servico|item)/i, '');
            }
        }

        // Imprimir Geral
        if (/(?:imprimir\s+geral|imprimir\s+lista|gerar\s+relatório|imprimir\s+relatório|imprimir\s+pacientes|imprimir\s+serviços)/i.test(text)) {
            console.log('[OCC Voice] Comando: Imprimir Geral detectado.');
            const btnPrint = document.querySelector(isServiceList ? '#btnPrintServiceList' : '#btnPrintPatients');
            if (btnPrint) {
                btnPrint.click();
                this.stopListening();
                return;
            }
        }

        // Importar Inteligência OCC
        if (/(?:importar inteligência|importar inteligencia)(?:\s+occ)?/i.test(text)) {
            const btnImport = document.querySelector('#btnServicesImportDefaultTemplates');
            if (btnImport) {
                btnImport.click();
                console.log('[VOICE] Comando Importar Inteligência OCC acionado.');
                text = text.replace(/(?:importar inteligência|importar inteligencia)(?:\s+occ)?/i, '');
            }
        }

        // Pesquisar / Filtrar Serviços
        const searchMatch = text.match(/(?:pesquisar|pesquise|pesquisa|buscar|procurar|filtrar)\s+(.*?)(?=\s+(?:novo|cadastrar|incluir|imprimir|gerar|editar|alterar|deletar|excluir|remover|limpar|apagar|salvar|cancelar|voltar)|$)/i);
        if (searchMatch && searchMatch[1].trim() && isServiceList) {
            const searchInput = document.querySelector('#searchServiceInput');
            if (searchInput) {
                searchInput.value = this.titleCase(searchMatch[1].trim());
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[VOICE] Pesquisando serviços por: ${searchMatch[1].trim()}`);
                text = text.replace(searchMatch[0], '');
            }
        }

        // Editar Paciente / Profissional / Serviço
        const editMatch = text.match(/(?:editar paciente|editar profissional|editar serviço|editar item|editar|alterar)\s+(.*?)(?=\s+(?:novo|cadastrar|incluir|imprimir|gerar|deletar|excluir|remover|limpar|apagar|salvar|cancelar|voltar)|$)/i);
        if (editMatch && editMatch[1].trim() && !text.includes('salvar')) {
            const searchName = this.removeAcentos(editMatch[1].trim().toLowerCase());
            console.log(`[OCC Voice] Buscando para editar: ${searchName}`);
            
            const isProfCmd = text.toLowerCase().includes('profissional');
            const isServCmd = text.toLowerCase().includes('serviço') || text.toLowerCase().includes('servico') || text.toLowerCase().includes('item');
            const tableBodySelector = isProfCmd || isProfessionalList ? '#professionalsTable tbody' : (isServCmd || isServiceList ? '#servicesTableBody' : '#patientsTableBody');
            
            const rows = document.querySelectorAll(`${tableBodySelector} tr`);
            for (let row of rows) {
                // Em patients a coluna de nome é a 2 (id, nome). Em professionals: (ID, Foto, Nome, Tipo...) - Nome é a 3
                // Em serviços: (ID, Descrição...) - Nome é a 2
                let nameColIndex = 2;
                if (isProfCmd || isProfessionalList) nameColIndex = 3;
                else if (isServCmd || isServiceList) nameColIndex = 2;
                
                const nameTd = row.querySelector(`td:nth-child(${nameColIndex})`);
                if (nameTd) {
                    const rowName = this.removeAcentos(nameTd.textContent.trim().toLowerCase());
                    if (rowName.includes(searchName) || searchName.includes(rowName)) {
                        const editBtn = row.querySelector('button[title="Editar"]') || row.querySelector('.btn-edit');
                        if (editBtn) {
                            editBtn.click();
                            console.log(`[VOICE] Abrindo edição: ${rowName} (Escuta mantida).`);
                            // Limpa o comando da string
                            text = text.replace(editMatch[0], '');
                            break;
                        }
                    }
                }
            }
        }

        // Deletar / Excluir Paciente / Profissional / Serviço
        const deleteMatch = text.match(/(?:deletar paciente|excluir paciente|remover paciente|deletar profissional|excluir profissional|remover profissional|deletar serviço|excluir serviço|remover serviço|deletar item|excluir item|remover item|deletar|excluir|remover)\s+(.*?)(?=\s+(?:novo|cadastrar|incluir|imprimir|gerar|editar|alterar|limpar|apagar|salvar|cancelar|voltar)|$)/i);
        if (deleteMatch && deleteMatch[1].trim()) {
            const searchName = this.removeAcentos(deleteMatch[1].trim().toLowerCase());
            console.log(`[OCC Voice] Buscando para excluir: ${searchName}`);
            
            const isProfCmd = text.toLowerCase().includes('profissional');
            const isServCmd = text.toLowerCase().includes('serviço') || text.toLowerCase().includes('servico') || text.toLowerCase().includes('item');
            const tableBodySelector = isProfCmd || isProfessionalList ? '#professionalsTable tbody' : (isServCmd || isServiceList ? '#servicesTableBody' : '#patientsTableBody');
            
            const rows = document.querySelectorAll(`${tableBodySelector} tr`);
            for (let row of rows) {
                let nameColIndex = 2;
                if (isProfCmd || isProfessionalList) nameColIndex = 3;
                else if (isServCmd || isServiceList) nameColIndex = 2;
                
                const nameTd = row.querySelector(`td:nth-child(${nameColIndex})`);
                if (nameTd) {
                    const rowName = this.removeAcentos(nameTd.textContent.trim().toLowerCase());
                    if (rowName.includes(searchName) || searchName.includes(rowName)) {
                        const deleteBtn = row.querySelector('button[title="Deletar"]') || row.querySelector('button[title="Excluir"]') || row.querySelector('.btn-delete');
                        if (deleteBtn) {
                            deleteBtn.click();
                            console.log(`[VOICE] Acionando exclusão: ${rowName}.`);
                            this.stopListening();
                            return;
                        }
                    }
                }
            }
        }

        // ====================================================================
        // COMANDOS DE FORMULÁRIO (Somente se o form estiver visível)
        // ====================================================================

        // Comandos de Limpeza (Inputs de Texto)
        if (/(?:limpar|apagar)\s+nome/i.test(text)) this.fillInput(this.fields.nome, '', 'Nome');
        if (/(?:limpar|apagar)\s+cep/i.test(text)) this.fillInput(this.fields.cep, '', 'CEP');
        if (/(?:limpar|apagar)\s+(?:número|numero|nº)/i.test(text)) this.fillInput(this.fields.numero, '', 'Número');
        if (/(?:limpar|apagar)\s+(?:complemento|apartamento|apto)/i.test(text)) this.fillInput(this.fields.complemento, '', 'Complemento');
        if (/(?:limpar|apagar)\s+cpf/i.test(text)) this.fillInput(this.fields.cpf, '', 'CPF');
        if (/(?:limpar|apagar)\s+(?:telefone|celular)/i.test(text)) {
            if (/telefone/i.test(text)) this.fillInput(this.fields.telefone, '', 'Telefone');
            if (/celular/i.test(text)) this.fillInput(this.fields.celular, '', 'Celular');
        }
        if (/(?:limpar|apagar)\s+(?:e-mail|email)/i.test(text)) this.fillInput(this.fields.email, '', 'E-mail');

        // Comando de Salvamento (Paciente, Profissional ou Serviço)
        if (/(salvar paciente|salvar profissional|salvar serviço|salvar item|salvar cadastro|pode salvar|gravar|gravar item|confirmar|salvar)/i.test(text)) {
            console.log('[OCC Voice] Comando de salvamento detectado.');
            let btnSalvar = null;
            if (isProfessionalView) btnSalvar = document.querySelector(this.fields.btnSaveProfessional);
            else if (isServiceView) btnSalvar = document.querySelector('#btnSaveService');
            else if (document.querySelector('#patientFormView') && !document.querySelector('#patientFormView').classList.contains('hidden')) {
                btnSalvar = document.querySelector(this.fields.btnSalvar);
            }
            
            if (btnSalvar) {
                btnSalvar.click();
                console.log('[VOICE] Botão Salvar acionado programaticamente.');
                this.stopListening();
                return;
            }
        }

        // Comando de Cancelar / Voltar
        if (/(cancelar paciente|cancelar profissional|cancelar serviço|cancelar item|cancelar cadastro|cancelar|fechar|voltar)/i.test(text)) {
            console.log('[OCC Voice] Comando de cancelar/voltar/fechar detectado.');
            let btnCancel = null;
            if (isProfessionalView) btnCancel = document.querySelector('#btnCancelProfessional');
            else if (isServiceView) btnCancel = document.querySelector('#btnCancelService');
            else if (document.querySelector('#patientFormView') && !document.querySelector('#patientFormView').classList.contains('hidden')) {
                btnCancel = document.querySelector('#btnCancelPatient');
            }

            if (btnCancel) {
                btnCancel.click();
                console.log('[VOICE] Botão Cancelar acionado programaticamente.');
                this.stopListening();
                return;
            }
        }

        // ====================================================================
        // COMANDOS DE FORMULÁRIO PROFISSIONAL
        // ====================================================================
        if (isProfessionalView) {
            
            // Foto de Perfil - Capturar
            if (/(capturar foto|tirar foto|capturar|abrir câmera|abrir camera)/i.test(text)) {
                const btnCapture = document.querySelector('#btnOpenModalCamera, #btnCapture, .btn-capture') || 
                                   Array.from(document.querySelectorAll('button')).find(b => b && b.textContent && b.textContent.trim().toLowerCase() === 'capturar');
                if (btnCapture) {
                    btnCapture.click();
                    console.log('[VOICE] Comando de Capturar Foto detectado.');
                }
            }

            // Foto de Perfil - Escolher Arquivo
            if (/(escolher foto|escolher imagem|escolher|selecionar foto|anexar foto)/i.test(text)) {
                const btnChoose = document.querySelector('#professionalPhotoUpload, #btnChoose, .btn-choose') || 
                                  Array.from(document.querySelectorAll('label')).find(l => l && l.textContent && l.textContent.trim().toLowerCase() === 'escolher');
                if (btnChoose) {
                    btnChoose.click();
                    console.log('[VOICE] Comando de Escolher Foto detectado.');
                }
            }

            // Especialidade
            if (text.includes('especialidade') || 
                /(periodontia|ortodontia|implantodontia|endodontia|odontopediatria|cirurgia|prótese|protese|dentística|dentistica|clínico|clinico)/i.test(text)) { 
                this.setSpecialtyByVoice(text); 
            }

            // Nome do Profissional
            const profNomeMatch = text.match(/(?:nome completo|nome|profissional|paciente|cadastrar)\s+(.*?)(?=\s+(?:celular|telefone|e-mail|email|tipo|clínico|clinico|especialista|ortodontista|status|ativo|inativo|comissão|comissao|taxa|atende|atendimento|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck|não atende|nao atende|especialidade|prótese|protese|dentística|dentistica|odontopediatria|endodontia|implantodontia|cirurgia|periodontia|cancelar|voltar)|$)/i);
            if (profNomeMatch && profNomeMatch[1].trim() && !/(?:limpar|apagar)/i.test(profNomeMatch[0])) {
                let nome = profNomeMatch[1].trim();
                nome = nome.replace(/^(o|a)\s+/i, '');
                if (nome) {
                    this.fillInput(this.fields.profNome, this.titleCase(nome), 'Nome do Profissional');
                }
            }

            // Celular
            const profCelularMatch = text.match(/(?:celular|telefone)\s+([0-9\-\s]+)/i);
            if (profCelularMatch && profCelularMatch[1] && !/(?:limpar|apagar)/i.test(profCelularMatch[0])) {
                let celRaw = profCelularMatch[1].replace(/\D/g, '');
                if (celRaw.length >= 10) {
                    this.fillInput(this.fields.profCelular, this.maskTelefone(celRaw), 'Celular do Profissional');
                }
            }

            // E-mail
            const profEmailMatch = text.match(/(?:e-mail|email)\s+(.*?)(?=\s+(?:celular|telefone|nome|profissional|tipo|clínico|clinico|especialista|ortodontista|status|ativo|inativo|comissão|comissao|taxa|atende|atendimento|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
            if (profEmailMatch && profEmailMatch[1].trim() && !/(?:limpar|apagar)/i.test(profEmailMatch[0])) {
                let email = profEmailMatch[1].trim().toLowerCase();
                email = email.replace(/\s+arroba\s+/g, '@').replace(/\s+ponto\s+/g, '.').replace(/\s+/g, '');
                if (email) {
                    this.fillInput(this.fields.profEmail, email, 'E-mail do Profissional');
                }
            }

            // Tipo
            // Ignora "clínico" se for seguido de "geral" para não confundir com a especialidade
            if (/(?:tipo\s+)(?:clínico|clinico)|\b(?:clínico|clinico)\b(?!\s+geral)/i.test(text)) {
                this.fillInput(this.fields.profTipo, 'Clinico', 'Tipo de Profissional (Clínico)');
            } else if (/(?:tipo\s+)?(?:especialista|ortodontista)/i.test(text)) {
                this.fillInput(this.fields.profTipo, 'Especialista', 'Tipo de Profissional (Especialista)');
            } else if (/(?:tipo\s+)?(?:protético|protetico)/i.test(text)) {
                this.fillInput(this.fields.profTipo, 'Protetico', 'Tipo de Profissional (Protético)');
            }

            // Especialidade
            const handleSpecialty = () => {
                let spokenText = '';
                
                // Primeiro tenta extrair tudo após "especialidade"
                const specialtyMatch = text.match(/especialidade\s+(.*?)(?=\s+(?:celular|telefone|e-mail|email|tipo|clínico|clinico|ortodontista|status|ativo|inativo|comissão|comissao|taxa|atende|atendimento|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck|não atende|nao atende|cancelar|voltar)|$)/i);
                if (specialtyMatch && specialtyMatch[1]) {
                    spokenText = specialtyMatch[1];
                } else {
                    // Fallback para palavras-chave diretas na frase
                    const directSpecialties = /(clínico geral|clinico geral|clínica geral|clinica geral|ortodontia|implantodontia|endodontia|periodontia|odontopediatria|cirurgia|prótese|protese|dentística|dentistica)/i;
                    const directMatch = text.match(directSpecialties);
                    if (directMatch) {
                        spokenText = directMatch[1];
                    }
                }

                if (spokenText) {
                    const selectEl = document.querySelector('#especialidade, select[name="especialidade"], #especialidadeProfissional'); 
                    if (!selectEl) {
                        console.warn('[VOICE] Combo de Especialidade não encontrado.');
                        return; 
                    }
                  
                    const clean = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim(); 
                    const cleanedSpoken = clean(spokenText); 
                    
                    for (let option of selectEl.options) { 
                        const cleanedOpt = clean(option.text); 
                        if (!cleanedOpt || option.value === "") continue; 
                        
                        // Verifica se a fala contém o nome da especialidade ou vice-versa 
                        if (cleanedSpoken.includes(cleanedOpt) || cleanedOpt.includes(cleanedSpoken)) { 
                            selectEl.value = option.value; 
                            selectEl.dispatchEvent(new Event('change', { bubbles: true })); 
                            selectEl.dispatchEvent(new Event('input', { bubbles: true })); 
                            console.log('[VOICE] Especialidade selecionada com sucesso:', option.text); 
                            return; 
                        } 
                    } 
                }
            };
            handleSpecialty();

            // Status
            if (/(?:status\s+)?inativo/i.test(text)) {
                this.fillInput(this.fields.profStatus, 'Inativo', 'Status do Profissional (Inativo)');
            } else if (/(?:status\s+)?ativo/i.test(text)) {
                this.fillInput(this.fields.profStatus, 'Ativo', 'Status do Profissional (Ativo)');
            }

            // Comissões (Unificada para Clínico e Especialista)
            function getCommissionInputs() { 
                const card = document.getElementById('comissionCard');
                let inputs = [];
                if (card) {
                    inputs = Array.from(card.querySelectorAll('input[type="number"]')) 
                                  .filter(i => i.offsetParent !== null && !i.id.toLowerCase().includes('taxa') && !i.id.toLowerCase().includes('imp')); 
                }
                return { 
                    especie: inputs[0] || document.querySelector('#comissionCE, #comissionEE'), 
                    cartao:  inputs[1] || document.querySelector('#comissionCC, #comissionEC'), 
                    pix:     inputs[2] || document.querySelector('#comissionCP, #comissionEP') 
                }; 
            }

            const commInputs = getCommissionInputs();

            // Espécie
            let valEsp = null;
            const espMatch = /(espécie|especie|ee|é é|e é|e e|ce|se)\s*(\d+(?:[\.,]\d+)?)/gi.exec(text);
            if (espMatch && espMatch[2]) {
                valEsp = espMatch[2].replace(',', '.');
                if (commInputs.especie) {
                    commInputs.especie.value = valEsp;
                    commInputs.especie.dispatchEvent(new Event('input', { bubbles: true }));
                    commInputs.especie.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[VOICE] Comissão Espécie preenchida com sucesso: ${valEsp}`);
                }
            }

            // Cartão
            let valCar = null;
            const carMatch = /(cartão|cartao|ec|cc)\s*(\d+(?:[\.,]\d+)?)/gi.exec(text);
            if (carMatch && carMatch[2]) {
                valCar = carMatch[2].replace(',', '.');
                if (commInputs.cartao) {
                    commInputs.cartao.value = valCar;
                    commInputs.cartao.dispatchEvent(new Event('input', { bubbles: true }));
                    commInputs.cartao.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[VOICE] Comissão Cartão preenchida com sucesso: ${valCar}`);
                }
            }

            // PIX (incluindo variações fonéticas comuns estendidas)
            let valPix = null;
            const pixMatch = /(pix|pixs|pixi|pics|picsi|pixie|pixel|peaks|pic|ep|cp)\s*(\d+(?:[\.,]\d+)?)/gi.exec(text);
            if (pixMatch && pixMatch[2]) {
                valPix = pixMatch[2].replace(',', '.');
                if (commInputs.pix) {
                    commInputs.pix.value = valPix;
                    commInputs.pix.dispatchEvent(new Event('input', { bubbles: true }));
                    commInputs.pix.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[VOICE] Comissão PIX preenchida com sucesso: ${valPix}`);
                }
            }

            // Se falou apenas "comissão X" (sem especificar tipo), preenche os 3
            const comissaoGeralMatch = text.match(/(?:comissão|comissao)\s+(\d+(?:[\.,]\d+)?)(?!\s+(?:espécie|especie|cartão|cartao|pix|pixi|peaks|pic|ee|é é|e é|e e|ce|se|ec|cc|ep|cp))/i);
            if (comissaoGeralMatch && comissaoGeralMatch[1] && !valEsp && !valCar && !valPix) {
                let val = comissaoGeralMatch[1].replace(',', '.');
                ['especie', 'cartao', 'pix'].forEach(key => {
                    if (commInputs[key]) {
                        commInputs[key].value = val;
                        commInputs[key].dispatchEvent(new Event('input', { bubbles: true }));
                        commInputs[key].dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`[VOICE] Comissão (Geral) preenchida com sucesso no campo ${key}: ${val}`);
                    }
                });
            }

            // Taxa
            const taxaMatch = /(taxa(?: deduzida| cartão| cartao)?)\s*(\d+(?:[\.,]\d+)?)/gi.exec(text);
            if (taxaMatch && taxaMatch[2]) {
                let valTaxa = taxaMatch[2].replace(',', '.');
                const taxaInput = document.querySelector('#comissionImp, #taxaDeducao');
                if (taxaInput) {
                    taxaInput.value = valTaxa;
                    taxaInput.dispatchEvent(new Event('input', { bubbles: true }));
                    taxaInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[VOICE] Comissão Taxa preenchida com sucesso: ${valTaxa}`);
                }
            }

            // Agenda Semanal (Dias de Atendimento com Sintaxe Natural de ... às ...)
            const handleAgenda = (dayRegex, dayNum, dayName) => {
                const dayMatch = text.match(dayRegex);
                if (dayMatch) {
                    const dayContext = text.substring(dayMatch.index);
                    
                    // Verifica se a intenção foi desmarcar (incluindo "não atende", "remover")
                    if (/(?:desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)\s+(?:segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)/i.test(dayMatch[0])) {
                        this.fillCheckbox(this.fields[`agendaDay${dayNum}`], false, `Agenda: ${dayName}`);
                        // Limpa os inputs correspondentes
                        this.fillInput(this.fields[`agendaDay${dayNum}Start`], '', `Agenda: ${dayName} (Início)`);
                        this.fillInput(this.fields[`agendaDay${dayNum}End`], '', `Agenda: ${dayName} (Fim)`);
                    } else {
                        // Marca o dia
                        this.fillCheckbox(this.fields[`agendaDay${dayNum}`], true, `Agenda: ${dayName}`);
                        
                        // Captura o trecho que pertence a este dia (até aparecer outro dia)
                        const nextDayMatch = dayContext.substring(dayMatch[0].length).match(/(?:segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)/i);
                        const specificContext = nextDayMatch ? dayContext.substring(0, dayMatch[0].length + nextDayMatch.index) : dayContext;
                        
                        // NOVO: Verifica Sintaxe Natural Contínua (ex: "de 18:00 às 20:00")
                        const timeRangeMatch = specificContext.match(/(?:de|das)\s*(\d{1,2}(?::\d{2})?)\s*(?:às|as|até|ate)\s*(\d{1,2}(?::\d{2})?)/i);
                        
                        if (timeRangeMatch) {
                            // Extrai Início do Range
                            let startTime = timeRangeMatch[1];
                            if (!startTime.includes(':')) startTime += ':00';
                            const sParts = startTime.split(':');
                            startTime = `${sParts[0].padStart(2, '0')}:${sParts[1].padStart(2, '0')}`;
                            this.fillInput(this.fields[`agendaDay${dayNum}Start`], startTime, `Agenda: ${dayName} (Início)`);
                            
                            // Extrai Fim do Range
                            let endTime = timeRangeMatch[2];
                            if (!endTime.includes(':')) endTime += ':00';
                            const eParts = endTime.split(':');
                            endTime = `${eParts[0].padStart(2, '0')}:${eParts[1].padStart(2, '0')}`;
                            this.fillInput(this.fields[`agendaDay${dayNum}End`], endTime, `Agenda: ${dayName} (Fim)`);
                        } else {
                            // Fallback: Busca isolada por "início X" e "fim/até Y"
                            const startMatch = specificContext.match(/início\s+(\d{1,2}(?::\d{2})?|\d{1,2}\s*horas)/i);
                            if (startMatch) {
                                let time = startMatch[1].replace(/\s*horas/i, ':00');
                                if (!time.includes(':')) time += ':00';
                                const parts = time.split(':');
                                time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                                this.fillInput(this.fields[`agendaDay${dayNum}Start`], time, `Agenda: ${dayName} (Início)`);
                            }
                            
                            const endMatch = specificContext.match(/(?:fim|término|termino|até|ate)\s+(\d{1,2}(?::\d{2})?|\d{1,2}\s*horas)/i);
                            if (endMatch) {
                                let time = endMatch[1].replace(/\s*horas/i, ':00');
                                if (!time.includes(':')) time += ':00';
                                const parts = time.split(':');
                                time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                                this.fillInput(this.fields[`agendaDay${dayNum}End`], time, `Agenda: ${dayName} (Fim)`);
                            }
                        }
                        
                        // Extrai Intervalo
                        const slotMatch = specificContext.match(/intervalo\s+(\d+)/i);
                        if (slotMatch) {
                            this.fillInput(this.fields[`agendaDay${dayNum}Slot`], slotMatch[1], `Agenda: ${dayName} (Intervalo)`);
                        }
                    }
                }
            };

            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:segunda-feira|segunda)/i, 1, 'Segunda-feira');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:terça-feira|terça)/i, 2, 'Terça-feira');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:quarta-feira|quarta)/i, 3, 'Quarta-feira');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:quinta-feira|quinta)/i, 4, 'Quinta-feira');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:sexta-feira|sexta)/i, 5, 'Sexta-feira');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*(?:sábado|sabado)/i, 6, 'Sábado');
            handleAgenda(/(?:marca|marcar|marque|check|atende|atendimento|desmarque|desmarcar|desmarca|uncheck|não atende|nao atende|remover)?\s*domingo/i, 7, 'Domingo');
            
            return; // Se processou como profissional, sai para não misturar com paciente
        }

        // ====================================================================
        // COMANDOS DE FORMULÁRIO DE SERVIÇOS / ESTOQUE
        // ====================================================================
        if (isServiceView) {
            // Descrição / Nome
            const descMatch = text.match(/(?:descrição|descricao|nome|serviço|servico)\s+(.*?)(?=\s+(?:subdivisão|subdivisao|categoria|valor|preço|preco|tipo|salvar|cancelar|fechar|voltar|limpar|apagar)|$)/i);
            if (descMatch && descMatch[1].trim() && !/(?:limpar|apagar)/i.test(descMatch[0])) {
                let desc = descMatch[1].trim();
                desc = desc.replace(/^(o|a)\s+/i, '');
                if (desc) {
                    this.fillInput('#servDescricao', this.titleCase(desc), 'Descrição do Serviço');
                }
            }

            // Subdivisão / Categoria
            const subMatch = text.match(/(?:subdivisão|subdivisao|categoria)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|valor|preço|preco|tipo|cálculo|calculo|especialidade|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck)|$)/i);
            if (subMatch && subMatch[1].trim() && !/(?:limpar|apagar)/i.test(subMatch[0])) {
                let sub = subMatch[1].trim();
                if (sub) {
                    this.fillInput('#servSubdivisaoLabel', this.titleCase(sub), 'Subdivisão/Categoria');
                }
            }

            // Valor / Preço
            const valorMatch = text.match(/(?:valor|preço|preco)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|subdivisão|subdivisao|categoria|tipo|cálculo|calculo|especialidade|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck)|$)/i);
            if (valorMatch && valorMatch[1].trim() && !/(?:limpar|apagar)/i.test(valorMatch[0])) {
                let val = valorMatch[1].trim();
                // Limpar e formatar o valor monetário
                val = val.replace(/[^\d,\.]/g, '').replace(/\./g, '').replace(',', '.');
                if (val && !isNaN(parseFloat(val))) {
                    let floatVal = parseFloat(val).toFixed(2);
                    let formattedVal = floatVal.replace('.', ',');
                    this.fillInput('#servValor', formattedVal, 'Valor/Preço');
                }
            }

            // Tipo (Combo)
            const tipoMatch = text.match(/(?:tipo|tipo de)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|subdivisão|subdivisao|categoria|valor|preço|preco|cálculo|calculo|especialidade|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck)|$)/i);
            
            let tipoVal = '';
            if (tipoMatch && tipoMatch[1].trim() && !/(?:limpar|apagar)/i.test(tipoMatch[0]) && !tipoMatch[0].toLowerCase().includes('cálculo') && !tipoMatch[0].toLowerCase().includes('calculo')) {
                tipoVal = tipoMatch[1].trim().toLowerCase();
            } else if (/(?:tipo\s+serviço|tipo\s+servico|serviço|servico)/i.test(text) && !/(?:limpar|apagar)/i.test(text)) {
                tipoVal = 'serviço';
            } else if (/(?:tipo\s+estoque|estoque)/i.test(text) && !/(?:limpar|apagar)/i.test(text)) {
                tipoVal = 'estoque';
            }

            if (tipoVal) {
                const selectTipo = document.querySelector('#servTipoIE');
                if (selectTipo) {
                    let matched = false;
                    for (let i = 0; i < selectTipo.options.length; i++) {
                        let optText = selectTipo.options[i].text.toLowerCase();
                        if (optText.includes(tipoVal) || tipoVal.includes(optText)) {
                            selectTipo.selectedIndex = i;
                            selectTipo.value = selectTipo.options[i].value;
                            selectTipo.dispatchEvent(new Event('change', { bubbles: true }));
                            selectTipo.dispatchEvent(new Event('input', { bubbles: true }));
                            console.log(`[VOICE] Tipo selecionado com sucesso: ${selectTipo.options[i].text}`);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        // Tentar fallback se disser 'serviço' -> 'I' ou 'estoque' -> 'E'
                        if (tipoVal.includes('estoque') || tipoVal.includes('material')) {
                            selectTipo.value = 'E';
                            selectTipo.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log(`[VOICE] Tipo (Estoque) selecionado por fallback.`);
                        } else if (tipoVal.includes('serviço') || tipoVal.includes('servico')) {
                            selectTipo.value = 'I';
                            selectTipo.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log(`[VOICE] Tipo (Serviço) selecionado por fallback.`);
                        }
                    }
                }
            }

            // Tipo de Cálculo
            const calcMatch = text.match(/(?:tipo de cálculo|cálculo|calculo|tipo cálculo|tipo calculo)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|subdivisão|subdivisao|categoria|valor|preço|preco|tipo|especialidade|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck|cheque|unchek|exige|existe|elemento)|$)/i);
            if (calcMatch && calcMatch[1].trim() && !/(?:limpar|apagar)/i.test(calcMatch[0])) {
                let calc = calcMatch[1].trim().toLowerCase();
                const selectCalc = document.querySelector('#servTipoCalculo');
                if (selectCalc) {
                    if (calc.includes('fixo')) {
                        selectCalc.value = 'Fixo';
                        selectCalc.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`[VOICE] Tipo de Cálculo selecionado: Fixo`);
                    } else if (calc.includes('elemento') || calc.includes('por elemento')) {
                        selectCalc.value = 'Por Elemento';
                        selectCalc.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`[VOICE] Tipo de Cálculo selecionado: Por Elemento`);
                    }
                }
            } else if (/(?:tipo de cálculo fixo|cálculo fixo|calculo fixo|tipo cálculo fixo|tipo calculo fixo)/i.test(text)) {
                 const selectCalc = document.querySelector('#servTipoCalculo');
                 if (selectCalc) {
                     selectCalc.value = 'Fixo';
                     selectCalc.dispatchEvent(new Event('change', { bubbles: true }));
                     console.log(`[VOICE] Tipo de Cálculo selecionado: Fixo (Fallback direto)`);
                 }
            } else if (/(?:tipo de cálculo por elemento|cálculo por elemento|calculo por elemento|tipo cálculo por elemento|tipo calculo por elemento)/i.test(text)) {
                 const selectCalc = document.querySelector('#servTipoCalculo');
                 if (selectCalc) {
                     selectCalc.value = 'Por Elemento';
                     selectCalc.dispatchEvent(new Event('change', { bubbles: true }));
                     console.log(`[VOICE] Tipo de Cálculo selecionado: Por Elemento (Fallback direto)`);
                 }
            }

            // Exige Elemento (Checkbox)
            if (/(?:marca|marcar|marque|check|cheque|habilita|habilitar)\s+(?:exige elemento|existe elemento|elemento|odontograma|exija elemento|exigir elemento)/i.test(text)) {
                const checkElemento = document.querySelector('#servExigeElemento');
                if (checkElemento && !checkElemento.checked) {
                    checkElemento.click();
                    console.log(`[VOICE] Checkbox Exige Elemento marcado.`);
                }
            }
            if (/(?:desmarque|desmarcar|desmarca|uncheck|unchek|desabilita|desabilitar)\s+(?:exige elemento|existe elemento|elemento|odontograma|exija elemento|exigir elemento)/i.test(text)) {
                const checkElemento = document.querySelector('#servExigeElemento');
                if (checkElemento && checkElemento.checked) {
                    checkElemento.click();
                    console.log(`[VOICE] Checkbox Exige Elemento desmarcado.`);
                }
            }

            // Especialidade
            const espMatch = text.match(/(?:especialidade)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|subdivisão|subdivisao|categoria|valor|preço|preco|tipo|cálculo|calculo|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck)|$)/i);
            if (espMatch && espMatch[1].trim() && !/(?:limpar|apagar)/i.test(espMatch[0])) {
                let esp = espMatch[1].trim();
                const selectEsp = document.querySelector('#servEspecialidade');
                if (selectEsp) {
                    const clean = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                    const cleanedSpoken = clean(esp);
                    
                    for (let i = 0; i < selectEsp.options.length; i++) {
                        const opt = selectEsp.options[i];
                        const cleanOptText = clean(opt.text);
                        
                        if (!cleanOptText || opt.value === "" || opt.disabled) continue;
                        
                        if (cleanedSpoken.includes(cleanOptText) || cleanOptText.includes(cleanedSpoken.replace('ESPECIALIDADE', '').trim())) {
                            selectEsp.selectedIndex = i;
                            selectEsp.value = opt.value;
                            selectEsp.dispatchEvent(new Event('change', { bubbles: true }));
                            selectEsp.dispatchEvent(new Event('input', { bubbles: true }));
                            console.log(`[VOICE] Especialidade selecionada com sucesso: ${opt.text}`);
                            
                            // Depois de setar especialidade, verifica se já havia tentado setar subdivisão antes na mesma frase
                            const subMatchAfter = text.match(/(?:subdivisão|subdivisao|categoria)\s+(.*?)(?=\s+(?:descrição|descricao|nome|serviço|servico|valor|preço|preco|tipo|cálculo|calculo|especialidade|salvar|cancelar|fechar|voltar|limpar|apagar|marque|marcar|check|desmarque|desmarcar|uncheck)|$)/i);
                            if (subMatchAfter && subMatchAfter[1].trim() && !/(?:limpar|apagar)/i.test(subMatchAfter[0])) {
                                let sub = subMatchAfter[1].trim();
                                if (sub) {
                                    this.fillInput('#servSubdivisaoLabel', this.titleCase(sub), 'Subdivisão/Categoria');
                                }
                            }
                            
                            break;
                        }
                    }
                }
            }

            // Apenas as limpezas de campos
            if (/(?:limpar|apagar)\s+(?:descrição|descricao|nome|serviço|servico)/i.test(text)) this.fillInput('#servDescricao', '', 'Descrição');
            if (/(?:limpar|apagar)\s+(?:subdivisão|subdivisao|categoria)/i.test(text)) this.fillInput('#servSubdivisaoLabel', '', 'Subdivisão');
            if (/(?:limpar|apagar)\s+(?:valor|preço|preco)/i.test(text)) this.fillInput('#servValor', '', 'Valor');

            return; // Se processou como serviço, sai para não misturar com paciente
        }

        // ====================================================================
        // COMANDOS DE FORMULÁRIO PACIENTE
        // ====================================================================

        // Extrai Nome: Pega o texto logo após paciente, nome, nome completo ou cadastrar até encontrar palavras delimitadoras
        const nomeMatch = text.match(/(?:nome completo|nome|paciente|profissional|cadastrar)\s+(.*?)(?=\s+(?:cep|número|numero|nº|cpf|complemento|apartamento|apto|nascimento|data|sexo|profissão|profissao|telefone|celular|e-mail|email|tratamento|medicação|alergia|hemorragia|doença|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck|cancelar|voltar)|$)/i);
        if (nomeMatch && nomeMatch[1].trim() && !/(?:limpar|apagar)/i.test(nomeMatch[0])) {
            let nome = nomeMatch[1].trim();
            nome = nome.replace(/^(o|a)\s+/i, ''); // remove artigos soltos
            if (nome) {
                this.fillInput(this.fields.nome, this.titleCase(nome), 'Nome');
            }
        }

        // Extrai CEP: Procura por sequência de dígitos após a palavra cep
        const cepMatch = text.match(/cep\s+([0-9\.\-\s]+)/i);
        if (cepMatch && cepMatch[1] && !/(?:limpar|apagar)/i.test(cepMatch[0])) {
            let cepRaw = cepMatch[1];
            let cepNum = cepRaw.replace(/\D/g, ''); // Limpa caracteres não numéricos
            if (cepNum.length >= 8) {
                cepNum = cepNum.substring(0, 8);
                this.fillInput(this.fields.cep, this.maskCEP(cepNum), 'CEP');
                
                // Evitar chamadas repetidas à API para o mesmo CEP na mesma sessão
                if (this.lastFetchedCep !== cepNum) {
                    this.lastFetchedCep = cepNum;
                    this.buscarViaCep(cepNum);
                }
            }
        }

        // Extrai Número: Extrai os números após a palavra número ou nº
        const numMatch = text.match(/(?:número|numero|nº)\s+([0-9\s]+)/i);
        if (numMatch && numMatch[1] && !/(?:limpar|apagar)/i.test(numMatch[0])) {
            let numeroRaw = numMatch[1].replace(/\s+/g, '');
            this.fillInput(this.fields.numero, numeroRaw, 'Número');
        }

        // Extrai Complemento
        const compMatch = text.match(/(?:apartamento|apto|complemento)\s+(.*?)(?=\s+(?:cep|número|numero|nº|cpf|nome|nascimento|data|sexo|profissão|profissao|telefone|celular|e-mail|email|tratamento|medicação|alergia|hemorragia|doença|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (compMatch && compMatch[1].trim() && !/(?:limpar|apagar)/i.test(compMatch[0])) {
            this.fillInput(this.fields.complemento, this.titleCase(compMatch[1].trim()), 'Complemento');
        }

        // Extrai CPF
        const cpfMatch = text.match(/cpf\s+([0-9\.\-\s]+)/i);
        if (cpfMatch && cpfMatch[1] && !/(?:limpar|apagar)/i.test(cpfMatch[0])) {
            let cpfNum = cpfMatch[1].replace(/\D/g, '');
            if (cpfNum.length >= 11) {
                cpfNum = cpfNum.substring(0, 11);
                if (this.isValidCPF(cpfNum)) {
                    this.fillInput(this.fields.cpf, this.maskCPF(cpfNum), 'CPF');
                } else {
                    console.warn(`[VOICE] CPF inválido ignorado: ${cpfNum}`);
                }
            }
        }

        // Extrai Data de Nascimento
        const nascMatch = text.match(/(?:nascimento|data de nascimento)\s+(.*?)(?=\s+(?:cep|número|numero|nº|cpf|complemento|apartamento|apto|sexo|profissão|profissao|telefone|celular|e-mail|email|tratamento|medicação|alergia|hemorragia|doença|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (nascMatch && nascMatch[1].trim()) {
            const parsedDate = this.parseDate(nascMatch[1].trim());
            if (parsedDate) {
                this.fillInput(this.fields.dataNascimento, parsedDate, 'Data de Nascimento');
            }
        }

        // Extrai Sexo
        if (/(?:sexo\s+)?(?:masculino|homem)/i.test(text)) {
            this.fillInput(this.fields.sexo, 'M', 'Sexo (Masculino)');
        } else if (/(?:sexo\s+)?(?:feminino|mulher)/i.test(text)) {
            this.fillInput(this.fields.sexo, 'F', 'Sexo (Feminino)');
        }

        // Extrai Profissão
        const profMatch = text.match(/(?:profissão|profissao)\s+(.*?)(?=\s+(?:cep|número|numero|nº|cpf|complemento|apartamento|apto|nascimento|data|sexo|telefone|celular|e-mail|email|tratamento|medicação|alergia|hemorragia|doença|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (profMatch && profMatch[1].trim()) {
            let profissaoTexto = this.titleCase(profMatch[1].trim());
            
            // Tenta dar match nas options existentes no select
            const profSelect = document.querySelector(this.fields.profissao);
            let foundOption = false;
            if (profSelect && profSelect.options) {
                for (let i = 0; i < profSelect.options.length; i++) {
                    if (profSelect.options[i].text.toLowerCase() === profissaoTexto.toLowerCase()) {
                        this.fillInput(this.fields.profissao, profSelect.options[i].value, 'Profissão');
                        foundOption = true;
                        break;
                    }
                }
            }
            if (!foundOption) {
                this.fillInput(this.fields.profissao, 'Outro', 'Profissão (Outro)');
                const outroInput = document.querySelector('#profissaoOutro');
                if (outroInput) {
                    outroInput.value = profissaoTexto;
                    outroInput.dispatchEvent(new Event('input', { bubbles: true }));
                    outroInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[VOICE] Campo Profissão (Outro) preenchido com: ${profissaoTexto}`);
                }
            }
        }

        // Extrai Telefone
        const telMatch = text.match(/telefone\s+([0-9\-\s]+)/i);
        if (telMatch && telMatch[1] && !/(?:limpar|apagar)/i.test(telMatch[0])) {
            let telNum = telMatch[1].replace(/\D/g, '');
            if (telNum.length >= 10) {
                this.fillInput(this.fields.telefone, this.maskTelefone(telNum), 'Telefone');
            }
        }

        // Extrai Celular
        const celMatch = text.match(/celular\s+([0-9\-\s]+)/i);
        if (celMatch && celMatch[1] && !/(?:limpar|apagar)/i.test(celMatch[0])) {
            let celNum = celMatch[1].replace(/\D/g, '');
            if (celNum.length >= 10) {
                this.fillInput(this.fields.celular, this.maskTelefone(celNum), 'Celular');
            }
        }

        // Extrai E-mail
        const emailMatch = text.match(/(?:e-mail|email)\s+(.*?)(?=\s+(?:cep|número|numero|nº|cpf|complemento|apartamento|apto|nascimento|data|sexo|profissão|profissao|telefone|celular|tratamento|medicação|alergia|hemorragia|doença|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (emailMatch && emailMatch[1].trim() && !/(?:limpar|apagar)/i.test(emailMatch[0])) {
            let emailText = emailMatch[1].trim().toLowerCase();
            emailText = emailText.replace(/\s+arroba\s+/g, '@').replace(/arroba/g, '@');
            emailText = emailText.replace(/\s+ponto\s+/g, '.').replace(/ponto/g, '.');
            emailText = emailText.replace(/\s+/g, '');
            this.fillInput(this.fields.email, emailText, 'E-mail');
        }

        // ====================================================================
        // COMANDOS LITERAIS PARA CHECKBOXES (Marcar / Desmarcar)
        // ====================================================================

        const marcarRegex = /(?:marca|marcar|marque|check)\s+(.*?)(?=\s+(?:marca|marcar|marque|check|desmarque|desmarcar|desmarca|uncheck|limpar|apagar|salvar)|$)/gi;
        const desmarcarRegex = /(?:desmarque|desmarcar|desmarca|uncheck)\s+(.*?)(?=\s+(?:marca|marcar|marque|check|desmarque|desmarcar|desmarca|uncheck|limpar|apagar|salvar)|$)/gi;

        let match;
        
        // 1. Processar todos os comandos de MARCAR
        while ((match = marcarRegex.exec(text)) !== null) {
            const comando = match[1].trim().toLowerCase();
            
            // Tratamento Médico
            if (comando.includes('está em tratamento médico') || comando.includes('esta em tratamento medico') || comando.includes('tratamento médico')) {
                this.fillCheckbox(this.fields.emTratamentoMedico, true, 'Tratamento Médico');
            }
            
            // Medicação
            if (comando.includes('toma alguma medicação') || comando.includes('toma alguma medicacao') || comando.includes('medicação regularmente')) {
                this.fillCheckbox(this.fields.tomaMedicacao, true, 'Toma Medicação');
            }
            
            // Alergia
            if (comando.includes('tem alergia a algum') || comando.includes('tem alergia')) {
                this.fillCheckbox(this.fields.temAlergia, true, 'Tem Alergia');
            }
            
            // Hemorragia
            if (comando.includes('já teve hemorragia') || comando.includes('ja teve hemorragia') || comando.includes('hemorragia')) {
                this.fillCheckbox(this.fields.teveHemorragia, true, 'Teve Hemorragia');
            }
            
            // Campanhas
            if (comando.includes('não receber campanhas') || comando.includes('nao receber campanhas')) {
                this.fillCheckbox(this.fields.naoReceberCampanhas, true, 'Não receber campanhas');
            }
        }

        // 2. Processar todos os comandos de DESMARCAR
        while ((match = desmarcarRegex.exec(text)) !== null) {
            const comando = match[1].trim().toLowerCase();
            
            // Tratamento Médico
            if (comando.includes('está em tratamento médico') || comando.includes('esta em tratamento medico') || comando.includes('tratamento médico')) {
                this.fillCheckbox(this.fields.emTratamentoMedico, false, 'Tratamento Médico');
                this.fillInput(this.fields.tratamentoDesc, '', 'Detalhes do Tratamento (Limpo)');
            }
            
            // Medicação
            if (comando.includes('toma alguma medicação') || comando.includes('toma alguma medicacao') || comando.includes('medicação regularmente')) {
                this.fillCheckbox(this.fields.tomaMedicacao, false, 'Toma Medicação');
            }
            
            // Alergia
            if (comando.includes('tem alergia a algum') || comando.includes('tem alergia')) {
                this.fillCheckbox(this.fields.temAlergia, false, 'Tem Alergia');
                this.fillInput(this.fields.alergiaDesc, '', 'Detalhes da Alergia (Limpo)');
            }
            
            // Hemorragia
            if (comando.includes('já teve hemorragia') || comando.includes('ja teve hemorragia') || comando.includes('hemorragia')) {
                this.fillCheckbox(this.fields.teveHemorragia, false, 'Teve Hemorragia');
            }
            
            // Campanhas
            if (comando.includes('não receber campanhas') || comando.includes('nao receber campanhas')) {
                this.fillCheckbox(this.fields.naoReceberCampanhas, false, 'Não receber campanhas');
            }
        }

        // ====================================================================
        // EXTRAÇÃO DE DETALHES PARA CHECKBOXES MARCADOS E PREENCHIMENTO AUTOMÁTICO
        // ====================================================================

        // Extrair texto do Tratamento
        const tratMatch = text.match(/(?:tratamento médico|tratamento medico|tratamento|em tratamento de)\s+(.*?)(?=\s+(?:alergia|medicação|medicacao|hemorragia|doença|doenças|observação|observações|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (tratMatch && tratMatch[1].trim()) {
            let tratamento = tratMatch[1].trim();
            tratamento = tratamento.replace(/\s+vírgula\s+/gi, ', '); // Tratamento para a palavra vírgula falada
            
            if (tratamento.toLowerCase() !== 'médico' && tratamento.toLowerCase() !== 'medico' && !tratamento.includes('atualmente')) {
                // Marca o checkbox e preenche o campo descritivo (concatenando)
                this.fillCheckbox(this.fields.emTratamentoMedico, true, 'Tratamento Médico');
                this.fillInput(this.fields.tratamentoDesc, this.titleCase(tratamento), 'Detalhes do Tratamento', true);
            }
        }

        // Extrair texto da Medicação
        const medicacaoMatch = text.match(/(?:toma medicação|toma medicações|toma medicacao|medicação|medicações|medicacao)\s+(.*?)(?=\s+(?:alergia|tratamento|hemorragia|doença|doenças|observação|observações|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (medicacaoMatch && medicacaoMatch[1].trim()) {
            let medicacaoTxt = medicacaoMatch[1].trim();
            medicacaoTxt = medicacaoTxt.replace(/\bvírgula\b/gi, ', '); // Tratamento para a palavra vírgula falada
            
            if (!medicacaoTxt.includes('regularmente') && medicacaoTxt.toLowerCase() !== 'regularmente') {
                // Marca o checkbox e preenche o campo descritivo (concatenando)
                this.fillCheckbox(this.fields.tomaMedicacao, true, 'Toma Medicação');
                this.fillInput(this.fields.medicacaoDesc, this.titleCase(medicacaoTxt), 'Detalhes da Medicação', true);
            }
        }

        // Extrair texto da Alergia
        const alergiaMatch = text.match(/alergia\s+(?:a|à|ao)?\s*(.*?)(?=\s+(?:tratamento|medicação|medicacao|hemorragia|doença|doenças|observação|observações|salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
        if (alergiaMatch && alergiaMatch[1].trim()) {
            let alergiaTxt = alergiaMatch[1].trim();
            alergiaTxt = alergiaTxt.replace(/\s+vírgula\s+/gi, ', '); // Tratamento para a palavra vírgula falada
            
            if (!alergiaTxt.includes('algum medicamento') && !alergiaTxt.includes('medicamento')) {
                // Marca o checkbox e preenche o campo descritivo (concatenando)
                this.fillCheckbox(this.fields.temAlergia, true, 'Tem Alergia');
                this.fillInput(this.fields.alergiaDesc, this.titleCase(alergiaTxt), 'Detalhes da Alergia', true);
            }
        }

        // Anamnese (Textarea de Doenças Preexistentes / Observações)
        if (/(?:limpar|apagar|remover)\s+(?:doenças|doença|observação|observações)/i.test(text)) {
            this.fillInput(this.fields.doencasPreexistentes, '', 'Doenças Preexistentes / Observações (Limpo)');
        } else {
            const doencaMatch = text.match(/(?:doenças preexistentes|doença preexistente|doenças|doença|observações|observação)\s+(.*?)(?=\s+(?:salvar|limpar|apagar|desmarcar|remover|marca|marcar|marque|check|desmarque|desmarca|uncheck)|$)/i);
            if (doencaMatch && doencaMatch[1].trim()) {
                let doencaTxt = doencaMatch[1].trim();
                doencaTxt = doencaTxt.replace(/\s+vírgula\s+/gi, ', '); // Tratamento para a palavra vírgula falada
                this.fillInput(this.fields.doencasPreexistentes, this.titleCase(doencaTxt), 'Doenças Preexistentes / Observações', true);
            }
        }
    }

    fillInput(selector, value, fieldName, append = false) {
        const el = document.querySelector(selector);
        // Injeção Direta nos Inputs com Disparo de Evento
        if (el) {
            // Lógica de Concatenação se append for true
            if (append && el.value.trim() && String(value).trim()) {
                // Evita concatenar exatamente a mesma palavra se a transcrição repetí-la no mesmo buffer
                if (!el.value.toLowerCase().includes(String(value).toLowerCase())) {
                    value = el.value.trim() + ', ' + value;
                } else {
                    value = el.value; // Mantém como estava
                }
            }
            
            // Normalização de Espaços e Vírgulas Duplas para campos de texto não-numéricos
            if (typeof value === 'string' && isNaN(Number(value))) {
                value = value.replace(/\s+/g, ' ').replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '').trim();
            }
            
            // Verifica diferença considerando tipos numéricos ou strings
            if (String(el.value) !== String(value)) {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[VOICE] Campo ${fieldName} preenchido com: ${value}`);
            }
        } else {
            console.warn(`[VOICE] Input ${fieldName} não encontrado no seletor:`, selector);
        }
    }

    fillCheckbox(selector, checked, fieldName) {
        const el = document.querySelector(selector);
        if (!el) {
            console.warn(`[VOICE] Elemento não encontrado: ${selector} (${fieldName})`);
            return;
        }

        // Garante que é o input do tipo checkbox (ou busca o input filho se o seletor for div/label)
        const inputEl = el.tagName === 'INPUT' ? el : el.querySelector('input[type="checkbox"]');
        const checkInput = inputEl || el;

        // Se o estado atual visual for diferente do estado desejado, simula o clique do usuário
        if (checkInput.checked !== checked) {
            checkInput.click(); // O .click() nativo força a interface visual a desenhar o xizinho
            console.log(`[VOICE] Checkbox ${fieldName} click() disparado para: ${checked}`);
        } else {
            // Força evento para reassegurar
            checkInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[VOICE] Checkbox ${fieldName} já estava: ${checked} (change re-emitido)`);
        }
    }

    isValidCPF(cpf) {
        if (typeof cpf !== 'string') return false;
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
        const cpfArr = cpf.split('').map(el => +el);
        const rest = (count) => (cpfArr.slice(0, count - 12).reduce((soma, el, index) => (soma + el * (count - index)), 0) * 10) % 11 % 10;
        return rest(10) === cpfArr[9] && rest(11) === cpfArr[10];
    }

    removeAcentos(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    titleCase(str) {
        return str.toLowerCase().split(' ').map(word => {
            return (word.length > 2) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
        }).join(' ');
    }

    maskCEP(value) {
        value = value.replace(/\D/g, "");
        value = value.replace(/^(\d{5})(\d)/, "$1-$2");
        return value;
    }

    maskCPF(value) {
        value = value.replace(/\D/g, "");
        value = value.replace(/(\d{3})(\d)/, "$1.$2");
        value = value.replace(/(\d{3})(\d)/, "$1.$2");
        value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        return value;
    }

    maskTelefone(value) {
        if (!value) return '';
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 10) {
            return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
        }
        return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
    }

    parseDate(dateStr) {
        // Tenta converter formatos como "15/05/1985" ou "15 de maio de 1985" para YYYY-MM-DD
        let day, month, year;
        
        // Formato numérico 15/05/1985
        const numMatch = dateStr.match(/(\d{1,2})[\/\-\s]+(\d{1,2})[\/\-\s]+(\d{4})/);
        if (numMatch) {
            day = numMatch[1].padStart(2, '0');
            month = numMatch[2].padStart(2, '0');
            year = numMatch[3];
            return `${year}-${month}-${day}`;
        }
        
        // Formato extenso "15 de maio de 1985"
        const meses = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
            'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
            'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        const extMatch = dateStr.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
        if (extMatch) {
            day = extMatch[1].padStart(2, '0');
            const mesNome = extMatch[2].toLowerCase();
            month = meses[mesNome];
            year = extMatch[3];
            if (month) return `${year}-${month}-${day}`;
        }
        
        return null;
    }

    async buscarViaCep(cep) {
        try {
            console.log(`[OCC Voice] Buscando ViaCEP para: ${cep}`);
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                this.fillInput(this.fields.endereco, data.logradouro || '', 'Endereço (ViaCEP)');
                this.fillInput(this.fields.bairro, data.bairro || '', 'Bairro (ViaCEP)');
                this.fillInput(this.fields.cidade, data.localidade || '', 'Cidade (ViaCEP)');
                this.fillInput(this.fields.uf, data.uf || '', 'UF (ViaCEP)');
                
                console.log('[OCC Voice] Endereço preenchido via ViaCEP com sucesso.');
            } else {
                console.log('[OCC Voice] CEP não encontrado no ViaCEP.');
            }
        } catch (error) {
            console.error('[OCC Voice] Erro ao buscar ViaCEP:', error);
        }
    }
}

// Expondo para o escopo global se necessário
window.OCCVoiceAssistant = OCCVoiceAssistant;
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
