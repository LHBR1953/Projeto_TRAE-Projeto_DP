

function openModelItemsConfigPrompt(modelId) {
    const mid = String(modelId || '').trim();
    const model = (usageModels || []).find(m => String(m && m.id || '') === mid) || null;
    const modelName = String(model && model.nome_modelo || 'Modelo de Uso');
    return new Promise((resolve) => {
        const prev = document.getElementById('stockModelEmptyPrompt');
        if (prev) prev.remove();
        const overlay = document.createElement('div');
        overlay.id = 'stockModelEmptyPrompt';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(15,23,42,0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '200010';
        overlay.innerHTML = `
            <div style="background:#fff; width:min(560px,94vw); border-radius:12px; box-shadow:0 18px 45px rgba(2,6,23,.28); padding:20px;">
                <h3 style="margin:0 0 8px 0; color:#0f172a;">Modelo sem itens</h3>
                <p style="margin:0 0 14px 0; color:#475569;">O serviço está vinculado ao modelo <strong>${modelName}</strong>, mas ele está vazio.</p>
                <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                    <button type="button" id="btnCfgModelItems" class="btn btn-primary">Configurar Itens deste Modelo</button>
                    <button type="button" id="btnSkipModelItems" class="btn btn-secondary">Concluir sem baixa</button>
                    <button type="button" id="btnCancelModelItems" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const finish = (result) => {
            overlay.remove();
            resolve(result);
        };
        const btnCfg = document.getElementById('btnCfgModelItems');
        const btnSkip = document.getElementById('btnSkipModelItems');
        const btnCancel = document.getElementById('btnCancelModelItems');
        if (btnCfg) btnCfg.onclick = () => {
            estoqueActiveModelId = mid;
            setActiveTab('stockModels');
            setTimeout(() => {
                renderUsageModelsTable();
                renderModelItemsEditor();
            }, 60);
            finish({ ok: false, reason: 'configure_model' });
        };
        if (btnSkip) btnSkip.onclick = () => finish({ ok: true, skipped: true });
        if (btnCancel) btnCancel.onclick = () => finish({ ok: false, reason: 'cancelled' });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish({ ok: false, reason: 'cancelled' }); });
    });
}

function validateFiscalConfigForNfe() {
    const fc = getFinancialFiscalConfig();
    const issues = [];
    if (!String(fc.razao_social || '').trim()) issues.push('Razão Social');
    const cnpjDigits = String(fc.cnpj || '').replace(/\D/g, '');
    if (cnpjDigits.length !== 14) issues.push('CNPJ válido');
    if (!String(fc.inscricao_municipal || '').trim()) issues.push('Inscrição Municipal');
    if (!String(fc.regime_tributario || '').trim()) issues.push('Regime Tributário');
    if (!String(fc.codigo_servico || '').trim()) issues.push('Código de Serviço');
    if (!String(fc.cidade || '').trim()) issues.push('Cidade da Clínica');
    if (!String(fc.uf || '').trim()) issues.push('UF da Clínica');
    return { ok: issues.length === 0, issues, fiscal: fc };
}