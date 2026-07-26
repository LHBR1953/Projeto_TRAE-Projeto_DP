const supabaseUrl = 'https://trcktinwjpvcikidrryn.supabase.co';
const supabaseKey = 'sb_publishable_mSHjTPSylV1NFy4G-GPEhQ_r97v7CCA';
const db = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;
let cachedPlanos = [];

function maskCell(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  const ddd = digits.slice(0, 2);
  const part1 = digits.slice(2, 7);
  const part2 = digits.slice(7, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 7) return `(${ddd}) ${part1}`;
  return `(${ddd}) ${part1}-${part2}`;
}

function maskCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function lazyLoadHeroVideo() {
  const video = document.getElementById('heroVideo');
  if (!video) return;

  const videosAttr = video.getAttribute('data-videos');
  if (!videosAttr) return;
  
  const videoList = videosAttr.split(',').map(s => s.trim()).filter(Boolean);
  if (videoList.length === 0) return;

  let currentIndex = 0;
  let loopCount = 0;

  const loadAndPlay = () => {
    video.src = videoList[currentIndex];
    video.playbackRate = 0.5; // Reduz a velocidade para 50%
    try { video.load(); } catch { }
    try {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { }
    
    // Controle inicial da visibilidade: Garante que o texto esteja visível no primeiro play
    const heroText = document.querySelector('.lp-hero-inner');
    const heroScrim = document.querySelector('.lp-hero-scrim');
    const heroGlow1 = document.querySelector('.lp-glow');
    const heroGlow2 = document.querySelector('.lp-glow-2');
    
    if (heroText && currentIndex === 0) {
      heroText.style.display = 'grid';
      setTimeout(() => {
        heroText.style.opacity = '1';
        heroText.style.pointerEvents = 'auto';
        if (heroScrim) heroScrim.style.opacity = '1';
        if (heroGlow1) heroGlow1.style.opacity = '0.95';
        if (heroGlow2) heroGlow2.style.opacity = '0.92';
      }, 50);
    }
  };

  const load = () => {
    if (video.__occLoaded) return;
    video.__occLoaded = true;

    video.addEventListener('ended', () => {
      currentIndex++;
      if (currentIndex >= videoList.length) {
        currentIndex = 0; // Volta para o primeiro vídeo
        loopCount++;
      }

      // Lógica de visibilidade do texto da Hero Section
      const heroText = document.querySelector('.lp-hero-inner');
      const heroScrim = document.querySelector('.lp-hero-scrim');
      const heroGlow1 = document.querySelector('.lp-glow');
      const heroGlow2 = document.querySelector('.lp-glow-2');
      
      if (heroText) {
        // Exibe o texto sempre que for o primeiro vídeo
        if (currentIndex === 0) {
          heroText.style.display = 'grid'; // Retorna ao fluxo normal
          // Pequeno atraso para a transição de opacidade funcionar após o display
          setTimeout(() => {
            heroText.style.opacity = '1';
            heroText.style.pointerEvents = 'auto';
            if (heroScrim) heroScrim.style.opacity = '1';
            if (heroGlow1) heroGlow1.style.opacity = '0.95';
            if (heroGlow2) heroGlow2.style.opacity = '0.92';
          }, 50);
          
          // AQUI É O PONTO CORRETO DO AUTO-SCROLL: Quando voltamos ao índice 0!
          // Inicia o auto-scroll (vitrine) EXATAMENTE após o segundo vídeo (quando dá o primeiro loop)
          if (loopCount === 1) {
            console.log("Transição após o 2º vídeo detectada! Iniciando vitrine...");
            if (typeof window.startAutoScroll === 'function') {
              console.log("Preparando AutoScroll...");
              // Delay um pouco maior para garantir que tudo foi renderizado
              setTimeout(() => {
                console.log("Chamando window.startAutoScroll()...");
                window.startAutoScroll();
              }, 600);
            } else {
              console.error("ERRO: window.startAutoScroll não é uma função!");
            }
          }

        } else {
          heroText.style.opacity = '0';
          heroText.style.pointerEvents = 'none';
          if (heroScrim) heroScrim.style.opacity = '0';
          if (heroGlow1) heroGlow1.style.opacity = '0';
          if (heroGlow2) heroGlow2.style.opacity = '0';
          
          // Remove o elemento do fluxo após a transição de opacidade (0.5s) para que o conteúdo abaixo suba
          setTimeout(() => {
            if (currentIndex !== 0) { // Garante que não mudou de ideia no meio tempo
              heroText.style.display = 'none';
            }
          }, 500);
        }
      }

      loadAndPlay();
    });

    video.addEventListener('error', () => {
      console.error('Erro ao carregar o vídeo:', videoList[currentIndex]);
      currentIndex++;
      if (currentIndex >= videoList.length) {
        currentIndex = 0;
      }
      // Tenta o próximo vídeo após uma breve pausa para evitar loop infinito
      setTimeout(loadAndPlay, 1000);
    });

    loadAndPlay();
  };

  const start = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(load, { timeout: 1400 });
    } else {
      setTimeout(load, 260);
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '200px' });
    io.observe(video);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
  });
}

function initTrialModal() {
  const backdrop = document.getElementById('trialModalBackdrop');
  const btnOpen = document.getElementById('btnOpenTrial');
  const btnOpen2 = document.getElementById('btnOpenTrial2');
  const btnClose = document.getElementById('btnCloseTrial');
  const form = document.getElementById('trialForm');
  const inputCell = document.getElementById('trialCell');
  const btnSubmit = document.getElementById('btnSubmitTrial');
  const boxErr = document.getElementById('trialError');
  const boxOk = document.getElementById('trialResult');
  const progressWrap = document.getElementById('trialProgressWrap');
  const progressBar = document.getElementById('trialProgressBar');
  const progressText = document.getElementById('trialProgressText');
  const termsBox = document.getElementById('occTermosBox');
  const chkTerms = document.getElementById('chk_termos_occ');
  let progressTimer = null;
  const REQUIRED_FIELDS_ERROR = 'Por favor, preencha todos os campos obrigatórios para continuar.';

  if (!backdrop || !btnOpen || !btnClose || !form) return;

  if (termsBox && chkTerms) {
    termsBox.addEventListener('scroll', () => {
      if (termsBox.scrollTop + termsBox.clientHeight >= termsBox.scrollHeight - 5) {
        chkTerms.disabled = false;
      }
    });
  }

  const normalizePlanValue = (value) => String(value || '').trim().toLowerCase();
  const getDefaultTrialPlanValue = () => {
    const preferred = (cachedPlanos || []).find(p => {
      const tipo = normalizePlanValue(p && p.tipo_assinatura);
      return tipo === 'trial' || tipo === 'trail';
    });
    return String(preferred && preferred.tipo_assinatura || '');
  };
  const resolveTrialPlanOptionValue = (selectedPlan = '') => {
    const planEl = document.getElementById('trialPlan');
    if (!planEl) return '';
    const target = normalizePlanValue(selectedPlan);
    if (!target) return '';
    const options = Array.from(planEl.options || []);
    const exact = options.find(opt => normalizePlanValue(opt.value) === target);
    if (exact) return exact.value;
    const fuzzy = options.find(opt => normalizePlanValue(opt.textContent) === target);
    return fuzzy ? fuzzy.value : '';
  };
  const clearFieldInvalidState = (field) => {
    if (!field) return;
    field.style.border = '';
    field.style.outline = '';
    field.style.boxShadow = '';
  };
  const markFieldInvalid = (field) => {
    if (!field) return;
    field.style.border = '2px solid #ef4444';
    field.style.outline = 'none';
    field.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.2)';
  };
  const focusInvalidField = (field) => {
    if (!field) return;
    setTimeout(() => {
      try { field.focus(); } catch { }
    }, 100);
  };
  const validateRequiredTrialFields = () => {
    const requiredFields = [
      document.getElementById('trialClinicName'),
      document.getElementById('trialEmail'),
      document.getElementById('trialCell'),
      document.getElementById('trialPlan'),
      document.getElementById('trialPassword'),
      document.getElementById('chk_termos_occ')
    ];
    requiredFields.forEach(clearFieldInvalidState);

    const firstInvalid = requiredFields.find(field => {
      if (!field) return false;
      if (field.type === 'checkbox') return !field.checked;
      return !String(field.value || '').trim();
    });

    if (!firstInvalid) return true;
    markFieldInvalid(firstInvalid);
    setErr(REQUIRED_FIELDS_ERROR);
    focusInvalidField(firstInvalid);
    return false;
  };
  const open = (selectedPlan = '') => {
    backdrop.style.display = 'flex';
    if (boxErr) boxErr.style.display = 'none';
    if (boxOk) boxOk.style.display = 'none';
    
    if (chkTerms) {
      chkTerms.checked = false;
      chkTerms.disabled = true;
    }
    if (termsBox) {
      termsBox.scrollTop = 0;
    }

    const planEl = document.getElementById('trialPlan');
    if (planEl) {
      const resolvedPlan = resolveTrialPlanOptionValue(selectedPlan || getDefaultTrialPlanValue());
      if (resolvedPlan) planEl.value = resolvedPlan;
    }
    
    const modalTitle = document.getElementById('trialModalTitle');
    if (modalTitle) {
      const activePlan = String((planEl && planEl.value) || selectedPlan || '').trim();
      const isTrial = activePlan.toUpperCase() === 'TRIAL' || activePlan.toUpperCase() === 'TRAIL';
      modalTitle.textContent = isTrial ? 'Criar clínica e testar por 30 dias' : 'Criar clínica';
    }

    const first = document.getElementById('trialClinicName');
    if (first) first.focus();
  };
  const close = () => { backdrop.style.display = 'none'; };

  btnOpen.addEventListener('click', () => open(getDefaultTrialPlanValue()));
  if (btnOpen2) btnOpen2.addEventListener('click', () => open(getDefaultTrialPlanValue()));
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.style.display === 'flex') close();
  });

  if (inputCell) {
    inputCell.addEventListener('input', (e) => {
      e.target.value = maskCell(e.target.value);
      clearFieldInvalidState(e.target);
      if (boxErr && boxErr.textContent === REQUIRED_FIELDS_ERROR) {
        boxErr.textContent = '';
        boxErr.style.display = 'none';
      }
    });
  }
  const trialEmailInput = document.querySelector('#trialEmail') || document.querySelector('input[name="email"]');
  if (trialEmailInput && !trialEmailInput.__occDuplicateEmailBound) {
    trialEmailInput.__occDuplicateEmailBound = true;
    trialEmailInput.addEventListener('input', () => {
      clearTrialEmailErrorState();
      if (boxErr && boxErr.textContent === REQUIRED_FIELDS_ERROR) {
        boxErr.textContent = '';
        boxErr.style.display = 'none';
      }
    });
  }
  ['trialClinicName', 'trialPlan', 'trialPassword', 'chk_termos_occ'].forEach((id) => {
    const field = document.getElementById(id);
    if (!field || field.__occRequiredFieldBound) return;
    field.__occRequiredFieldBound = true;
    const eventName = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      clearFieldInvalidState(field);
      if (boxErr && boxErr.textContent === REQUIRED_FIELDS_ERROR) {
        boxErr.textContent = '';
        boxErr.style.display = 'none';
      }
    });
  });

  const setErr = (msg) => {
    if (!boxErr) return;
    boxErr.textContent = String(msg || 'Erro desconhecido');
    boxErr.style.display = 'block';
  };
  const clearTrialEmailErrorState = () => {
    const emailInput = document.querySelector('#trialEmail') || document.querySelector('input[name="email"]');
    if (emailInput) {
      emailInput.style.border = '';
      emailInput.style.outline = '';
      emailInput.style.boxShadow = '';
    }
  };
  const isDuplicateLinkedEmailError = (msg) => {
    const text = String(msg || '').toLowerCase();
    return text.includes('já está vinculado a uma clínica')
      || text.includes('já possui cadastro no sistema')
      || text.includes('already been registered')
      || text.includes('already registered')
      || text.includes('already exists')
      || text.includes('user already registered')
      || text.includes('email rate limit exceeded');
  };
  function tratarErroEmailDuplicado() {
    const emailInput = document.querySelector('#trialEmail') || document.querySelector('#empresaEmail') || document.querySelector('input[name="email"]');
    const errorDiv = document.querySelector('#trialError') || document.querySelector('#empresaModalError') || document.querySelector('.error-message');

    if (errorDiv) {
      errorDiv.textContent = 'Seu usuário já está vinculado a uma clínica. Entre com outro usuário';
      errorDiv.style.display = 'block';
    }

    if (emailInput) {
      emailInput.value = '';
      emailInput.style.border = '2px solid #ef4444';
      emailInput.style.outline = 'none';
      emailInput.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.2)';
      setTimeout(() => emailInput.focus(), 100);
    }
  }
  const setOk = (msg) => {
    if (!boxOk) return;
    boxOk.textContent = String(msg || '');
    boxOk.style.display = 'block';
  };
  const setProgress = (pct, text) => {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = `${p}%`;
    if (progressText) progressText.textContent = String(text || 'Processando...');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateRequiredTrialFields()) return;
    if (!db) {
      setErr('Não foi possível conectar ao servidor. Verifique internet/bloqueio de CDN e tente novamente.');
      return;
    }
    const prevBtnText = btnSubmit ? String(btnSubmit.textContent || '') : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Criando...';
    }
    setProgress(6, 'Iniciando cadastro...');
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      const current = progressBar ? Number(String(progressBar.style.width || '0').replace('%', '')) : 0;
      if (current >= 90) return;
      setProgress(current + 2, 'Processando cadastro da clínica...');
    }, 350);
    if (boxErr) boxErr.style.display = 'none';
    if (boxOk) boxOk.style.display = 'none';

    const nome = String((document.getElementById('trialClinicName') || {}).value || '').trim();
    const email = String((document.getElementById('trialEmail') || {}).value || '').trim().toLowerCase();
    const celular = String((document.getElementById('trialCell') || {}).value || '').trim();
    const planoTipo = String((document.getElementById('trialPlan') || {}).value || '').trim();
    const password = String((document.getElementById('trialPassword') || {}).value || '');

    if (!nome || !email || !celular || !password || !planoTipo || !(chkTerms && chkTerms.checked)) {
      setErr(REQUIRED_FIELDS_ERROR);
      if (btnSubmit) btnSubmit.disabled = false;
      return;
    }

    try {
      let signedIn = false;
      setProgress(18, 'Validando acesso...');
      const signUp = await db.auth.signUp({ email, password });
      if (signUp.error) {
        const signIn = await db.auth.signInWithPassword({ email, password });
        if (signIn.error) throw signIn.error;
        signedIn = true;
      } else {
        signedIn = Boolean(signUp.data && signUp.data.session);
        if (!signedIn) {
          const signIn = await db.auth.signInWithPassword({ email, password });
          if (signIn.error) throw signIn.error;
          signedIn = true;
        }
      }

      if (!signedIn) throw new Error('Não foi possível iniciar sessão. Verifique o e-mail.');

      setProgress(55, 'Configurando clínica e plano...');
      const { data, error } = await db.functions.invoke('self-onboard-company', {
        body: { nome, email, celular: celular || null, plano_tipo: planoTipo, tipo_assinatura: planoTipo }
      });
      if (error) throw error;
      setProgress(95, 'Finalizando e liberando acesso...');
      const empresaId = data && data.empresa_id ? String(data.empresa_id) : '';
      const status = String(data && data.assinatura_status || '').toUpperCase();
      if (status === 'TRIAL') {
        setOk(`Clínica criada com sucesso.\nEmpresa: ${empresaId || '—'}\nEntrando no OCC...`);
        if (btnSubmit) btnSubmit.textContent = 'Entrando...';
        setTimeout(() => {
          setProgress(100, 'Acesso liberado. Redirecionando...');
          try { backdrop.style.display = 'none'; } catch { }
          window.location.assign('/app.html');
        }, 600);
      } else {
        setProgress(100, 'Pedido recebido.');
        setOk(`Recebemos seu pedido para o ${planoTipo}!\nEstamos aguardando a confirmação do pagamento para liberar seu acesso.`);
        try { await db.auth.signOut(); } catch { }
      }
    } catch (err) {
      let msg = err && err.message ? String(err.message) : 'Falha ao criar o trial.';
      try {
        const ctx = err && err.context ? err.context : null;
        if (ctx && typeof ctx.json === 'function') {
          const j = await ctx.json();
          if (j && (j.error || j.message)) msg = String(j.error || j.message);
        } else if (ctx && typeof ctx.text === 'function') {
          const raw = await ctx.text();
          if (raw) {
            const j = JSON.parse(raw);
            if (j && (j.error || j.message)) msg = String(j.error || j.message);
          }
        }
      } catch { }
      if (isDuplicateLinkedEmailError(msg)) {
        tratarErroEmailDuplicado();
      } else {
        setErr(msg);
      }
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = prevBtnText || 'Criar e Entrar';
      }
      if (progressWrap && (!boxOk || boxOk.style.display !== 'block')) progressWrap.style.display = 'none';
    }
  });

  window.__openTrialModalWithPlan = (plan) => open(String(plan || ''));
}

function splitModulesText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n|;|\||,/g)
    .map(x => String(x || '').trim())
    .filter(Boolean);
}

function parsePlanDisplayValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderPlanosCards(planos) {
  const container = document.getElementById('plansContainer');
  const trialPlan = document.getElementById('trialPlan');
  if (!container || !trialPlan) return;
  const list = Array.isArray(planos) ? [...planos].sort((a, b) => parsePlanDisplayValue(a && a.valor_plano) - parsePlanDisplayValue(b && b.valor_plano)) : [];
  trialPlan.innerHTML = '<option value="">Selecione um plano</option>';

  if (!list.length) {
    container.innerHTML = `
      <div class="lp-plan">
        <h3>Sem planos configurados</h3>
        <div class="lp-price">--</div>
        <ul><li>Consulte o administrador do sistema.</li></ul>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(p => {
    const tipo = String(p && p.tipo_assinatura || '').trim() || 'Plano';
    const legenda = String(p && p.legenda_comercial || '').trim();
    const legendaHtml = legenda ? `<div style="font-size: 0.95rem; color: #64748b; font-weight: 500; margin-top: 4px; margin-bottom: 12px; text-align: left;">${legenda}</div>` : '';
    const valor = String(p && p.valor_plano || '').trim() || '-';
    const modulos = splitModulesText(p && p.modulos_texto);
    const itens = modulos.length ? modulos : ['Plano OCC'];
    const destaque = !!(p && p.destaque);
    const border = destaque ? 'border-color:#1d4ed8; box-shadow: 0 20px 72px rgba(29,78,216,0.20);' : '';
    return `
      <div class="lp-plan" style="${border}">
        <h3>${tipo}</h3>
        ${legendaHtml}
        <div class="lp-price">${valor}</div>
        <ul>${itens.map(i => `<li>${i}</li>`).join('')}</ul>
        <div style="margin-top:14px;">
          <button type="button" class="lp-btn lp-btn-primary js-plan-signup" data-plan="${tipo}" style="width:100%;">Assinar</button>
        </div>
      </div>
    `;
  }).join('');

  trialPlan.innerHTML += list.map(p => {
    const tipo = String(p && p.tipo_assinatura || '').trim();
    return `<option value="${tipo}">${tipo}</option>`;
  }).join('');

  container.querySelectorAll('.js-plan-signup').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = String(btn.getAttribute('data-plan') || '').trim();
      if (typeof window.__openTrialModalWithPlan === 'function') {
        window.__openTrialModalWithPlan(plan);
      }
    });
  });
}

async function loadPlanosConfig() {
  if (!db) return;
  try {
    const { data, error } = await db
      .from('config_planos')
      .select('id,tipo_assinatura,legenda_comercial,valor_plano,modulos_texto,destaque')
      .order('destaque', { ascending: false })
      .order('tipo_assinatura', { ascending: true });
    if (error) throw error;
    cachedPlanos = Array.isArray(data) ? data : [];
    renderPlanosCards(cachedPlanos);
  } catch {
    renderPlanosCards([]);
  }
}

function initAccessModal() {
  const backdrop = document.getElementById('accessModalBackdrop');
  const btnOpen = document.getElementById('btnPatientPortal');
  const btnClose = document.getElementById('btnCloseAccess');
  const btnBack = document.getElementById('btnBackAccess');
  const btnVerify = document.getElementById('btnVerifyAccess');
  const form = document.getElementById('accessForm');
  const inputCpf = document.getElementById('accessCpf');
  const inputPhone = document.getElementById('accessPhone');
  const inputToken = document.getElementById('accessToken');
  
  const step1 = document.getElementById('step1Access');
  const step2 = document.getElementById('step2Access');

  let generatedToken = '';

  if (!backdrop || !btnOpen || !btnClose || !form || !inputCpf) return;

  const open = () => {
    backdrop.style.display = 'flex';
    inputCpf.value = '';
    if (inputPhone) inputPhone.value = '';
    if (inputToken) inputToken.value = '';
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    setTimeout(() => inputCpf.focus(), 50);
  };
  const close = () => { backdrop.style.display = 'none'; };

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.style.display === 'flex') close();
  });

  inputCpf.addEventListener('input', (e) => {
    e.target.value = maskCpf(e.target.value);
  });
  
  if (inputPhone) {
    inputPhone.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
      e.target.value = v;
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cleanCpf = inputCpf.value.replace(/\D/g, '');
    const cleanPhone = inputPhone ? inputPhone.value.replace(/\D/g, '') : '';
    
    if (cleanCpf.length !== 11) {
      alert('Por favor, informe um CPF válido.');
      return;
    }
    if (cleanPhone.length < 10) {
      alert('Por favor, informe um telefone válido.');
      return;
    }
    
    // Simulate Token Generation and WhatsApp sending
    generatedToken = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Token de Acesso Gerado:", generatedToken);
    alert(`[Simulação] Um token de acesso foi enviado para o WhatsApp ${inputPhone.value}.\n\nToken para teste: ${generatedToken}`);
    
    step1.style.display = 'none';
    step2.style.display = 'block';
    setTimeout(() => inputToken.focus(), 50);
  });

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
    });
  }

  if (btnVerify) {
    btnVerify.addEventListener('click', () => {
      const token = inputToken.value.trim();
      if (token !== generatedToken) {
        alert('Token inválido. Tente novamente.');
        return;
      }
      const cleanCpf = inputCpf.value.replace(/\D/g, '');
      window.location.href = `/app.html?mode=patient&id=${cleanCpf}&token=${token}`;
    });
  }
}

lazyLoadHeroVideo();
initTrialModal();
initAccessModal();
loadPlanosConfig();

function initNavLinks() {
  const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
  anchors.forEach(a => {
    a.addEventListener('click', (e) => {
      const href = String(a.getAttribute('href') || '');
      const id = href.replace(/^#/, '');
      const target = document.getElementById(id);
      if (!id || !target) return;
      e.preventDefault();
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        location.hash = href;
      }
    });
  });
}

initNavLinks();
