
let professionals = [];
let professionalImpExceptionSignature = '';
const navProfessionals = document.getElementById('navProfessionals');
const professionalListView = document.getElementById('professionalListView');
const professionalFormView = document.getElementById('professionalFormView');

// Professional DOM Elements
const btnAddNewProfessional = document.getElementById('btnAddNewProfessional');
const btnBackProfessional = document.getElementById('btnBackProfessional');
const btnCancelProfessional = document.getElementById('btnCancelProfessional');
const professionalForm = document.getElementById('professionalForm');
const professionalsTableBody = document.getElementById('professionalsTableBody');
const professionalEmptyState = document.getElementById('professionalEmptyState');
const searchProfessionalInput = document.getElementById('searchProfessionalInput');
const professionalFormTitle = document.getElementById('professionalFormTitle');
const btnFatMensalProfissional = document.getElementById('btnFatMensalProfissional');
const movDiariaProfessional = document.getElementById('movDiariaProfessional');
const fechamentoDiarioProfessional = document.getElementById('fechamentoDiarioProfessional');
const fechamentoDiarioFullProfessional = document.getElementById('fechamentoDiarioFullProfessional');
const commProfessional = document.getElementById('commProfessional');
const commTransferNewProfessional = document.getElementById('commTransferNewProfessional');
const commReworkDebitProfessional = document.getElementById('commReworkDebitProfessional');
const commReworkCreditProfessional = document.getElementById('commReworkCreditProfessional');
const btnSaveProfessional = document.getElementById('btnSaveProfessional');

// Photo Upload Elements
const professionalPhotoCapture = document.getElementById('professionalPhotoCapture');
const professionalPhotoUpload = document.getElementById('professionalPhotoUpload');

async function printFaturamentoMensalProfissionalCross(year) {
    let comRows = [];
    try {
        const { data, error } = await withTimeout(
            db.from('financeiro_comissoes')
                .select('profissional_id,valor_comissao,status,data_pagamento,data_geracao')
                .eq('empresa_id', currentEmpresaId)
                .in('status', ['PAGA', 'ANTECIPADA'])
                .order('data_pagamento', { ascending: true }),
            20000,
            'cross_profissional:financeiro_comissoes'
        );
        if (error) throw error;
        comRows = Array.isArray(data) ? data : [];
    } catch (err) {
        showToast(`Falha ao carregar comissões: ${err && err.message ? err.message : 'erro'}`, true);
        return;
    }
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const map = new Map();
    const monthTotals = Array(12).fill(0);
    let grandTotal = 0;
    comRows.forEach((r) => {
        const raw = r && (r.data_pagamento || r.data_geracao);
        const dt = raw ? new Date(raw) : null;
        if (!dt || !Number.isFinite(dt.getTime())) return;
        if (dt.getUTCFullYear() !== year && dt.getFullYear() !== year) return;
        const month = dt.getMonth();
        const profSeq = String(r && r.profissional_id || '').trim();
        const name = profSeq ? getProfessionalNameBySeqId(profSeq) : 'Sem profissional';
        if (!map.has(name)) map.set(name, { name, months: Array(12).fill(0), total: 0 });
        const row = map.get(name);
        const val = toDec(r && r.valor_comissao, 0);
        row.months[month] += val;
        row.total += val;
        monthTotals[month] += val;
        grandTotal += val;
    });
    const rows = Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const html = buildCrossTableHtml({
        title: `Faturamento Mensal`,
        subtitle: `Cross table por profissional (Comissões PAGA + ANTECIPADA) • Ano ${year}`,
        entityLabel: 'Profissional',
        monthLabels,
        rows,
        monthTotals,
        grandTotal
    });
    const ok = openOCCReportPrintWindowFromLegacyHtml({ reportName: `Faturamento Mensal - Profissional (${year})`, legacyHtml: html, width: 1200, height: 780 });
    if (!ok) return;
}

function findProfessionalByAnyId(v) {
    if (v == null) return null;
    const raw = String(v);
    const num = Number(raw);
    const byId = (professionals || []).find(p => String(p.id) === raw);
    if (byId) return byId;
    if (Number.isFinite(num)) {
        const bySeq = (professionals || []).find(p => Number(p.seqid) === num);
        if (bySeq) return bySeq;
    }
    const bySeqStr = (professionals || []).find(p => String(p.seqid) === raw);
    return bySeqStr || null;
}

const budItemProfissionalId = document.getElementById('budItemProfissionalId');

async function createAndLinkProvisionalProfessional(ctx) {
    const empresaId = ctx && ctx.empresaId ? String(ctx.empresaId) : '';
    const usuarioId = ctx && ctx.usuarioId ? String(ctx.usuarioId) : '';
    const role = ctx && ctx.role ? String(ctx.role) : '';
    const email = ctx && ctx.email ? String(ctx.email) : '';
    if (!empresaId || !usuarioId) throw new Error('Dados insuficientes para vínculo do profissional.');

    const modal = document.getElementById('modalVinculoProfissional');
    const form = document.getElementById('formVinculoProfissional');
    const vpEmpresaId = document.getElementById('vpEmpresaId');
    const vpUsuarioId = document.getElementById('vpUsuarioId');
    const vpRole = document.getElementById('vpRole');
    const vpEmailLogin = document.getElementById('vpEmailLogin');
    const vpNome = document.getElementById('vpNomeProfissional');
    const vpTipo = document.getElementById('vpTipoProfissional');
    const btn = document.getElementById('btnVincularProfissional');

    if (!modal || !form || !vpEmpresaId || !vpUsuarioId || !vpRole || !vpEmailLogin || !vpNome || !vpTipo || !btn) {
        throw new Error('Tela de vínculo do profissional não disponível.');
    }

    vpEmpresaId.value = empresaId;
    vpUsuarioId.value = usuarioId;
    vpRole.value = role;
    vpEmailLogin.value = email;
    vpNome.value = '';

    if (role === 'protetico') {
        vpTipo.value = 'Protetico';
        vpTipo.disabled = true;
    } else {
        vpTipo.disabled = false;
        vpTipo.value = 'Especialista';
    }

    modal.classList.remove('hidden');
    
    const btnCancel = document.getElementById('btnCancelVinculoProfissional');
    if (btnCancel) {
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
            const r = form.__vpResolve;
            form.__vpResolve = null;
            if (typeof r === 'function') r(false);
        };
    }

    return new Promise((resolve) => {
        form.__vpResolve = resolve;
        if (form.__vpSubmitBound) return;
        form.__vpSubmitBound = true;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = String(vpNome.value || '').trim();
            const tipo = String(vpTipo.value || '').trim();
            if (!nome) {
                showToast('Informe o nome do profissional.', true);
                return;
            }
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Vinculando...';
            try {
                const empresaId2 = String(vpEmpresaId.value || '').trim();
                const usuarioId2 = String(vpUsuarioId.value || '').trim();
                const email2 = String(vpEmailLogin.value || '').trim();
                if (!empresaId2 || !usuarioId2) throw new Error('Dados insuficientes para vínculo do profissional.');

                let nextSeq = null;
                if (empresaId2 === currentEmpresaId) {
                    nextSeq = getNextSeqId(professionals);
                } else {
                    const q = db.from('profissionais')
                        .select('seqid')
                        .eq('empresa_id', empresaId2)
                        .order('seqid', { ascending: false })
                        .limit(1);
                    const { data, error } = await withTimeout(q, 15000, 'profissionais:max_seqid');
                    if (error) throw error;
                    const maxSeq = data && data[0] && data[0].seqid != null ? Number(data[0].seqid) : 0;
                    nextSeq = (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
                }

                const profData = {
                    id: generateId(),
                    seqid: nextSeq,
                    nome: `[INCOMPLETO] ${nome}`,
                    celular: '',
                    email: null,
                    tipo,
                    especialidadeid: null,
                    status: 'Ativo',
                    empresa_id: empresaId2,
                };
                const { data: created, error: insErr } = await withTimeout(
                    db.from('profissionais').insert(profData).select().single(),
                    20000,
                    'profissionais:provisorio:insert'
                );
                if (insErr) throw insErr;
                const profId = String((created && created.id) ? created.id : profData.id);

                const { error: linkErr } = await withTimeout(
                    db.from('profissional_usuarios').upsert(
                        { empresa_id: empresaId2, usuario_id: usuarioId2, profissional_id: profId },
                        { onConflict: 'empresa_id,usuario_id' }
                    ),
                    20000,
                    'profissional_usuarios:upsert'
                );
                if (linkErr) throw linkErr;

                if (created && empresaId2 === currentEmpresaId) {
                    professionals.push(created);
                }

                try {
                    await saveAgendaDisponibilidade(Number((created && created.seqid) ? created.seqid : profData.seqid), empresaId2);
                } catch { }

                modal.classList.add('hidden');
                const r = form.__vpResolve;
                form.__vpResolve = null;
                if (typeof r === 'function') r(true);
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'Erro desconhecido';
                showToast(`Falha ao criar/vincular profissional: ${msg}`, true);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="ri-link"></i> Criar e Vincular';
            }
        });
    });
}

function updateProfessionalImpSuggestedHint() {
    const hint = document.getElementById('comissionImpSuggestedHint');
    if (!hint) return;
    const taxa = getFinancialParamsTaxaUnica();
    const base = `Taxa Sugerida pelo Sistema: ${formatNumberBR(taxa, 0)}%`;
    hint.dataset.baseText = base;
    hint.textContent = base;
}

function syncProfessionalImpExceptionFromCurrent(markAsAcknowledged = false) {
    const input = document.getElementById('comissionImp');
    if (!input) return;
    const suggested = getFinancialParamsTaxaUnica();
    const entered = toDec(input.value, 0);
    if (suggested <= 0 || Math.abs(entered - suggested) < 0.0001) {
        professionalImpExceptionSignature = '';
        setProfessionalImpExceptionVisual(false);
        return;
    }
    if (markAsAcknowledged) {
        professionalImpExceptionSignature = getProfessionalImpSignature(entered, suggested);
    }
    setProfessionalImpExceptionVisual(true);
}

function ensureProfessionalImpWarningModal() {
    let modal = document.getElementById('professionalImpWarningModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'professionalImpWarningModal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(15,23,42,0.62)';
    modal.style.zIndex = '10050';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = `
        <div style="width:min(860px, 96vw); max-height:88vh; overflow:auto; background:#fff; border-radius:14px; border:1px solid #fecaca; padding:16px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div style="font-size:24px;">⚠️</div>
                <div style="font-size:18px; font-weight:900; color:#991b1b;">⚠️ Atenção: Perigo na Margem de Retenção!</div>
            </div>
            <div id="professionalImpWarningBody" style="font-size:13px; color:#334155; line-height:1.45;"></div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
                <button type="button" id="btnImpKeepSuggested" class="btn btn-secondary">Manter Taxa Sugerida</button>
                <button type="button" id="btnImpProceedAware" class="btn btn-warning">Estou ciente, prosseguir</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function maybeWarnProfessionalImpDeviation(fromSubmit = false) {
    const input = document.getElementById('comissionImp');
    if (!input) return true;
    const suggested = getFinancialParamsTaxaUnica();
    const entered = toDec(input.value, 0);
    if (suggested <= 0) return true;
    if (Math.abs(entered - suggested) < 0.0001) {
        professionalImpExceptionSignature = '';
        setProfessionalImpExceptionVisual(false);
        return true;
    }
    const sig = getProfessionalImpSignature(entered, suggested);
    if (professionalImpExceptionSignature === sig) {
        setProfessionalImpExceptionVisual(true);
        return true;
    }
    const modal = ensureProfessionalImpWarningModal();
    const body = document.getElementById('professionalImpWarningBody');
    const btnKeep = document.getElementById('btnImpKeepSuggested');
    const btnProceed = document.getElementById('btnImpProceedAware');
    if (body) {
        if (entered < suggested) {
            body.innerHTML = `
                <p><strong>Se você cadastrar 10% de abatimento em vez dos ${formatNumberBR(suggested, 0)}% sugeridos:</strong></p>
                <p>No Sistema: O lucro líquido do dentista sobe artificialmente, pois ele deixa de 'pagar' pela estrutura que utiliza.</p>
                <p>Na Realidade: Se o imposto real é 5,65% e a taxa média de operação (Cartão/PIX/Custos) é de 12,35%, ao cobrar apenas 10% do dentista, você está retendo NEGATIVO.</p>
                <p><strong>Cálculo Real: (10% cobrados - 5,65% imposto - 12,35% custos) = -8%.</strong></p>
                <p>Visão Distorcida: Você terá a ilusão de que a clínica está faturando bem, mas na verdade, a clínica está pagando para o dentista trabalhar, pois a retenção de 10% não cobre sequer o custo variável real da operação.</p>
                <p><strong>Visão Distorcida:</strong> O Dashboard pode mostrar que você está no azul, mas na hora de pagar o aluguel (Custo Fixo), o dinheiro não aparece, porque aquela 'gordura' de 12,35% que discutimos sumiu.</p>
            `;
        } else {
            body.innerHTML = `
                <p>Você está usando uma taxa de Imp diferente da Taxa Sugerida pelo Sistema.</p>
                <p><strong>Taxa informada:</strong> ${formatNumberBR(entered, 2)}% | <strong>Taxa sugerida:</strong> ${formatNumberBR(suggested, 2)}%</p>
                <p>Isso pode distorcer comparativos de margem e retenção no Dashboard.</p>
            `;
        }
    }
    if (btnKeep) btnKeep.onclick = () => {
        input.value = String(suggested);
        professionalImpExceptionSignature = '';
        setProfessionalImpExceptionVisual(false);
        modal.style.display = 'none';
    };
    if (btnProceed) btnProceed.onclick = () => {
        professionalImpExceptionSignature = sig;
        setProfessionalImpExceptionVisual(true);
        modal.style.display = 'none';
        if (fromSubmit) {
            try { professionalForm.requestSubmit(); } catch { }
        }
    };
    modal.style.display = 'flex';
    return false;
}

function applyDefaultImpToProfessionalForm(force = false) {
    const input = document.getElementById('comissionImp');
    if (!input) return;
    const current = String(input.value || '').trim();
    if (!force && current) return;
    if (!financialParamsCache) {
        fetchCurrentCompanyFinancialParams().then((p) => {
            financialParamsCache = p;
            const now = String(input.value || '').trim();
            if (!force && now) return;
            const taxaAsync = getFinancialParamsTaxaUnica(p);
            if (taxaAsync > 0) input.value = String(taxaAsync);
        }).catch(() => { });
    }
    const taxa = getFinancialParamsTaxaUnica();
    if (taxa > 0) input.value = String(taxa);
    updateProfessionalImpSuggestedHint();
}
