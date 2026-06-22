

async function openSpecialtyImportModal() {
    if (!isSuperAdmin || !specialtyImportModal) {
        showToast('Apenas SuperAdmin pode importar especialidades.', true);
        return;
    }
    if (!specialtyImportModal.dataset.bound) {
        if (btnCloseSpecialtyImportModal) btnCloseSpecialtyImportModal.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        if (btnCancelSpecialtyImport) btnCancelSpecialtyImport.addEventListener('click', () => specialtyImportModal.classList.add('hidden'));
        specialtyImportModal.addEventListener('click', (e) => { if (e.target === specialtyImportModal) specialtyImportModal.classList.add('hidden'); });
        if (btnSpecialtyImportParse) btnSpecialtyImportParse.addEventListener('click', () => parseSpecialtyImportFile());
        if (btnSubdivisionImportParse) btnSubdivisionImportParse.addEventListener('click', () => parseSubdivisionImportFile());
        if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.addEventListener('click', () => confirmSpecialtyImport());
        if (btnConfirmSubdivisionImport) btnConfirmSubdivisionImport.addEventListener('click', () => confirmSubdivisionImport());
        if (btnExportSpecialtyXlsx) btnExportSpecialtyXlsx.addEventListener('click', () => exportSpecialtiesXlsx());
        if (btnExportSubdivisionXlsx) btnExportSubdivisionXlsx.addEventListener('click', () => exportSubdivisionsXlsx());
        specialtyImportModal.dataset.bound = '1';
    }
    if (specialtyImportStatus) specialtyImportStatus.textContent = '';
    if (subdivisionImportStatus) subdivisionImportStatus.textContent = '';
    if (specialtyImportPreviewWrap) specialtyImportPreviewWrap.classList.add('hidden');
    if (subdivisionImportPreviewWrap) subdivisionImportPreviewWrap.classList.add('hidden');
    if (specialtyImportPreviewBody) specialtyImportPreviewBody.innerHTML = '';
    if (subdivisionImportPreviewBody) subdivisionImportPreviewBody.innerHTML = '';
    if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.disabled = true;
    if (btnConfirmSubdivisionImport) btnConfirmSubdivisionImport.disabled = true;
    window.__specialtyImportRows = [];
    window.__subdivisionImportRows = [];
    specialtyImportModal.classList.remove('hidden');
}

function extractLeadingSpecialtyCode(text) {
    const s = String(text || '').trim();
    const m = s.match(/^[^\d]*(\d+)\s*[-.)]?\s*/);
    return m ? String(m[1]) : '';
}

async function parseSpecialtyImportFile() {
    try {
        if (!specialtyImportFile || !specialtyImportFile.files || !specialtyImportFile.files[0]) {
            showToast('Selecione um arquivo XLSX.', true);
            return;
        }
        const file = specialtyImportFile.files[0];
        if (specialtyImportStatus) specialtyImportStatus.textContent = 'Lendo arquivo...';
        const rows = await readXlsxToRowArrays(file);
        const skipHeader = specialtyImportSkipHeader ? Boolean(specialtyImportSkipHeader.checked) : true;
        const parsed = parseImportValues(rows, skipHeader, ['nome', 'especialidade', 'especialidade_nome']);
        const uniqSpecs = new Set(parsed);
        window.__specialtyImportRows = parsed;

        if (specialtyImportPreviewBody) {
            const preview = parsed.slice(0, 200).map(x => `
                <tr>
                    <td>${escapeHtml(x)}</td>
                </tr>
            `).join('');
            specialtyImportPreviewBody.innerHTML = preview || '<tr><td style="text-align:center; padding: 14px; color:#6b7280;">Nenhuma linha válida.</td></tr>';
        }
        if (specialtyImportPreviewWrap) specialtyImportPreviewWrap.classList.remove('hidden');
        if (btnConfirmSpecialtyImport) btnConfirmSpecialtyImport.disabled = parsed.length === 0;
        if (specialtyImportStatus) {
            specialtyImportStatus.textContent = [
                `Linhas válidas: ${parsed.length}`,
                `Especialidades (únicas): ${uniqSpecs.size}`,
                'Coluna usada: nome (ou coluna A)'
            ].join('\n');
        }
    } catch (e) {
        const msg = e && e.message ? String(e.message) : 'Erro ao ler XLSX.';
        if (specialtyImportStatus) specialtyImportStatus.textContent = msg;
        showToast(msg, true);
    }
}

async function confirmSpecialtyImport() {
    if (!isSuperAdmin) { showToast('Apenas SuperAdmin.', true); return; }
    let parsed = Array.isArray(window.__specialtyImportRows) ? window.__specialtyImportRows : [];
    if (!parsed.length && specialtyImportFile && specialtyImportFile.files && specialtyImportFile.files[0]) {
        await parseSpecialtyImportFile();
        parsed = Array.isArray(window.__specialtyImportRows) ? window.__specialtyImportRows : [];
    }
    if (!parsed.length) { showToast('Nenhuma linha para importar.', true); return; }
    const empresaId = getEffectiveImportEmpresaId();
    if (!empresaId) { showToast('Empresa inválida.', true); return; }

    if (specialtyImportStatus) specialtyImportStatus.textContent = 'Carregando estado atual...';

    const { data: existingSpecs, error: sErr } = await withTimeout(
        db.from(getDbTable('especialidades')).select('id,nome,seqid').eq('empresa_id', empresaId),
        20000,
        'specImport:especialidades'
    );
    if (sErr) { showToast('Falha ao carregar especialidades.', true); return; }

    const specByKey = new Map();
    let maxSeq = 0;
    (existingSpecs || []).forEach(s => {
        const key = String(s.nome || '').trim().toUpperCase();
        if (!key) return;
        specByKey.set(key, { id: String(s.id), seqid: Number(s.seqid || 0), nome: key });
        if (Number(s.seqid || 0) > maxSeq) maxSeq = Number(s.seqid || 0);
    });
    let createdSpecs = 0;
    let skipped = 0;

    for (const row of parsed) {
        const specKey = String(row || '').trim().toUpperCase();
        if (!specKey) continue;

        let spec = specByKey.get(specKey);
        if (!spec) {
            maxSeq += 1;
            const specData = { id: generateId(), seqid: maxSeq, nome: specKey, empresa_id: empresaId };
            const { data: ins, error } = await withTimeout(
                db.from(getDbTable('especialidades')).insert(specData).select('id,seqid,nome').single(),
                20000,
                'specImport:insertEspecialidade'
            );
            if (error) throw error;
            spec = { id: String(ins.id), seqid: Number(ins.seqid || specData.seqid), nome: String(ins.nome || specKey) };
            specByKey.set(specKey, spec);
            createdSpecs += 1;
        } else {
            skipped += 1;
        }
    }

    if (specialtyImportStatus) {
        specialtyImportStatus.textContent = [
            `Especialidades criadas: ${createdSpecs}`,
            `Duplicados ignorados: ${skipped}`
        ].join('\n');
    }
    try {
        if (String(currentEmpresaId || '') !== String(empresaId || '')) {
            await switchCompany(String(empresaId));
        } else {
            await initializeApp(true);
        }
    } catch {
        await refreshSpecialtiesGridForEmpresa(empresaId);
    }
    showList('specialties');
    showToast(`Importação de especialidades concluída. Criadas: ${createdSpecs}.`);
}
const specialtyFormView = document.getElementById('specialtyFormView');

// Specialty DOM Elements
const btnNewSpecialty = document.getElementById('btnNewSpecialty');
const btnBackSpecialty = document.getElementById('btnBackSpecialty');
const btnCancelSpecialty = document.getElementById('btnCancelSpecialty');
const specialtyForm = document.getElementById('specialtyForm');
const specialtyEmptyState = document.getElementById('specialtyEmptyState');
const specialtyFormTitle = document.getElementById('specialtyFormTitle');

const specialtyImportModal = document.getElementById('specialtyImportModal');
const btnCloseSpecialtyImportModal = document.getElementById('btnCloseSpecialtyImportModal');
const btnCancelSpecialtyImport = document.getElementById('btnCancelSpecialtyImport');
const specialtyImportFile = document.getElementById('specialtyImportFile');
const specialtyImportSkipHeader = document.getElementById('specialtyImportSkipHeader');
const btnSpecialtyImportParse = document.getElementById('btnSpecialtyImportParse');
const specialtyImportStatus = document.getElementById('specialtyImportStatus');
const specialtyImportPreviewWrap = document.getElementById('specialtyImportPreviewWrap');
const specialtyImportPreviewBody = document.getElementById('specialtyImportPreviewBody');
const btnConfirmSpecialtyImport = document.getElementById('btnConfirmSpecialtyImport');
const btnExportSpecialtyXlsx = document.getElementById('btnExportSpecialtyXlsx');
const subdivisionImportTargetSpecialty = document.getElementById('subdivisionImportTargetSpecialty');
// Active State
let currentSpecialtySubdivisions = [];
let deletedSpecialtySubdivisionIds = new Set();