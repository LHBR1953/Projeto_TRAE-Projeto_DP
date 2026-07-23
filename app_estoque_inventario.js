(function () {
    if (window.__occStockReportsPatchLoaded) return;
    window.__occStockReportsPatchLoaded = true;

    // Reutiliza a instância global já criada pelo monólito; evita redeclaração global.
    var db = window.db || window.supabase;
    void db;

    function restoreSupabaseOriginalFrom(client) {
        if (!client || !client.__occUsuariosAliasPatched || typeof client.__occOriginalFrom !== 'function') return;
        try {
            client.from = client.__occOriginalFrom;
        } catch { }
        try { delete client.__occOriginalFrom; } catch { client.__occOriginalFrom = null; }
        try { delete client.__occUsuariosAliasPatched; } catch { client.__occUsuariosAliasPatched = false; }
    }

    function ensureSupabaseClientIsNative() {
        try { restoreSupabaseOriginalFrom(window.supabase); } catch (err) {
            console.warn('Erro isolado ao restaurar client nativo no window.supabase:', err);
        }
        try { restoreSupabaseOriginalFrom(window.db); } catch (err) {
            console.warn('Erro isolado ao restaurar client nativo no window.db:', err);
        }
        try { restoreSupabaseOriginalFrom(db); } catch (err) {
            console.warn('Erro isolado ao restaurar client nativo no patch:', err);
        }
    }

    ensureSupabaseClientIsNative();

    function ensureMainAppContainersVisible() {
        var targets = [
            document.documentElement,
            document.body,
            document.getElementById('app'),
            document.getElementById('main-content'),
            document.getElementById('wrapper')
        ];
        targets.forEach(function (el) {
            if (!el) return;
            try {
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
            } catch { }
            try {
                var computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
                if (computed && String(computed.visibility || '').toLowerCase() === 'hidden') {
                    el.style.setProperty('visibility', 'visible', 'important');
                }
                if (computed && String(computed.opacity || '') === '0') {
                    el.style.setProperty('opacity', '1', 'important');
                }
                if (computed && String(computed.display || '').toLowerCase() === 'none') {
                    el.style.setProperty('display', el === document.documentElement || el === document.body ? 'block' : 'block', 'important');
                }
            } catch { }
        });
    }

    function runPatchSafely(label, fn) {
        try {
            return typeof fn === 'function' ? fn() : null;
        } catch (err) {
            console.warn('Erro isolado no patch de estoque (' + String(label || 'execucao') + '):', err);
            try { ensureMainAppContainersVisible(); } catch { }
            return null;
        }
    }

    function hasSuperAdminEmailInDom() {
        var selectors = [
            '#userEmail',
            '.sidebar-footer',
            '.profile-footer',
            '.user-info',
            '.user-profile',
            '.sidebar'
        ];
        for (var i = 0; i < selectors.length; i += 1) {
            var el = document.querySelector(selectors[i]);
            var text = String(el && el.textContent || '').trim().toLowerCase();
            if (text.indexOf('lhbr@lhbr.com.br') >= 0 || text.indexOf('lhbr') >= 0) {
                return true;
            }
        }
        return false;
    }

    function hasSuperAdminEmailInStorage() {
        var keys = ['user_email', 'email', 'currentUser', 'usuarioLogado', 'auth_user', 'supabase.auth.token'];
        try {
            for (var i = 0; i < keys.length; i += 1) {
                var raw = localStorage.getItem(keys[i]);
                var normalized = String(raw || '').trim().toLowerCase();
                if (!normalized) continue;
                if (normalized.indexOf('lhbr@lhbr.com.br') >= 0 || normalized.indexOf('"email":"lhbr@lhbr.com.br"') >= 0) {
                    return true;
                }
            }
        } catch { }
        return false;
    }

    function ensureSuperAdminStockStyles() {
        if (!document.head) return;
        var styleEl = document.getElementById('occ-super-admin-stock-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'occ-super-admin-stock-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = ''
            + '#navEstoqueSubmenu .nav-item,'
            + '#navEstoqueSubmenu a,'
            + '#navEstoqueSubmenu .nav-subitem,'
            + '.stock-submenu .nav-item,'
            + '.stock-submenu .nav-subitem{'
            + 'pointer-events:auto !important;'
            + 'cursor:pointer !important;'
            + 'position:relative !important;'
            + 'z-index:9999 !important;'
            + '}';
    }

    function stripStockHiddenInlineStyles() {
        var ids = ['navEstoqueToggle', 'navInventory', 'navUsageModels', 'navInventoryLogs', 'navInventoryReports', 'navServiceMapping'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            try {
                el.style.removeProperty('display');
                el.style.removeProperty('visibility');
                el.style.removeProperty('opacity');
            } catch { }
            forceVisible(el, 'flex');
        });
    }

    function isAbsoluteSuperAdmin() {
        var superAdminEmail = 'lhbr@lhbr.com.br';
        var currentEmail = String(window.currentUser && window.currentUser.email || '').trim().toLowerCase();
        var usuarioLogadoEmail = String(window.usuarioLogado && window.usuarioLogado.email || '').trim().toLowerCase();
        var localStorageEmail = '';
        try {
            localStorageEmail = String(localStorage.getItem('user_email') || '').trim().toLowerCase();
        } catch { }
        return currentEmail === superAdminEmail
            || usuarioLogadoEmail === superAdminEmail
            || localStorageEmail === superAdminEmail
            || hasSuperAdminEmailInDom()
            || hasSuperAdminEmailInStorage();
    }

    function syncAbsoluteSuperAdminFlag() {
        var active = isAbsoluteSuperAdmin();
        window.__occAbsoluteSuperAdmin = active;
        if (!active) return false;
        try { isSuperAdmin = true; } catch { }
        try { window.isSuperAdmin = true; } catch { }
        window.__occPatchForcedSuperAdmin = true;
        try { ensureSuperAdminStockStyles(); } catch { }
        return true;
    }

    var aliases = {
        agenda: ['agenda', 'Agenda'],
        atendimento: ['atendimento', 'Atendimento'],
        pacientes: ['pacientes', 'Pacientes'],
        estoque: [
            'estoque',
            'Estoque',
            'estoque_inventario',
            'Estoque: Inventário',
            'estoque_modelos',
            'Estoque: Modelos',
            'Estoque: Modelos de Uso',
            'estoque_vinculos',
            'Estoque: Vínculo de Serviços',
            'estoque_movimentacoes',
            'Estoque: Movimentações',
            'estoque_relatorios',
            'Estoque: Relatórios'
        ],
        estoque_inventario: ['estoque_inventario', 'Estoque: Inventário'],
        estoque_modelos: ['estoque_modelos', 'Estoque: Modelos', 'Estoque: Modelos de Uso'],
        estoque_movimentacoes: ['estoque_movimentacoes', 'Estoque: Movimentações'],
        estoque_relatorios: ['estoque_relatorios', 'Estoque: Relatórios'],
        estoque_vinculos: [
            'estoque_vinculos',
            'estoque_vinculo_servicos',
            'Estoque: Vinculo de Serviços',
            'Estoque: Vínculo de Serviços'
        ]
    };

    var stockMenuItems = [
        {
            key: 'inventory',
            tab: 'stockInventory',
            permKey: 'estoque_inventario',
            label: 'Inventário',
            icon: 'ri-database-2-line',
            permissionKeys: [
                'Estoque: Inventário',
                'estoque_inventario',
                'stockInventory'
            ],
            nativeId: 'navInventory',
            injectedId: 'menu-item-estoque-inventario'
        },
        {
            key: 'models',
            tab: 'stockModels',
            permKey: 'estoque_modelos',
            label: 'Modelos de Uso',
            icon: 'ri-layout-grid-line',
            permissionKeys: [
                'Estoque: Modelos de Uso',
                'Estoque: Modelo de Uso',
                'estoque_modelos',
                'stockModels'
            ],
            nativeId: 'navUsageModels',
            injectedId: 'menu-item-estoque-modelos'
        },
        {
            key: 'logs',
            tab: 'stockLogs',
            permKey: 'estoque_movimentacoes',
            label: 'Movimentações',
            icon: 'ri-history-line',
            permissionKeys: [
                'Estoque: Movimentações',
                'estoque_movimentacoes',
                'stockLogs'
            ],
            nativeId: 'navInventoryLogs',
            injectedId: 'menu-item-estoque-movimentacoes'
        },
        {
            key: 'mapping',
            tab: 'stockMapping',
            permKey: 'estoque_vinculos',
            label: 'Vínculo de Serviços',
            icon: 'ri-links-line',
            permissionKeys: [
                'Estoque: Vínculo de Serviços',
                'Estoque: Vinculo de Serviços',
                'estoque_vinculos',
                'estoque_vinculo_servicos',
                'stockMapping'
            ],
            nativeId: 'navServiceMapping',
            injectedId: 'menu-item-estoque-vinculos'
        },
        {
            key: 'reports',
            tab: 'stockReports',
            permKey: 'estoque_relatorios',
            label: 'Relatórios',
            icon: 'ri-file-chart-line',
            permissionKeys: [
                'Estoque: Relatórios',
                'estoque_relatorios',
                'stockReports'
            ],
            nativeId: 'navInventoryReports',
            injectedId: 'menu-item-estoque-relatorios'
        }
    ];

    var remotePermissionState = {
        userId: '',
        empresaId: '',
        perms: null,
        loadingPromise: null,
        lastLoadedAt: 0,
        refreshScheduled: false
    };
    var lastProcessedUserId = '';

    function extractIdentityFromUnknown(value) {
        if (!value) return '';
        if (typeof value === 'object') {
            var objectId = String(value.id || value.user_id || value.userId || value.sub || '').trim();
            var objectEmail = String(value.email || value.user_email || '').trim().toLowerCase();
            return objectId || objectEmail || '';
        }
        var raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
            try {
                return extractIdentityFromUnknown(JSON.parse(raw));
            } catch { }
        }
        var emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        if (emailMatch && emailMatch[0]) return String(emailMatch[0]).trim().toLowerCase();
        return raw.length <= 120 ? raw.toLowerCase() : '';
    }

    function getCurrentAuthIdentity() {
        var user = getCurrentUserRef();
        var userIdentity = extractIdentityFromUnknown(user);
        if (userIdentity) return userIdentity;

        var storageKeys = ['user_email', 'email', 'currentUser', 'usuarioLogado', 'auth_user', 'supabase.auth.token'];
        for (var i = 0; i < storageKeys.length; i += 1) {
            try {
                var storageIdentity = extractIdentityFromUnknown(localStorage.getItem(storageKeys[i]));
                if (storageIdentity) return storageIdentity;
            } catch { }
        }

        var domSelectors = ['#userEmail', '.sidebar-footer', '.profile-footer', '.user-info', '.user-profile'];
        for (var j = 0; j < domSelectors.length; j += 1) {
            var el = document.querySelector(domSelectors[j]);
            var domIdentity = extractIdentityFromUnknown(el && el.textContent);
            if (domIdentity) return domIdentity;
        }

        return '';
    }

    function clearPatchedStockSessionPermissions() {
        if (!window.currentUserPerms || typeof window.currentUserPerms !== 'object') return;
        Object.keys(window.currentUserPerms).forEach(function (key) {
            if (!isStockPermissionKey(key)) return;
            try { delete window.currentUserPerms[key]; } catch { window.currentUserPerms[key] = undefined; }
        });
    }

    function resetPatchedSuperAdminState() {
        window.__occAbsoluteSuperAdmin = false;
        if (!window.__occPatchForcedSuperAdmin) return;
        try { window.isSuperAdmin = false; } catch { }
        try { isSuperAdmin = false; } catch { }
        window.__occPatchForcedSuperAdmin = false;
    }

    function resetStockSidebarState() {
        var refs = getInjectedRefs();
        stockMenuItems.forEach(function (item) {
            var el = document.getElementById(item.nativeId) || document.getElementById(item.injectedId);
            if (!el) return;
            try { el.classList.remove('active', 'open', 'expanded'); } catch { }
            try { el.setAttribute('aria-current', 'false'); } catch { }
            try { el.style.display = 'none'; } catch { }
        });
        if (refs.submenu) {
            try {
                refs.submenu.classList.remove('active', 'open', 'expanded');
                refs.submenu.classList.add('collapse');
            } catch { }
            try { refs.submenu.style.display = 'none'; } catch { }
        }
        if (refs.icon) {
            try { refs.icon.className = 'ri-arrow-down-s-line nav-toggle-icon'; } catch { }
        }
        if (refs.root) {
            try {
                refs.root.classList.remove('active', 'open', 'expanded');
                refs.root.classList.add('collapse');
                refs.root.setAttribute('aria-expanded', 'false');
            } catch { }
            if (refs.root.getAttribute && refs.root.getAttribute('data-occ-injected-stock-toggle') === 'true') {
                try { refs.root.remove(); } catch { }
            } else {
                try { refs.root.style.display = 'none'; } catch { }
            }
        }
        if (refs.submenu && refs.submenu.getAttribute && refs.submenu.getAttribute('data-occ-injected-stock-submenu') === 'true') {
            try { refs.submenu.remove(); } catch { }
        }
    }

    function clearPatchSessionCache(reason) {
        void reason;
        remotePermissionState.userId = '';
        remotePermissionState.empresaId = '';
        remotePermissionState.perms = null;
        remotePermissionState.loadingPromise = null;
        remotePermissionState.lastLoadedAt = 0;
        remotePermissionState.refreshScheduled = false;
        window.__occStockPatchScheduled = false;
        window.__occStockPermissionsBootstrapped = false;
        clearPatchedStockSessionPermissions();
        resetPatchedSuperAdminState();
    }

    function syncSessionIdentity(forceReset, explicitIdentity) {
        var currentIdentity = String(explicitIdentity || getCurrentAuthIdentity() || '').trim().toLowerCase();
        var changed = !!forceReset || currentIdentity !== String(lastProcessedUserId || '').trim().toLowerCase();
        if (!changed) return false;
        clearPatchSessionCache('session change');
        lastProcessedUserId = currentIdentity;
        return true;
    }

    function installAuthStateSyncListener() {
        if (window.__occStockAuthStateListenerInstalled) return;
        var client = getSupabaseClient();
        var auth = client && client.auth;
        if (!auth || typeof auth.onAuthStateChange !== 'function') return;
        try {
            var subscriptionResult = auth.onAuthStateChange(function (event, session) {
                runPatchSafely('auth state change', function () {
                    var identityFromSession = extractIdentityFromUnknown(session && session.user ? session.user : session);
                    if (event === 'SIGNED_OUT') {
                        syncSessionIdentity(true, '');
                        lastProcessedUserId = '';
                        resetStockSidebarState();
                        ensureMainAppContainersVisible();
                        return;
                    }
                    if (event === 'SIGNED_IN') {
                        syncSessionIdentity(true, identityFromSession);
                        ensureMainAppContainersVisible();
                        initializeStockPatch(true);
                    }
                });
            });
            var subscription = subscriptionResult && subscriptionResult.data && subscriptionResult.data.subscription
                ? subscriptionResult.data.subscription
                : subscriptionResult && subscriptionResult.subscription
                    ? subscriptionResult.subscription
                    : subscriptionResult;
            window.__occStockAuthStateUnsubscribe = function () {
                try {
                    if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
                } catch { }
            };
            window.__occStockAuthStateListenerInstalled = true;
        } catch (err) {
            console.warn('Erro isolado ao instalar listener de autenticacao do estoque:', err);
        }
    }

    function getCurrentUserRef() {
        try {
            if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
        } catch { }
        return window.currentUser || window.usuarioLogado || null;
    }

    function getCurrentEmpresaIdRef() {
        try {
            if (typeof currentEmpresaId !== 'undefined') return String(currentEmpresaId || '');
        } catch { }
        return String(window.currentEmpresaId || '');
    }

    function getSupabaseClient() {
        return window.db || window.supabase || db || null;
    }

    function parsePermissionsPayload(value) {
        if (!value) return {};
        if (typeof value === 'string') {
            try {
                var parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch {
                return {};
            }
        }
        return value && typeof value === 'object' ? value : {};
    }

    function mergePermissionMaps(baseMap, extraMap) {
        var result = {};
        [baseMap, extraMap].forEach(function (map) {
            Object.keys(map || {}).forEach(function (key) {
                var currentValue = result[key];
                var nextValue = map[key];
                if (typeof currentValue === 'undefined') {
                    result[key] = nextValue;
                    return;
                }
                if (hasPermValue(nextValue, 'select')) {
                    result[key] = nextValue;
                }
            });
        });
        return result;
    }

    async function runPermissionQuerySafely(queryFactory, contextLabel) {
        try {
            if (typeof queryFactory !== 'function') return null;
            var result = await queryFactory();
            if (!result) return null;
            if (result.error) {
                console.warn('Erro isolado ao consultar permissoes em ' + String(contextLabel || 'origem remota') + ':', result.error);
                return null;
            }
            return result;
        } catch (err) {
            console.warn('Erro isolado ao consultar permissoes em ' + String(contextLabel || 'origem remota') + ':', err);
            return null;
        }
    }

    async function loadRemotePermissions(forceReload) {
        if (syncAbsoluteSuperAdminFlag()) return remotePermissionState.perms || {};
        var user = getCurrentUserRef();
        var userId = String(user && user.id || '').trim();
        var empresaId = getCurrentEmpresaIdRef();
        var client = getSupabaseClient();
        if (!userId || !client || typeof client.from !== 'function') {
            remotePermissionState.perms = remotePermissionState.perms || {};
            return remotePermissionState.perms;
        }

        var isSameScope = remotePermissionState.userId === userId && remotePermissionState.empresaId === empresaId;
        if (!forceReload && isSameScope && remotePermissionState.perms) return remotePermissionState.perms;
        if (!forceReload && isSameScope && remotePermissionState.loadingPromise) return remotePermissionState.loadingPromise;

        remotePermissionState.userId = userId;
        remotePermissionState.empresaId = empresaId;
        remotePermissionState.loadingPromise = Promise.resolve().then(async function () {
            var mergedPerms = {};
            try {
                var mappingResult = await runPermissionQuerySafely(function () {
                    var mappingQuery = client.from('usuario_empresas').select('permissoes, empresa_id');
                    mappingQuery = mappingQuery.eq('usuario_id', userId);
                    if (empresaId) mappingQuery = mappingQuery.eq('empresa_id', empresaId);
                    if (typeof mappingQuery.maybeSingle === 'function') {
                        return mappingQuery.maybeSingle();
                    }
                    return mappingQuery.limit(1);
                }, 'usuario_empresas');

                if (mappingResult) {
                    if (Array.isArray(mappingResult.data)) {
                        var mappingRow = mappingResult.data[0] || null;
                        mergedPerms = mergePermissionMaps(mergedPerms, parsePermissionsPayload(mappingRow && mappingRow.permissoes));
                    } else {
                        var mappingData = mappingResult && mappingResult.data ? mappingResult.data : null;
                        mergedPerms = mergePermissionMaps(mergedPerms, parsePermissionsPayload(mappingData && mappingData.permissoes));
                    }
                }

                if (!Object.keys(mergedPerms).length) {
                    var userResult = await runPermissionQuerySafely(function () {
                        var userQuery = client.from('usuario_empresas').select('*').eq('usuario_id', userId);
                        if (empresaId) userQuery = userQuery.eq('empresa_id', empresaId);
                        if (typeof userQuery.maybeSingle === 'function') {
                            return userQuery.maybeSingle();
                        }
                        return userQuery.limit(1);
                    }, 'usuario_empresas');

                    if (userResult) {
                        var userRow = Array.isArray(userResult.data)
                            ? (userResult.data[0] || null)
                            : (userResult.data || null);
                        mergedPerms = mergePermissionMaps(mergedPerms, parsePermissionsPayload(userRow && (userRow.permissoes || userRow.permissions)));
                    }
                }
            } catch (err) {
                console.warn('Erro isolado ao montar cache remoto de permissoes do estoque:', err);
                mergedPerms = {};
            } finally {
                remotePermissionState.perms = mergedPerms || {};
                remotePermissionState.lastLoadedAt = Date.now();
                remotePermissionState.loadingPromise = null;
                try {
                    schedulePatchRun(String(sessionStorage.getItem('lastTab') || ''));
                } catch (err) {
                    console.warn('Erro isolado ao reagendar patch de estoque apos RBAC remoto:', err);
                }
            }

            return remotePermissionState.perms || {};
        }).catch(function (err) {
            console.warn('Erro isolado ao atualizar permissoes remotas do estoque:', err);
            remotePermissionState.perms = remotePermissionState.perms || {};
            remotePermissionState.lastLoadedAt = Date.now();
            remotePermissionState.loadingPromise = null;
            return remotePermissionState.perms;
        });

        return remotePermissionState.loadingPromise;
    }

    function refreshRemotePermissionsAsync(forceReload) {
        if (syncAbsoluteSuperAdminFlag()) return;
        if (!forceReload) {
            if (remotePermissionState.loadingPromise) return;
            if (remotePermissionState.refreshScheduled) return;
            if (remotePermissionState.lastLoadedAt && (Date.now() - remotePermissionState.lastLoadedAt) < 5000) return;
        }
        remotePermissionState.refreshScheduled = true;
        setTimeout(function () {
            remotePermissionState.refreshScheduled = false;
            loadRemotePermissions(!!forceReload).catch(function (err) {
                console.warn('Erro isolado ao atualizar cache RBAC do estoque:', err);
            });
        }, 0);
    }

    function getPerms() {
        if (syncAbsoluteSuperAdminFlag()) {
            return remotePermissionState.perms || window.currentUserPerms || {};
        }
        var merged = {};
        getPermissionHolders().forEach(function (holder) {
            Object.keys(holder || {}).forEach(function (key) {
                var nextValue = holder[key];
                var currentValue = merged[key];
                if (typeof currentValue === 'undefined') {
                    merged[key] = nextValue;
                    return;
                }
                if (hasPermValue(nextValue, 'select')) {
                    merged[key] = nextValue;
                }
            });
        });
        return merged;
    }

    function normalizePermissionKey(input) {
        return String(input || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function hasPermValue(value, actionName) {
        var action = String(actionName || 'select');
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            var normalized = String(value || '').trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'ativo' || normalized === 'active' || normalized === 'yes';
        }
        if (value && typeof value === 'object') {
            if (Object.prototype.hasOwnProperty.call(value, action)) return !!value[action];
            if (action === 'insert') return !!(value.insert || value.create || value.criar);
            if (action === 'update') return !!(value.update || value.edit || value.editar);
            if (action === 'delete') return !!(value.delete || value.remove || value.excluir);
            return !!(value.select || value.active || value.ativo);
        }
        return false;
    }

    function matchesFlexibleStockPermission(targetKey, rawKey) {
        var target = normalizePermissionKey(targetKey);
        var raw = normalizePermissionKey(rawKey);
        if (!target || !raw) return false;
        if (raw === target) return true;
        if (target === 'estoque_modelos') {
            if (raw === 'estoque_modelos') return true;
            if (raw.indexOf('modelo') >= 0) return true;
        }
        if (target === 'estoque_vinculos') {
            if (raw === 'estoque_vinculo_servicos' || raw === 'estoque_vinculos') return true;
            if (raw.indexOf('vinculo') >= 0 && raw.indexOf('servi') >= 0) return true;
        }
        return false;
    }

    function ensurePermissionObject(target, key, actions) {
        if (!target || typeof target !== 'object') return;
        var current = target[key];
        var flags = actions && typeof actions === 'object'
            ? actions
            : { select: true, insert: true, update: true, delete: true };
        if (current && typeof current === 'object') {
            if (flags.select) current.select = true;
            if (flags.insert) current.insert = true;
            if (flags.update) current.update = true;
            if (flags.delete) current.delete = true;
            return;
        }
        if (typeof current === 'boolean') return;
        target[key] = {
            select: !!flags.select,
            insert: !!flags.insert,
            update: !!flags.update,
            delete: !!flags.delete
        };
    }

    function getPermissionHolders() {
        var holders = [];
        var addHolder = function (holder) {
            if (!holder || typeof holder !== 'object') return;
            if (holders.indexOf(holder) >= 0) return;
            holders.push(holder);
        };
        addHolder(window.currentUserPerms);
        addHolder(window.currentUser && window.currentUser.permissions);
        addHolder(window.currentUser && window.currentUser.permissoes);
        addHolder(window.usuarioLogado && window.usuarioLogado.permissions);
        addHolder(window.usuarioLogado && window.usuarioLogado.permissoes);
        addHolder(window.userPermissions);
        addHolder(remotePermissionState.perms);
        return holders;
    }

    function isStockPermissionKey(rawKey) {
        var normalized = normalizePermissionKey(rawKey);
        if (!normalized) return false;
        if (normalized.indexOf('estoque') >= 0) return true;
        for (var i = 0; i < stockMenuItems.length; i += 1) {
            if (matchesFlexibleStockPermission(stockMenuItems[i].permKey, normalized)) return true;
        }
        return false;
    }

    function hasAnyActiveStockPermission() {
        if (syncAbsoluteSuperAdminFlag()) return true;
        var holders = getPermissionHolders();
        for (var i = 0; i < holders.length; i += 1) {
            var holder = holders[i] || {};
            var keys = Object.keys(holder);
            for (var j = 0; j < keys.length; j += 1) {
                var key = keys[j];
                if (!isStockPermissionKey(key)) continue;
                if (hasPermValue(holder[key], 'select')) return true;
            }
        }
        return false;
    }

    function ensureStockSessionPermissions(targetTab) {
        var targetItem = stockMenuItems.find(function (item) {
            return item.tab === String(targetTab || '');
        }) || null;
        if (!window.currentUserPerms || typeof window.currentUserPerms !== 'object') {
            window.currentUserPerms = {};
        }
        var keysToMark = getItemPermissionKeys(targetItem);
        keysToMark.forEach(function (key) {
            ensurePermissionObject(window.currentUserPerms, key, { select: true });
        });
    }

    function hasAliasPermission(keys, actionName) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        var list = Array.isArray(keys) ? keys : [keys];
        var perms = getPerms();
        var permKeys = Object.keys(perms || {});
        for (var i = 0; i < list.length; i += 1) {
            var key = String(list[i] || '').trim();
            if (!key) continue;
            if (hasPermValue(perms[key], actionName)) return true;
            var normalizedKey = normalizePermissionKey(key);
            for (var j = 0; j < permKeys.length; j += 1) {
                var rawPermKey = permKeys[j];
                if (!matchesFlexibleStockPermission(normalizedKey, rawPermKey)) continue;
                if (hasPermValue(perms[rawPermKey], actionName)) return true;
            }
        }
        return false;
    }

    function getItemPermissionKeys(item) {
        if (!item) return [];
        var keys = [];
        if (Array.isArray(item.permissionKeys)) {
            keys = keys.concat(item.permissionKeys);
        }
        if (item.permKey) {
            keys = keys.concat(aliases[item.permKey] || [item.permKey]);
        }
        return keys.filter(function (key, index, list) {
            return !!key && list.indexOf(key) === index;
        });
    }

    function getModulePermissionKeys(moduleKey) {
        var key = String(moduleKey || '').trim();
        if (!key) return [];
        return aliases[key] || [key];
    }

    function canModuleAction(moduleKey, actionName) {
        var mod = String(moduleKey || '').trim();
        var action = String(actionName || 'select').trim() || 'select';
        try {
            if (typeof window.__occNativeCan === 'function' && window.__occNativeCan(mod, action)) return true;
        } catch { }
        return hasAliasPermission(getModulePermissionKeys(mod), action);
    }

    function canAnyModuleAction(moduleKeys, actionName) {
        var list = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];
        for (var i = 0; i < list.length; i += 1) {
            if (canModuleAction(list[i], actionName)) return true;
        }
        return false;
    }

    function showPermissionWarning(actionName, customMessage) {
        var action = String(actionName || 'select');
        var defaultMessage = 'Você não possui permissão para realizar esta ação.';
        if (action === 'update') defaultMessage = 'Você não tem permissão para editar registros neste módulo';
        if (action === 'delete') defaultMessage = 'Você não tem permissão para excluir registros neste módulo';
        if (action === 'insert') defaultMessage = 'Você não tem permissão para criar registros neste módulo';
        var message = String(customMessage || defaultMessage);
        try {
            if (typeof window.showToast === 'function') {
                window.showToast(message, true);
                return;
            }
        } catch { }
        try {
            window.alert(message);
        } catch { }
    }

    function blockEventByPermission(event, actionName, customMessage) {
        if (event) {
            try { event.preventDefault(); } catch { }
            try { event.stopImmediatePropagation(); } catch { }
            try { event.stopPropagation(); } catch { }
        }
        showPermissionWarning(actionName, customMessage);
        return false;
    }

    function rememberInlineState(el) {
        if (!el || !el.dataset) return;
        if (!Object.prototype.hasOwnProperty.call(el.dataset, 'occOrigDisplay')) {
            el.dataset.occOrigDisplay = el.style.display || '';
        }
        if (!Object.prototype.hasOwnProperty.call(el.dataset, 'occOrigTitle')) {
            el.dataset.occOrigTitle = el.getAttribute('title') || '';
        }
    }

    function setElementHiddenByPermission(el, allowed, blockedTitle) {
        if (!el) return;
        rememberInlineState(el);
        if (allowed) {
            el.style.display = el.dataset.occOrigDisplay || '';
            el.disabled = false;
            el.style.pointerEvents = '';
            el.style.opacity = '';
            el.setAttribute('aria-disabled', 'false');
            if (Object.prototype.hasOwnProperty.call(el.dataset, 'occOrigTitle')) {
                el.setAttribute('title', el.dataset.occOrigTitle || '');
            }
            return;
        }
        el.style.display = 'none';
        el.disabled = true;
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.55';
        el.setAttribute('aria-disabled', 'true');
        if (blockedTitle) el.setAttribute('title', blockedTitle);
    }

    function setElementDisabledByPermission(el, allowed, blockedTitle) {
        if (!el) return;
        rememberInlineState(el);
        el.disabled = !allowed;
        el.style.pointerEvents = allowed ? '' : 'none';
        el.style.opacity = allowed ? '' : '0.55';
        el.setAttribute('aria-disabled', allowed ? 'false' : 'true');
        if (allowed) {
            if (Object.prototype.hasOwnProperty.call(el.dataset, 'occOrigTitle')) {
                el.setAttribute('title', el.dataset.occOrigTitle || '');
            }
            return;
        }
        if (blockedTitle) el.setAttribute('title', blockedTitle);
    }

    function setFormEditableByPermission(formEl, allowed, skipSelector) {
        if (!formEl) return;
        var skip = skipSelector ? String(skipSelector) : '';
        formEl.querySelectorAll('input, select, textarea, button').forEach(function (control) {
            if (!control) return;
            if (control.type === 'hidden') return;
            if (skip && control.matches(skip)) return;
            if (control.tagName === 'BUTTON') {
                if (control.type === 'button' && /cancelar|voltar/i.test(String(control.textContent || ''))) return;
                setElementDisabledByPermission(control, allowed, 'Sem permissão para editar');
                return;
            }
            control.disabled = !allowed;
            if ('readOnly' in control && control.tagName !== 'SELECT') {
                control.readOnly = !allowed;
            }
        });
    }

    function canAccessStockTabNative(tab) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        try {
            if (typeof window.__occNativeCanAccessStockTab === 'function') return !!window.__occNativeCanAccessStockTab(tab);
        } catch { }
        try {
            if (typeof window.canAccessStockTab === 'function' && window.canAccessStockTab !== canAccessStockTabPatched) {
                return !!window.canAccessStockTab(tab);
            }
        } catch { }
        return false;
    }

    function canAccessStockTabByItem(item) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        if (!item) return false;
        return hasAliasPermission(getItemPermissionKeys(item), 'select');
    }

    function canAccessStockReports() {
        var reportsItem = stockMenuItems.find(function (item) { return item.tab === 'stockReports'; }) || null;
        return canAccessStockTabByItem(reportsItem);
    }

    function canAccessAnyStock() {
        for (var i = 0; i < stockMenuItems.length; i += 1) {
            if (canAccessStockTabByItem(stockMenuItems[i])) return true;
        }
        return hasAnyActiveStockPermission();
    }

    function getFirstAllowedStockTab() {
        for (var i = 0; i < stockMenuItems.length; i += 1) {
            if (canAccessStockTabByItem(stockMenuItems[i])) return stockMenuItems[i].tab;
        }
        return '';
    }

    function resolveAllowedStockTab(tab) {
        var targetTab = String(tab || '');
        if (!targetTab) return getFirstAllowedStockTab();
        var targetItem = stockMenuItems.find(function (item) { return item.tab === targetTab; }) || null;
        if (targetItem && canAccessStockTabByItem(targetItem)) return targetTab;
        return getFirstAllowedStockTab();
    }

    function getAllowedStockMenuItems() {
        if (syncAbsoluteSuperAdminFlag()) return stockMenuItems.slice();
        refreshRemotePermissionsAsync(false);
        var userPermissions = getPerms();
        if (!window.__occLoggedRbacDebug) {
            window.__occLoggedRbacDebug = true;
            console.log('[DEBUG RBAC]', userPermissions);
        }
        return stockMenuItems.filter(function (item) {
            return canAccessStockTabByItem(item);
        });
    }

    function removeHiddenState(el) {
        if (!el) return;
        el.style.display = '';
        el.classList.remove('hidden');
        el.classList.remove('HIDDEN');
        el.classList.remove('oculto');
    }

    function forceVisible(el, displayValue) {
        if (!el) return;
        removeHiddenState(el);
        el.style.display = displayValue || 'flex';
        try {
            el.style.setProperty('display', displayValue || 'flex', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('opacity', '1', 'important');
        } catch { }
    }

    function getSidebarNav() {
        return document.querySelector('#sidebar .sidebar-nav')
            || document.querySelector('#sidebar .sidebar-menu')
            || document.querySelector('#sidebar nav')
            || document.querySelector('.sidebar-nav')
            || document.querySelector('.sidebar-menu')
            || document.querySelector('aside.sidebar nav');
    }

    function getSidebarObserverTarget() {
        return getSidebarNav()
            || document.getElementById('sidebar')
            || document.querySelector('.sidebar')
            || document.querySelector('aside.sidebar');
    }

    function forceShowSidebarForSuperAdmin() {
        if (!syncAbsoluteSuperAdminFlag()) return;
        var sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!sidebar) return;
        ensureSuperAdminStockStyles();
        ensureInjectedMenu(false);
        sidebar.querySelectorAll('.nav-item, .nav-subitem, .submenu, .stock-submenu, .nav-section-title, .nav-section').forEach(function (el) {
            removeHiddenState(el);
            if (el.classList.contains('nav-item') || el.classList.contains('nav-subitem')) {
                el.style.display = 'flex';
            }
        });
        stockMenuItems.forEach(function (item) {
            var nativeItem = document.getElementById(item.nativeId);
            if (nativeItem) forceVisible(nativeItem, 'flex');
        });
        var nativeToggle = document.getElementById('navEstoqueToggle') || document.getElementById('navEstoque');
        if (nativeToggle) forceVisible(nativeToggle, 'flex');
        var injected = getInjectedRefs();
        if (injected.root) forceVisible(injected.root, 'flex');
        stockMenuItems.forEach(function (item) {
            var itemEl = document.getElementById(item.nativeId) || document.getElementById(item.injectedId);
            if (itemEl) forceVisible(itemEl, 'flex');
        });
        stripStockHiddenInlineStyles();
    }

    function getAppSectionAnchor(navRoot) {
        if (!navRoot) return null;
        return document.getElementById('navBudgets')
            || document.getElementById('navFinanceiro')
            || document.getElementById('navConfigSection')
            || null;
    }

    function getMenuInsertReference(navRoot) {
        if (!navRoot) return null;
        var services = document.getElementById('navServices');
        if (services && services.parentNode === navRoot) return services.nextSibling;
        var budgets = document.getElementById('navBudgets');
        if (budgets && budgets.parentNode === navRoot) return budgets;
        return getAppSectionAnchor(navRoot);
    }

    function hasSidebarStockGroup(navRoot) {
        var nav = navRoot || getSidebarNav();
        if (!nav) return false;
        if (document.getElementById('navEstoqueToggle') || document.getElementById('navEstoque')) return true;
        if (document.getElementById('menu-item-estoque')) return true;
        var explicit = nav.querySelector('[data-tab="estoque"], [data-stock-group="true"], #navEstoque, #navEstoqueToggle, #menu-item-estoque');
        if (explicit) return true;
        var candidates = nav.querySelectorAll('button, a, div');
        for (var i = 0; i < candidates.length; i += 1) {
            var text = String(candidates[i].textContent || '').trim().toLowerCase();
            if (text === 'estoque' || text.indexOf('estoque') >= 0) return true;
        }
        return false;
    }

    function getInjectedRefs() {
        var refs = {
            root: document.getElementById('navEstoqueToggle')
                || document.getElementById('navEstoque')
                || document.getElementById('menu-item-estoque'),
            icon: document.getElementById('navEstoqueToggleIcon')
                || document.getElementById('menu-item-estoque-icon'),
            submenu: document.getElementById('navEstoqueSubmenu')
                || document.getElementById('menu-item-estoque-submenu'),
            items: {}
        };
        stockMenuItems.forEach(function (item) {
            refs.items[item.key] = document.getElementById(item.nativeId)
                || document.getElementById(item.injectedId);
        });
        refs.reports = refs.items.reports || null;
        return refs;
    }

    function getStockViewAliasesByTab(tab) {
        var viewIds = {
            stockInventory: ['stockInventoryView', 'inventoryView', 'stockView'],
            stockModels: ['usageModelsView'],
            stockMapping: ['serviceMappingView'],
            stockLogs: ['movementLogsView', 'inventoryMovementsView'],
            stockReports: ['inventoryReportView', 'inventoryReportsView']
        };
        return viewIds[String(tab || '')] || [];
    }

    function getResolvedExistingId(ids) {
        var list = Array.isArray(ids) ? ids : [ids];
        for (var i = 0; i < list.length; i += 1) {
            var id = String(list[i] || '').trim();
            if (!id) continue;
            if (document.getElementById(id)) return id;
        }
        return String(list[0] || '').trim();
    }

    function resolveStockViewId(targetId) {
        var aliases = {
            stockInventoryView: ['stockInventoryView', 'inventoryView', 'stockView'],
            inventoryView: ['inventoryView', 'stockInventoryView', 'stockView'],
            stockView: ['stockView', 'stockInventoryView', 'inventoryView'],
            usageModelsView: ['usageModelsView'],
            movementLogsView: ['movementLogsView', 'inventoryMovementsView'],
            inventoryMovementsView: ['inventoryMovementsView', 'movementLogsView'],
            serviceMappingView: ['serviceMappingView'],
            inventoryReportView: ['inventoryReportView', 'inventoryReportsView'],
            inventoryReportsView: ['inventoryReportsView', 'inventoryReportView']
        };
        var target = String(targetId || '').trim();
        if (!target) return '';
        return getResolvedExistingId(aliases[target] || [target]);
    }

    function getStockViewElementByTab(tab) {
        var viewId = getStockViewIdByTab(tab);
        return viewId ? document.getElementById(viewId) : null;
    }

    function getStockViewIdByTab(tab) {
        return getResolvedExistingId(getStockViewAliasesByTab(tab));
    }

    function getAllStockViewIds() {
        return Array.from(new Set([
            'stockInventoryView',
            'stockView',
            'inventoryReportView',
            'inventoryView',
            'usageModelsView',
            'movementLogsView',
            'serviceMappingView',
            'inventoryMovementsView',
            'inventoryReportsView'
        ]));
    }

    function showStockSection(targetId) {
        var selectors = '.stock-sub-view, .stock-view-container, #stockView, #inventoryReportView, #inventoryReportsView, #inventoryView, #usageModelsView, #movementLogsView, #inventoryMovementsView, #serviceMappingView, #stockInventoryView';
        document.querySelectorAll(selectors).forEach(function (el) {
            if (!el) return;
            try {
                el.classList.add('hidden');
            } catch { }
            try {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.opacity = '0';
            } catch { }
        });
        var resolvedTargetId = resolveStockViewId(targetId);
        var activeView = resolvedTargetId ? document.getElementById(String(resolvedTargetId)) : null;
        if (!activeView) return;
        try {
            var masterTablesView = document.getElementById('masterTablesView');
            var masterTablesContent = document.getElementById('masterTablesContent');
            if (masterTablesView && (activeView.parentElement && activeView.parentElement.id === 'masterTablesContent' || (masterTablesContent && masterTablesContent.contains(activeView)))) {
                masterTablesView.classList.remove('hidden');
                masterTablesView.style.display = 'block';
                if (masterTablesContent) {
                    masterTablesContent.classList.remove('hidden');
                    masterTablesContent.style.display = 'block';
                }
            }
        } catch { }
        try {
            activeView.classList.remove('hidden');
        } catch { }
        try {
            activeView.style.display = 'block';
            activeView.style.visibility = 'visible';
            activeView.style.opacity = '1';
        } catch { }
        if (activeView.parentElement) {
            removeHiddenState(activeView.parentElement);
        }
    }

    function hideAllStockViews() {
        showStockSection('');
    }

    function hideStockViews() {
        hideAllStockViews();
    }

    window.hideStockViews = hideStockViews;

    function isStockTab(tab) {
        return /^stock/i.test(String(tab || '').trim());
    }

    function getStockSubmenuSelector() {
        return '#navEstoqueSubmenu [data-stock-tab],'
            + '#navEstoqueSubmenu #navStockInventory,'
            + '#navEstoqueSubmenu #navInventory,'
            + '#navEstoqueSubmenu #navUsageModels,'
            + '#navEstoqueSubmenu #navInventoryLogs,'
            + '#navEstoqueSubmenu #navInventoryReport,'
            + '#navEstoqueSubmenu #navInventoryReports,'
            + '#navEstoqueSubmenu #navServiceMapping,'
            + '.stock-submenu [data-stock-tab],'
            + '.stock-submenu #navStockInventory,'
            + '.stock-submenu #navInventory,'
            + '.stock-submenu #navUsageModels,'
            + '.stock-submenu #navInventoryLogs,'
            + '.stock-submenu #navInventoryReport,'
            + '.stock-submenu #navInventoryReports,'
            + '.stock-submenu #navServiceMapping';
    }

    function isStockSubmenuTarget(target) {
        if (!target || !target.closest) return false;
        if (target.closest('#navAtendimento')) return false;
        return !!target.closest(getStockSubmenuSelector());
    }

    function resetSidebarActiveState() { }
    void resetSidebarActiveState;

    function ensureStockViewVisible(tab) {
        var targetId = getStockViewIdByTab(tab);
        if (!targetId) {
            hideAllStockViews();
            return;
        }
        showStockSection(targetId);
        var view = document.getElementById(targetId);
        if (view) removeHiddenState(view);
    }

    window.showStockSection = showStockSection;

    function getStockViewMap() {
        var inventoryViewId = getResolvedExistingId(['stockInventoryView', 'inventoryView', 'stockView']);
        var logsViewId = getResolvedExistingId(['movementLogsView', 'inventoryMovementsView']);
        var reportsViewId = getResolvedExistingId(['inventoryReportView', 'inventoryReportsView']);
        return {
            navStockInventory: inventoryViewId,
            navInventory: inventoryViewId,
            navUsageModels: 'usageModelsView',
            navInventoryLogs: logsViewId,
            navInventoryReport: reportsViewId,
            navInventoryReports: reportsViewId,
            navServiceMapping: 'serviceMappingView'
        };
    }

    window.switchStockSubTab = function (targetViewId, clickedElement) {
        var resolvedViewId = resolveStockViewId(targetViewId);
        showStockSection(resolvedViewId);
        if (!clickedElement) return;
        document.querySelectorAll('#navEstoqueSubmenu .stock-submenu-item, .stock-submenu .stock-submenu-item').forEach(function (el) {
            try { el.classList.remove('active'); } catch { }
        });
        try { clickedElement.classList.add('active'); } catch { }
    };

    function bindStockSubmenuHandlers() {
        var viewMap = getStockViewMap();
        var submenus = [
            { ids: ['navStockInventory', 'navInventory'], tab: 'stockInventory', view: viewMap.navStockInventory || getStockViewIdByTab('stockInventory') },
            { ids: ['navUsageModels'], tab: 'stockModels', view: viewMap.navUsageModels || getStockViewIdByTab('stockModels') },
            { ids: ['navInventoryLogs'], tab: 'stockLogs', view: viewMap.navInventoryLogs || getStockViewIdByTab('stockLogs') },
            { ids: ['navServiceMapping'], tab: 'stockMapping', view: viewMap.navServiceMapping || getStockViewIdByTab('stockMapping') },
            { ids: ['navInventoryReport', 'navInventoryReports'], tab: 'stockReports', view: viewMap.navInventoryReport || viewMap.navInventoryReports || getStockViewIdByTab('stockReports') }
        ];

        submenus.forEach(function (item) {
            item.ids.forEach(function (menuId) {
                var el = document.getElementById(menuId);
                if (!el) return;
                var viewId = resolveStockViewId(String(el.getAttribute && el.getAttribute('data-target-view') || item.view || ''));
                el.__occStockSubmenuBound = true;
                try {
                    el.classList.add('stock-submenu-item');
                    el.setAttribute('data-stock-tab', item.tab);
                    el.setAttribute('data-target-view', viewId);
                } catch { }
                el.onclick = function (e) {
                    if (e) e.preventDefault();
                    if (typeof window.switchStockSubTab === 'function' && viewId) {
                        window.switchStockSubTab(viewId, this);
                    } else if (viewId) {
                        showStockSection(viewId);
                    }
                    syncMenuState(item.tab);
                    try {
                        if (typeof window.setActiveTab === 'function') {
                            window.setActiveTab(item.tab);
                        }
                    } catch { }
                    return false;
                };
            });
        });

        var stockToggle = document.getElementById('navEstoqueToggle') || document.getElementById('navEstoque');
        if (stockToggle && !stockToggle.__occStockSubmenuRebindBound) {
            stockToggle.__occStockSubmenuRebindBound = true;
            stockToggle.addEventListener('click', function () {
                setTimeout(function () {
                    try { bindStockSubmenuHandlers(); } catch { }
                }, 0);
            });
        }
    }

    function applyAccordionState(toggleEl, submenuEl, iconEl, shouldOpen) {
        if (toggleEl) {
            toggleEl.classList.toggle('expanded', !!shouldOpen);
            toggleEl.classList.toggle('open', !!shouldOpen);
            toggleEl.classList.toggle('collapse', !shouldOpen);
            toggleEl.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        }
        if (submenuEl) {
            submenuEl.style.display = shouldOpen ? 'block' : 'none';
            submenuEl.classList.toggle('open', !!shouldOpen);
            submenuEl.classList.toggle('collapse', !shouldOpen);
        }
        if (iconEl) {
            iconEl.className = shouldOpen
                ? 'ri-arrow-up-s-line nav-toggle-icon'
                : 'ri-arrow-down-s-line nav-toggle-icon';
        }
    }

    function renderStockTabData(tab) {
        var targetTab = String(tab || 'stockReports');
        var renderers = {
            stockInventory: function () {
                if (typeof window.renderInventoryTable === 'function') window.renderInventoryTable();
            },
            stockModels: function () {
                if (typeof window.renderUsageModelsTable === 'function') window.renderUsageModelsTable();
                if (typeof window.renderModelItemsEditor === 'function') window.renderModelItemsEditor();
            },
            stockLogs: function () {
                if (typeof window.renderInventoryLogsTable === 'function') window.renderInventoryLogsTable();
            },
            stockMapping: function () {
                if (typeof window.renderServiceMappingTable === 'function') window.renderServiceMappingTable();
            },
            stockReports: function () {
                if (typeof window.applyInventoryReportDefaultDates === 'function') window.applyInventoryReportDefaultDates(true);
                if (typeof window.renderStockReports === 'function') window.renderStockReports();
            }
        };
        try {
            if (typeof renderers[targetTab] === 'function') renderers[targetTab]();
        } catch (err) {
            var labels = {
                stockInventory: 'inventário',
                stockModels: 'modelos de uso',
                stockLogs: 'movimentações',
                stockMapping: 'vínculo de serviços',
                stockReports: 'relatórios'
            };
            console.error('Erro ao carregar ' + String(labels[targetTab] || 'estoque') + ':', err);
        }
    }

    function loadAndRenderStockTab(tab) {
        var targetTab = String(tab || 'stockReports');
        ensureStockSessionPermissions(targetTab);
        ensureStockViewVisible(targetTab);
        if (typeof window.loadEstoqueData === 'function') {
            return Promise.resolve(window.loadEstoqueData(true)).then(function () {
                ensureStockViewVisible(targetTab);
                renderStockTabData(targetTab);
            }).catch(function (err) {
                var labels = {
                    stockInventory: 'inventário',
                    stockModels: 'modelos de uso',
                    stockLogs: 'movimentações',
                    stockMapping: 'vínculo de serviços',
                    stockReports: 'relatórios'
                };
                console.error('Erro ao carregar ' + String(labels[targetTab] || 'estoque') + ':', err);
            });
        }
        ensureStockViewVisible(targetTab);
        renderStockTabData(targetTab);
        return Promise.resolve();
    }

    async function openStockTab(tab) {
        syncAbsoluteSuperAdminFlag();
        var safeTab = resolveAllowedStockTab(tab);
        if (!safeTab) return;
        var targetTab = String(safeTab || getFirstAllowedStockTab() || 'stockInventory');
        try {
            if (typeof window.validateAssinaturaStatusGate === 'function') {
                var ok = await window.validateAssinaturaStatusGate({ reason: 'menu:' + String(targetTab || '') }).catch(function () { return true; });
                if (!ok) return;
            }
        } catch { }

        ensureStockViewVisible(targetTab);
        syncMenuState(targetTab);
        try { sessionStorage.setItem('lastTab', targetTab); } catch { }
        try { window.bootPreferredTab = targetTab; } catch { }
        ensureStockViewVisible(targetTab);
        syncMenuState(targetTab);

        return Promise.resolve().then(function () {
            return loadAndRenderStockTab(targetTab);
        }).then(function () {
            ensureStockViewVisible(targetTab);
            syncMenuState(targetTab);
        });
    }
    window.openStockTab = openStockTab;

    function syncMenuState(activeTab) {
        var tab = String(activeTab || sessionStorage.getItem('lastTab') || '');
        var injected = getInjectedRefs();

        stockMenuItems.forEach(function (item) {
            var nativeItem = document.getElementById(item.nativeId);
            if (nativeItem) {
                nativeItem.classList.toggle('active', item.tab === tab);
                nativeItem.setAttribute('aria-current', item.tab === tab ? 'page' : 'false');
            }
            if (injected.items[item.key]) {
                injected.items[item.key].classList.toggle('active', item.tab === tab);
                injected.items[item.key].setAttribute('aria-current', item.tab === tab ? 'page' : 'false');
            }
        });
    }

    function bindStockMenuClick(el, item, markInjectedOpen) {
        if (!el || !item) return;
        try {
            el.style.setProperty('pointer-events', 'auto', 'important');
            el.style.setProperty('cursor', 'pointer', 'important');
            el.style.setProperty('position', 'relative', 'important');
            el.style.setProperty('z-index', '9999', 'important');
        } catch { }
        try {
            el.setAttribute('data-stock-tab', item.tab);
            el.setAttribute('data-stock-key', item.key);
            el.setAttribute('data-stock-action', 'open');
            el.setAttribute('data-target-view', getStockViewIdByTab(item.tab));
            el.classList.add('stock-submenu-item');
        } catch { }
        void markInjectedOpen;
    }

    function bindAllStockMenuClicks(allowedItems) {
        (allowedItems || []).forEach(function (item) {
            getStockMenuElementsForItem(item).forEach(function (el) {
                try {
                    el.setAttribute('data-stock-tab', item.tab);
                    el.setAttribute('data-stock-key', item.key);
                } catch { }
                bindStockMenuClick(el, item, true);
            });
        });
    }

    function normalizeStockMenuText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function matchesStockItemText(item, text) {
        var normalizedText = normalizeStockMenuText(text);
        if (!normalizedText) return false;
        if (normalizeStockMenuText(item.label) && normalizedText.indexOf(normalizeStockMenuText(item.label)) >= 0) return true;
        if (item.nativeId === 'navInventory' && normalizedText.indexOf('inventario') >= 0) return true;
        if (item.nativeId === 'navUsageModels' && normalizedText.indexOf('modelos') >= 0) return true;
        if (item.nativeId === 'navInventoryLogs' && normalizedText.indexOf('movimentacoes') >= 0) return true;
        if (item.nativeId === 'navInventoryReports' && normalizedText.indexOf('relatorios') >= 0) return true;
        if (item.nativeId === 'navServiceMapping' && (normalizedText.indexOf('vinculo') >= 0 || normalizedText.indexOf('servicos') >= 0)) return true;
        return false;
    }

    function getStockMenuElementsForItem(item) {
        var selectors = [
            '#' + item.nativeId,
            '#' + item.injectedId,
            '[data-stock-tab="' + item.tab + '"]',
            '[data-stock-key="' + item.key + '"]'
        ];
        var results = [];
        var seen = new Set();

        selectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                if (!el || seen.has(el)) return;
                seen.add(el);
                results.push(el);
            });
        });

        document.querySelectorAll('#navEstoqueSubmenu button, #navEstoqueSubmenu a, .stock-submenu button, .stock-submenu a').forEach(function (el) {
            if (!el || seen.has(el)) return;
            if (!matchesStockItemText(item, el.textContent || '')) return;
            seen.add(el);
            results.push(el);
        });

        return results;
    }

    function ensureStockMenuDataAttributes() {
        stockMenuItems.forEach(function (item) {
            getStockMenuElementsForItem(item).forEach(function (el, index) {
                if (!el) return;
                try {
                    if ((!el.id || el.id === item.injectedId) && (!document.getElementById(item.nativeId) || document.getElementById(item.nativeId) === el)) {
                        el.id = item.nativeId;
                    }
                    el.setAttribute('data-stock-tab', item.tab);
                    el.setAttribute('data-stock-key', item.key);
                    el.setAttribute('data-stock-action', 'open');
                    el.setAttribute('data-target-view', getStockViewIdByTab(item.tab));
                    el.classList.add('nav-item-stock');
                    el.classList.add('stock-submenu-item');
                } catch { }
                try {
                    el.querySelectorAll('span, i').forEach(function (child) {
                        child.setAttribute('data-stock-tab', item.tab);
                        child.setAttribute('data-stock-key', item.key);
                        child.setAttribute('data-stock-action', 'open');
                        child.setAttribute('data-target-view', getStockViewIdByTab(item.tab));
                    });
                } catch { }
                if (index === 0) bindStockMenuClick(el, item, true);
            });
        });
    }

    function getDelegatedStockTarget(target) {
        if (!target || !target.closest) return null;
        var selector = '#navStockInventory, #navInventory, #navUsageModels, #navInventoryLogs, #navServiceMapping, #navInventoryReport, #navInventoryReports, [data-stock-action]';
        var item = target.closest(selector);
        if (!item) return null;
        if (!isStockSubmenuTarget(item) && !item.closest('#navEstoqueSubmenu') && !item.closest('.stock-submenu')) return null;
        return item;
    }

    function installDocumentStockDelegation() {
        void 0;
    }

    function installSidebarActiveResetDelegation() {
        void 0;
    }

    function resolveStockTabFromTarget(target) {
        if (!target) return '';
        var safeTarget = target.nodeType === 3 ? target.parentElement : target;
        if (!safeTarget) return '';
        var directTab = String(safeTarget.getAttribute && safeTarget.getAttribute('data-stock-tab') || '');
        if (directTab) return directTab;
        var targetId = String(safeTarget.id || '');
        var text = normalizeStockMenuText(safeTarget.textContent || '');
        if (targetId === 'navInventory' || text.indexOf('inventario') >= 0) return 'stockInventory';
        if (targetId === 'navUsageModels' || text.indexOf('modelos') >= 0) return 'stockModels';
        if (targetId === 'navInventoryLogs' || text.indexOf('movimentacoes') >= 0) return 'stockLogs';
        if (targetId === 'navInventoryReports' || text.indexOf('relatorios') >= 0) return 'stockReports';
        if (targetId === 'navServiceMapping' || text.indexOf('vinculo') >= 0) return 'stockMapping';
        return '';
    }

    function ensureInjectedMenu(forceSuperAdminOpen) {
        var navRoot = getSidebarNav();
        if (!navRoot) return getInjectedRefs();
        var allowedItems = getAllowedStockMenuItems();
        if (!allowedItems.length) return getInjectedRefs();

        var refs = getInjectedRefs();
        if (!refs.root || !refs.submenu) {
            var root = document.createElement('button');
            root.id = 'navEstoqueToggle';
            root.className = 'nav-item nav-item-stock';
            root.type = 'button';
            root.setAttribute('data-tab', 'estoque');
            root.setAttribute('data-stock-group', 'true');
            root.setAttribute('data-occ-injected-stock-toggle', 'true');
            root.setAttribute('aria-controls', 'navEstoqueSubmenu');
            root.innerHTML = ''
                + '<i class="ri-box-3-line"></i>'
                + '<span class="nav-item-label">Estoque</span>'
                + '<i id="navEstoqueToggleIcon" class="ri-arrow-down-s-line nav-toggle-icon"></i>';

            var submenu = document.createElement('div');
            submenu.id = 'navEstoqueSubmenu';
            submenu.className = 'stock-submenu';
            submenu.style.display = 'none';
            submenu.setAttribute('data-stock-group', 'true');
            submenu.setAttribute('data-occ-injected-stock-submenu', 'true');

            var anchor = getMenuInsertReference(navRoot);
            if (anchor && anchor.parentNode === navRoot) {
                navRoot.insertBefore(root, anchor);
                navRoot.insertBefore(submenu, anchor);
            } else {
                navRoot.appendChild(root);
                navRoot.appendChild(submenu);
            }
        }

        refs = getInjectedRefs();
        var isInjectedMenu = !!(refs.root && refs.root.getAttribute && refs.root.getAttribute('data-occ-injected-stock-toggle') === 'true');
        if (refs.submenu && isInjectedMenu) {
            refs.submenu.innerHTML = allowedItems.map(function (item) {
                return ''
                    + '<button id="' + item.nativeId + '" class="nav-item nav-subitem" type="button" data-stock-tab="' + item.tab + '">'
                    + '<i class="' + item.icon + '"></i> <span>' + item.label + '</span>'
                    + '</button>';
            }).join('');
        }
        refs = getInjectedRefs();
        if (refs.root && refs.root.getAttribute && refs.root.getAttribute('data-occ-injected-stock-toggle') === 'true' && !refs.root.__occBoundToggle) {
            refs.root.__occBoundToggle = true;
            refs.root.onclick = function () {
                var open = !!(refs.submenu && refs.submenu.style.display !== 'none');
                applyAccordionState(refs.root, refs.submenu, refs.icon, !open);
            };
        }
        allowedItems.forEach(function (item) {
            bindStockMenuClick(refs.items[item.key], item, true);
        });
        ensureStockMenuDataAttributes();
        bindAllStockMenuClicks(allowedItems);
        forceVisible(refs.root, 'flex');
        void forceSuperAdminOpen;
        return refs;
    }

    function garantirMenuEstoqueImpl() {
        if (syncAbsoluteSuperAdminFlag()) {
            ensureInjectedMenu(true);
            forceShowSidebarForSuperAdmin();
            syncMenuState();
            return getInjectedRefs();
        }
        if (!canAccessAnyStock()) return getInjectedRefs();

        var sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!sidebar) return getInjectedRefs();
        var allowedItems = getAllowedStockMenuItems();
        if (!allowedItems.length) return getInjectedRefs();

        var nativeToggle = document.getElementById('navEstoqueToggle') || document.getElementById('navEstoque');
        if (nativeToggle) {
            forceVisible(nativeToggle, 'flex');
        }

        stockMenuItems.forEach(function (item) {
            var nativeItem = document.getElementById(item.nativeId);
            if (!nativeItem) return;
            if (allowedItems.some(function (allowed) { return allowed.key === item.key; })) {
                forceVisible(nativeItem, 'flex');
            } else {
                nativeItem.style.display = 'none';
            }
        });
        ensureStockMenuDataAttributes();
        bindAllStockMenuClicks(allowedItems);

        var hasCompleteNativeMenu = !!nativeToggle && allowedItems.every(function (item) {
            return !!document.getElementById(item.nativeId);
        });
        var refs = hasCompleteNativeMenu && hasSidebarStockGroup(sidebar) ? getInjectedRefs() : ensureInjectedMenu(false);
        syncMenuState();
        return refs;
    }

    window.garantirMenuEstoque = garantirMenuEstoqueImpl;

    function ensureSuperAdminStockMenuPersistence() {
        if (!syncAbsoluteSuperAdminFlag()) return;
        var sidebarTarget = getSidebarObserverTarget();
        if (!sidebarTarget) return;
        if (!hasSidebarStockGroup(sidebarTarget)) {
            ensureInjectedMenu(true);
        }
        ensureSuperAdminStockStyles();
        stripStockHiddenInlineStyles();
        forceShowSidebarForSuperAdmin();
        syncMenuState();
    }

    var hasPermissionPatched = function (key) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        if (typeof window.__occNativeHasPermission === 'function' && window.__occNativeHasPermission(key)) return true;
        var normalizedKey = String(key || '').trim();
        if (!normalizedKey) return false;
        var keys = getModulePermissionKeys(normalizedKey);
        return hasAliasPermission(keys, 'select');
    };

    var canPatched = function (mod, action) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        if (typeof window.__occNativeCan === 'function' && window.__occNativeCan(mod, action)) return true;
        var modKey = String(mod || '').trim();
        var actionKey = String(action || 'select').trim() || 'select';
        return hasAliasPermission(getModulePermissionKeys(modKey), actionKey);
    };

    var canAccessStockTabPatched = function (tab) {
        if (syncAbsoluteSuperAdminFlag()) return true;
        var tabKey = String(tab || '');
        for (var i = 0; i < stockMenuItems.length; i += 1) {
            if (stockMenuItems[i].tab === tabKey && hasAliasPermission(getItemPermissionKeys(stockMenuItems[i]), 'select')) {
                return true;
            }
        }
        return false;
    };

    function ensureSafeInitialStockRedirect() {
        var currentTab = String(sessionStorage.getItem('lastTab') || window.bootPreferredTab || '');
        var isStockTab = stockMenuItems.some(function (item) { return item.tab === currentTab; });
        var requestedTab = currentTab || 'stockReports';
        if (!isStockTab && requestedTab !== 'stockReports') return;
        var safeTab = resolveAllowedStockTab(requestedTab);
        if (!safeTab || safeTab === requestedTab) return;
        try { sessionStorage.setItem('lastTab', safeTab); } catch { }
        window.bootPreferredTab = safeTab;
        setTimeout(function () {
            try {
                if (typeof window.setActiveTab === 'function') {
                    window.setActiveTab(safeTab);
                }
                loadAndRenderStockTab(safeTab);
            } catch (err) {
                console.warn('Erro isolado no redirecionamento seguro do estoque:', err);
            }
        }, 0);
    }

    function safeRunPatch(activeTab) {
        try {
            syncAbsoluteSuperAdminFlag();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            ensurePermissionHooks();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            if (typeof window.garantirMenuEstoque === 'function') {
                window.garantirMenuEstoque();
            }
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            syncMenuState(activeTab);
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            ensureSafeInitialStockRedirect();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            syncCrudPermissionUi();
        } catch (err) {
            console.warn('Erro isolado na sincronização RBAC de CRUD:', err);
        }
        try {
            forceShowSidebarForSuperAdmin();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
    }

    function schedulePatchRun(activeTab) {
        if (window.__occStockPatchScheduled) return;
        window.__occStockPatchScheduled = true;
        var runner = function () {
            window.__occStockPatchScheduled = false;
            safeRunPatch(activeTab);
        };
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(function () {
                setTimeout(runner, 0);
            });
            return;
        }
        setTimeout(runner, 0);
    }

    function ensurePermissionHooks() {
        syncAbsoluteSuperAdminFlag();
        if (typeof window.hasPermission === 'function' && window.hasPermission !== hasPermissionPatched) {
            if (!window.__occNativeHasPermission) window.__occNativeHasPermission = window.hasPermission;
            window.hasPermission = hasPermissionPatched;
        }
        if (typeof window.can === 'function' && window.can !== canPatched) {
            if (!window.__occNativeCan) window.__occNativeCan = window.can;
            window.can = canPatched;
        }
        if (typeof window.canAccessStockTab === 'function' && window.canAccessStockTab !== canAccessStockTabPatched) {
            if (!window.__occNativeCanAccessStockTab) window.__occNativeCanAccessStockTab = window.canAccessStockTab;
            window.canAccessStockTab = canAccessStockTabPatched;
        }
        if (typeof window.validateAssinaturaStatusGate === 'function' && window.validateAssinaturaStatusGate !== validateAssinaturaStatusGatePatched) {
            if (!window.__occNativeValidateAssinaturaStatusGate) window.__occNativeValidateAssinaturaStatusGate = window.validateAssinaturaStatusGate;
            window.validateAssinaturaStatusGate = validateAssinaturaStatusGatePatched;
        }
    }

    async function validateAssinaturaStatusGatePatched() {
        if (syncAbsoluteSuperAdminFlag()) return true;
        if (typeof window.__occNativeValidateAssinaturaStatusGate === 'function') {
            return window.__occNativeValidateAssinaturaStatusGate.apply(this, arguments);
        }
        return true;
    }

    function wrapGlobalFunction(functionName, markerName, createWrapper) {
        var base = typeof window[functionName] === 'function' ? window[functionName] : null;
        if (!base || base[markerName]) return;
        var wrapped = createWrapper(base);
        if (typeof wrapped !== 'function') return;
        wrapped[markerName] = true;
        if (!window['__occNative_' + functionName]) {
            window['__occNative_' + functionName] = base;
        }
        window[functionName] = wrapped;
    }

    function hookCrudPermissionGuards() {
        wrapGlobalFunction('saveAgendaFromModal', '__occCrudGuardWrapped', function (base) {
            return async function () {
                var agendaIdInput = document.getElementById('agendaId');
                var isEdit = !!String(agendaIdInput && agendaIdInput.value || '').trim();
                var action = isEdit ? 'update' : 'insert';
                if (!canModuleAction('agenda', action)) {
                    showPermissionWarning(action, action === 'update'
                        ? 'Você não tem permissão para editar registros neste módulo'
                        : 'Você não tem permissão para criar registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('deleteAgendaFromModal', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('agenda', 'delete')) {
                    showPermissionWarning('delete', 'Você não tem permissão para excluir registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('saveAgendaDisponibilidade', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('agenda', 'update')) {
                    showPermissionWarning('update', 'Você não tem permissão para editar registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('confirmAtendimentoItem', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('atendimento', 'update')) {
                    showPermissionWarning('update', 'Você não tem permissão para editar registros neste módulo');
                    return { ok: false, reason: 'rbac_update_denied' };
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('finalizeBudgetItem', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('atendimento', 'update')) {
                    showPermissionWarning('update', 'Você não tem permissão para editar registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('finalizarConsultaAvaliacao', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canAnyModuleAction(['agenda', 'atendimento'], 'update')) {
                    showPermissionWarning('update', 'Você não tem permissão para editar registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('deletePatient', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('pacientes', 'delete')) {
                    showPermissionWarning('delete', 'Você não tem permissão para excluir registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('saveInventoryRowWithFallback', '__occCrudGuardWrapped', function (base) {
            return async function (options) {
                var opts = options || {};
                var action = String(opts && opts.id || '').trim() ? 'update' : 'insert';
                if (!canModuleAction('estoque_inventario', action)) {
                    showPermissionWarning(action, action === 'update'
                        ? 'Você não tem permissão para editar registros neste módulo'
                        : 'Você não tem permissão para criar registros neste módulo');
                    return { data: null, error: new Error('RBAC_UPDATE_DELETE_DENIED') };
                }
                return base.apply(this, arguments);
            };
        });

        wrapGlobalFunction('saveServiceModelMapping', '__occCrudGuardWrapped', function (base) {
            return async function () {
                if (!canModuleAction('estoque_vinculos', 'update')) {
                    showPermissionWarning('update', 'Você não tem permissão para editar registros neste módulo');
                    return false;
                }
                return base.apply(this, arguments);
            };
        });
    }

    function installCrudPermissionEventGuards() {
        if (window.__occCrudPermissionEventGuards) return;
        window.__occCrudPermissionEventGuards = true;

        document.addEventListener('submit', function (event) {
            try {
                var form = event.target;
                if (!form || !form.id) return;
                if (form.id === 'formAgenda') {
                    var agendaIdInput = document.getElementById('agendaId');
                    var agendaAction = String(agendaIdInput && agendaIdInput.value || '').trim() ? 'update' : 'insert';
                    if (!canModuleAction('agenda', agendaAction)) {
                        blockEventByPermission(event, agendaAction, agendaAction === 'update'
                            ? 'Você não tem permissão para editar registros neste módulo'
                            : 'Você não tem permissão para criar registros neste módulo');
                    }
                    return;
                }
                if (form.id === 'patientForm') {
                    var patientEditId = document.getElementById('editId');
                    var patientAction = String(patientEditId && patientEditId.value || '').trim() ? 'update' : 'insert';
                    if (!canModuleAction('pacientes', patientAction)) {
                        blockEventByPermission(event, patientAction, patientAction === 'update'
                            ? 'Você não tem permissão para editar registros neste módulo'
                            : 'Você não tem permissão para criar registros neste módulo');
                    }
                    return;
                }
                if (form.id === 'inventoryForm') {
                    var inventoryEditId = document.getElementById('inventoryEditId');
                    var inventoryAction = String(inventoryEditId && inventoryEditId.value || '').trim() ? 'update' : 'insert';
                    if (!canModuleAction('estoque_inventario', inventoryAction)) {
                        blockEventByPermission(event, inventoryAction, inventoryAction === 'update'
                            ? 'Você não tem permissão para editar registros neste módulo'
                            : 'Você não tem permissão para criar registros neste módulo');
                    }
                    return;
                }
                if (form.id === 'usageModelForm' && !canModuleAction('estoque_modelos', 'insert')) {
                    blockEventByPermission(event, 'insert', 'Você não tem permissão para criar registros neste módulo');
                    return;
                }
                if (form.id === 'modelItemForm' && !canModuleAction('estoque_modelos', 'update')) {
                    blockEventByPermission(event, 'update', 'Você não tem permissão para editar registros neste módulo');
                }
            } catch (err) {
                console.warn('Erro isolado no guard de submit RBAC:', err);
            }
        }, true);

        document.addEventListener('change', function (event) {
            try {
                var target = event.target;
                if (!target) return;
                if (target.closest('.js-service-model-select') && !canModuleAction('estoque_vinculos', 'update')) {
                    blockEventByPermission(event, 'update', 'Você não tem permissão para editar registros neste módulo');
                }
            } catch (err) {
                console.warn('Erro isolado no guard de change RBAC:', err);
            }
        }, true);
    }

    function syncAgendaCrudUi() {
        var canAgendaInsert = canModuleAction('agenda', 'insert');
        var canAgendaUpdate = canModuleAction('agenda', 'update');
        var canAgendaDelete = canModuleAction('agenda', 'delete');
        document.querySelectorAll('#agendaSlotsBody button[data-action="edit"]').forEach(function (btn) {
            setElementHiddenByPermission(btn, canAgendaUpdate, 'Sem permissão para editar');
        });
        document.querySelectorAll('#agendaSlotsBody button[data-action="new"]').forEach(function (btn) {
            setElementHiddenByPermission(btn, canAgendaInsert, 'Sem permissão para criar');
        });
        var agendaForm = document.getElementById('formAgenda');
        var agendaIdInput = document.getElementById('agendaId');
        var isEdit = !!String(agendaIdInput && agendaIdInput.value || '').trim();
        var canSaveAgenda = isEdit ? canAgendaUpdate : canAgendaInsert;
        var btnAgendaSave = document.getElementById('btnAgendaSave');
        var btnAgendaDelete = document.getElementById('btnAgendaDelete');
        setElementDisabledByPermission(btnAgendaSave, canSaveAgenda, 'Sem permissão para salvar alterações');
        setElementHiddenByPermission(btnAgendaDelete, isEdit && canAgendaDelete, 'Sem permissão para excluir');
        setFormEditableByPermission(agendaForm, canSaveAgenda, '#btnAgendaDelete, #btnAgendaSave, button[type="button"]');
    }

    function syncPatientCrudUi() {
        var canPatientInsert = canModuleAction('pacientes', 'insert');
        var canPatientUpdate = canModuleAction('pacientes', 'update');
        var canPatientDelete = canModuleAction('pacientes', 'delete');
        var patientForm = document.getElementById('patientForm');
        var patientEditId = document.getElementById('editId');
        var isEdit = !!String(patientEditId && patientEditId.value || '').trim();
        var canSavePatient = isEdit ? canPatientUpdate : canPatientInsert;
        setElementDisabledByPermission(document.getElementById('btnSavePatient'), canSavePatient, 'Sem permissão para salvar');
        setFormEditableByPermission(patientForm, canSavePatient, '#btnSavePatient, #btnCancelPatient');
        document.querySelectorAll('[onclick*="deletePatient("]').forEach(function (btn) {
            setElementHiddenByPermission(btn, canPatientDelete, 'Sem permissão para excluir');
        });
    }

    function syncAtendimentoCrudUi() {
        var canAtendimentoUpdate = canModuleAction('atendimento', 'update');
        setElementHiddenByPermission(document.getElementById('btnAtendimentoFinalizeSelected'), canAtendimentoUpdate, 'Sem permissão para editar');
        document.querySelectorAll('[onclick*="finalizeBudgetItem("]').forEach(function (btn) {
            setElementHiddenByPermission(btn, canAtendimentoUpdate, 'Sem permissão para editar');
        });
        document.querySelectorAll('[onclick*="finalizarConsultaAvaliacao("]').forEach(function (btn) {
            setElementHiddenByPermission(btn, canAnyModuleAction(['agenda', 'atendimento'], 'update'), 'Sem permissão para editar');
        });
    }

    function syncStockCrudUi() {
        var canInvInsert = canModuleAction('estoque_inventario', 'insert');
        var canInvUpdate = canModuleAction('estoque_inventario', 'update');
        var canInvDelete = canModuleAction('estoque_inventario', 'delete');
        var canModelInsert = canModuleAction('estoque_modelos', 'insert');
        var canModelUpdate = canModuleAction('estoque_modelos', 'update');
        var canModelDelete = canModuleAction('estoque_modelos', 'delete');
        var canMapUpdate = canModuleAction('estoque_vinculos', 'update');

        var inventoryForm = document.getElementById('inventoryForm');
        var inventoryEditId = document.getElementById('inventoryEditId');
        var isInventoryEdit = !!String(inventoryEditId && inventoryEditId.value || '').trim();
        var canSaveInventory = isInventoryEdit ? canInvUpdate : canInvInsert;
        setElementDisabledByPermission(document.getElementById('btnInventorySave'), canSaveInventory, 'Sem permissão para salvar');
        setFormEditableByPermission(inventoryForm, canSaveInventory, '#btnInventorySave, button[type="button"]');

        var usageForm = document.getElementById('usageModelForm');
        var usageSubmit = usageForm ? usageForm.querySelector('button[type="submit"]') : null;
        setElementHiddenByPermission(usageSubmit, canModelInsert, 'Sem permissão para criar');
        setFormEditableByPermission(usageForm, canModelInsert, 'button[type="submit"]');

        var modelItemForm = document.getElementById('modelItemForm');
        var btnSaveModelItems = document.getElementById('btnSaveModelItems');
        setElementDisabledByPermission(btnSaveModelItems, canModelUpdate, 'Sem permissão para editar');
        setFormEditableByPermission(modelItemForm, canModelUpdate, '#btnSaveModelItems');

        document.querySelectorAll('.js-inv-del').forEach(function (btn) {
            setElementHiddenByPermission(btn, canInvDelete, 'Sem permissão para excluir');
        });
        document.querySelectorAll('.js-inv-entry-nf').forEach(function (btn) {
            setElementHiddenByPermission(btn, canInvUpdate || canInvInsert, 'Sem permissão para editar');
        });
        document.querySelectorAll('.js-inv-toggle-active').forEach(function (btn) {
            setElementHiddenByPermission(btn, canInvUpdate, 'Sem permissão para editar');
        });
        document.querySelectorAll('.js-model-del, .js-model-item-del').forEach(function (btn) {
            setElementHiddenByPermission(btn, canModelDelete, 'Sem permissão para excluir');
        });
        document.querySelectorAll('.js-service-model-select').forEach(function (el) {
            setElementDisabledByPermission(el, canMapUpdate, 'Sem permissão para editar');
        });
    }

    function syncCrudPermissionUi() {
        syncAgendaCrudUi();
        syncPatientCrudUi();
        syncAtendimentoCrudUi();
        syncStockCrudUi();
    }

    var masterTablesTemplateLoadState = {
        allLoaded: false,
        kitsLoaded: false,
        inventoryLoaded: false,
        allLoadingPromise: null,
        kitsLoadingPromise: null,
        inventoryLoadingPromise: null
    };

    function isMissingSupabaseTableError(error) {
        var code = String(error && (error.code || error.status || error.statusCode) || '').trim().toUpperCase();
        var message = String(error && (error.message || error.details || error.hint) || '').toLowerCase();
        return code === 'PGRST205'
            || code === '42P01'
            || message.indexOf('does not exist') >= 0
            || message.indexOf('not found') >= 0
            || message.indexOf('could not find the table') >= 0
            || message.indexOf('relation') >= 0 && message.indexOf('does not exist') >= 0;
    }

    async function queryExistingTable(tableNames, orderBy, options) {
        var client = window.db || window.supabase || db;
        var tables = Array.isArray(tableNames) ? tableNames : [tableNames];
        var lastError = null;
        var queryOptions = options || {};

        for (var i = 0; i < tables.length; i += 1) {
            var tableName = String(tables[i] || '').trim();
            if (!tableName) continue;
            try {
                var builder = client.from(tableName).select(String(queryOptions.select || '*'));
                if (queryOptions.limit && Number(queryOptions.limit) > 0) {
                    builder = builder.limit(Number(queryOptions.limit));
                }
                if (orderBy) {
                    builder = builder.order(orderBy, { ascending: queryOptions.ascending !== false });
                }
                var result = await builder;
                if (!result || !result.error) {
                    return {
                        table: tableName,
                        data: result && Array.isArray(result.data) ? result.data : [],
                        error: null
                    };
                }
                lastError = result.error;
                if (!isMissingSupabaseTableError(result.error)) {
                    return {
                        table: tableName,
                        data: [],
                        error: result.error
                    };
                }
            } catch (err) {
                lastError = err;
                if (!isMissingSupabaseTableError(err)) {
                    return {
                        table: tableName,
                        data: [],
                        error: err
                    };
                }
            }
        }

        return {
            table: '',
            data: [],
            error: lastError
        };
    }

    function updateMasterTemplateInventoryDerivedState() {
        try {
            var modelNameById = new Map((usageModels || []).map(function (m) {
                return [String(m && m.id || ''), String(m && m.nome_modelo || '')];
            }));
            var invArea = new Map();
            (usageModelItems || []).forEach(function (mi) {
                var invId = String(mi && mi.inventory_id || '');
                if (!invId || invArea.has(invId)) return;
                var areaByModel = getAreaFromModelName(modelNameById.get(String(mi && mi.model_id || '')) || '');
                if (areaByModel) invArea.set(invId, areaByModel);
            });
            inventoryAreaById = invArea;

            var rows = (inventoryItems || []).filter(function (r) {
                if (!r || typeof r !== 'object') return false;
                if (Object.prototype.hasOwnProperty.call(r, 'ativo')) return !!r.ativo;
                return true;
            });
            var fromDbColumns = rows.map(function (r) {
                return normalizeInventoryArea(r && (r.area || r.categoria) || '');
            }).filter(function (a) { return a; });
            var fromDbModels = Array.from(new Set(Array.from(invArea.values())));
            var fromDb = Array.from(new Set([].concat(fromDbColumns, fromDbModels)));
            var canonical = typeof getCanonicalInventoryAreas === 'function' ? getCanonicalInventoryAreas() : [];
            inventoryAreaOptions = Array.from(new Set([].concat(canonical, fromDb)));
        } catch (err) {
            console.warn('Erro isolado ao recalcular metadados das Tabelas Padrão:', err);
        }
    }

    function buildFallbackModelsFromTemplateItems(items) {
        var rows = Array.isArray(items) ? items : [];
        var map = new Map();
        rows.forEach(function (item) {
            var modelId = String(item && item.model_id || '').trim();
            if (!modelId || map.has(modelId)) return;
            map.set(modelId, {
                id: modelId,
                nome_modelo: String(item && (item.nome_modelo || item.model_name || item.model_id) || '').trim() || ('Modelo ' + String(modelId).slice(0, 8)),
                include_biosseguranca: true
            });
        });
        return Array.from(map.values()).sort(function (a, b) {
            return String(a && a.nome_modelo || '').localeCompare(String(b && b.nome_modelo || ''), 'pt-BR');
        });
    }

    function getMasterTablesPanelIdByScope(scope) {
        var normalizedScope = String(scope || '').trim().toLowerCase();
        if (normalizedScope === 'kits') return 'usageModelsView';
        if (normalizedScope === 'inventory') return 'inventoryView';
        if (normalizedScope === 'specialties') return 'specialtiesListView';
        if (normalizedScope === 'services') return 'servicesListView';
        return '';
    }

    function getMasterTablesPanelIds() {
        return ['specialtiesListView', 'servicesListView', 'usageModelsView', 'inventoryView'];
    }

    function ensureMasterTablesPanelMounted(panelId) {
        var panel = document.getElementById(String(panelId || '').trim());
        var content = document.getElementById('masterTablesContent');
        if (!panel || !content) return panel;
        try {
            if (panel.parentElement !== content) {
                content.appendChild(panel);
            }
        } catch { }
        return panel;
    }

    function forceMasterTablesPanelVisible(panel) {
        if (!panel) return;
        try {
            removeHiddenState(panel);
            panel.style.display = 'block';
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
        } catch { }

        try {
            var wrappers = panel.querySelectorAll('.table-container, table, .form-card, .section-header');
            wrappers.forEach(function (el) {
                if (!el) return;
                removeHiddenState(el);
                if (el.tagName === 'TABLE') {
                    el.style.display = 'table';
                } else {
                    el.style.display = el.classList.contains('section-header') ? 'flex' : 'block';
                }
                el.style.visibility = 'visible';
                el.style.opacity = '1';
            });
        } catch { }
    }

    function hideMasterTablesPanel(panel) {
        if (!panel) return;
        try { panel.classList.add('hidden'); } catch { }
        try {
            panel.style.display = 'none';
            panel.style.visibility = 'hidden';
            panel.style.opacity = '0';
        } catch { }
    }

    function ensureMasterTablesScopeVisible(scope) {
        var masterTablesView = document.getElementById('masterTablesView');
        var masterTablesContent = document.getElementById('masterTablesContent');
        var panelId = getMasterTablesPanelIdByScope(scope);
        var targetPanel = ensureMasterTablesPanelMounted(panelId);

        if (masterTablesView) {
            removeHiddenState(masterTablesView);
            masterTablesView.style.display = 'block';
            masterTablesView.style.visibility = 'visible';
            masterTablesView.style.opacity = '1';
        }
        if (masterTablesContent) {
            removeHiddenState(masterTablesContent);
            masterTablesContent.style.display = 'block';
            masterTablesContent.style.visibility = 'visible';
            masterTablesContent.style.opacity = '1';
        }

        getMasterTablesPanelIds().forEach(function (id) {
            var panel = ensureMasterTablesPanelMounted(id);
            if (!panel) return;
            if (id === panelId) {
                forceMasterTablesPanelVisible(panel);
            } else {
                hideMasterTablesPanel(panel);
            }
        });

        return targetPanel;
    }

    function getModelItemsCountForFallback(modelId) {
        var safeId = String(modelId || '').trim();
        if (!safeId) return 0;
        return (usageModelItems || []).filter(function (item) {
            return String(item && item.model_id || '').trim() === safeId;
        }).length;
    }

    function renderMasterKitsTable(rows) {
        var body = document.getElementById('usageModelsTableBody');
        var empty = document.getElementById('usageModelsEmptyState');
        if (!body) return;
        var data = Array.isArray(rows) ? rows : [];
        if (!data.length) {
            body.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        body.innerHTML = data.map(function (model) {
            var id = String(model && model.id || '');
            var nome = String(model && model.nome_modelo || '—');
            var qtdItens = getModelItemsCountForFallback(id);
            return ''
                + '<tr>'
                + '<td><strong>' + nome + '</strong></td>'
                + '<td>' + qtdItens + '</td>'
                + '<td><button type="button" class="btn-icon js-occ-master-kit-select" data-id="' + id + '" title="Selecionar"><i class="ri-list-check-2"></i></button></td>'
                + '</tr>';
        }).join('');
        body.querySelectorAll('.js-occ-master-kit-select').forEach(function (btn) {
            btn.onclick = function () {
                try { estoqueActiveModelId = String(btn.getAttribute('data-id') || ''); } catch { }
                try {
                    if (typeof window.renderUsageModelsTable === 'function') window.renderUsageModelsTable();
                } catch { }
                try {
                    if (typeof window.renderModelItemsEditor === 'function') window.renderModelItemsEditor();
                } catch { }
            };
        });
    }

    function renderMasterInventoryTable(rows) {
        var body = document.getElementById('inventoryTableBody');
        var empty = document.getElementById('inventoryEmptyState');
        if (!body) return;
        var data = Array.isArray(rows) ? rows : [];
        if (!data.length) {
            body.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');
        body.innerHTML = data.map(function (item) {
            var nome = String(item && item.nome || '—');
            var unidade = String(item && item.unidade || '—');
            var saldo = String(item && (item.estoque_atual != null ? item.estoque_atual : 0) || '0');
            var minimo = String(item && (item.estoque_minimo != null ? item.estoque_minimo : 0) || '0');
            var ativo = Object.prototype.hasOwnProperty.call(item || {}, 'ativo') ? (item && item.ativo ? 'Sim' : 'Nao') : 'Sim';
            return ''
                + '<tr>'
                + '<td><strong>' + nome + '</strong></td>'
                + '<td>' + unidade + '</td>'
                + '<td>' + saldo + '</td>'
                + '<td>' + minimo + '</td>'
                + '<td>' + ativo + '</td>'
                + '<td>—</td>'
                + '</tr>';
        }).join('');
    }

    function getSidebarActiveStateSnapshot() {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return [];
        return Array.from(sidebar.querySelectorAll('.active')).filter(function (el) {
            return !!el && !String(el.id || '').trim().match(/^tabMaster/i);
        });
    }

    function restoreSidebarActiveStateSnapshot(snapshot) {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        var keep = new Set((Array.isArray(snapshot) ? snapshot : []).filter(Boolean));
        Array.from(sidebar.querySelectorAll('.active')).forEach(function (el) {
            if (keep.has(el)) return;
            try { el.classList.remove('active'); } catch { }
        });
        keep.forEach(function (el) {
            try { el.classList.add('active'); } catch { }
        });
    }

    function scheduleSidebarStateRestore(snapshot) {
        setTimeout(function () {
            try { restoreSidebarActiveStateSnapshot(snapshot); } catch { }
        }, 0);
        setTimeout(function () {
            try { restoreSidebarActiveStateSnapshot(snapshot); } catch { }
        }, 30);
    }

    function hideAllMasterTablesPanels() {
        var panelIds = getMasterTablesPanelIds();
        panelIds.forEach(function (id) {
            var panel = ensureMasterTablesPanelMounted(id);
            if (!panel) return;
            try {
                panel.classList.add('hidden');
                panel.style.display = 'none';
                panel.style.visibility = 'hidden';
                panel.style.opacity = '0';
            } catch { }
        });

        try {
            var content = document.getElementById('masterTablesContent');
            if (content) {
                content.querySelectorAll(':scope > div, :scope > section').forEach(function (el) {
                    if (!el) return;
                    if (panelIds.indexOf(String(el.id || '')) >= 0) return;
                    try {
                        el.classList.add('hidden');
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.style.opacity = '0';
                    } catch { }
                });
            }
        } catch { }
    }

    function syncMasterTablesTabButtons(activeButtonId) {
        document.querySelectorAll('#masterTablesView .tabs button').forEach(function (btn) {
            try {
                btn.classList.remove('active', 'btn-primary');
                btn.classList.add('btn-secondary');
            } catch { }
        });
        var activeButton = document.getElementById(String(activeButtonId || '').trim());
        if (!activeButton) return;
        try {
            activeButton.classList.add('active', 'btn-primary');
            activeButton.classList.remove('btn-secondary');
        } catch { }
    }

    function switchMasterTablesPanel(scope) {
        var normalizedScope = String(scope || '').trim().toLowerCase();
        var panelId = getMasterTablesPanelIdByScope(normalizedScope);
        if (!panelId) return null;

        hideAllMasterTablesPanels();
        var panel = ensureMasterTablesScopeVisible(normalizedScope);

        if (normalizedScope === 'specialties' || normalizedScope === 'services') {
            try {
                if (typeof window.showList === 'function') {
                    window.showList(normalizedScope, true);
                } else if (typeof showList === 'function') {
                    showList(normalizedScope, true);
                }
            } catch (err) {
                console.warn('Erro isolado ao alternar Tabelas Padrão para ' + normalizedScope + ':', err);
                if (panel) forceMasterTablesPanelVisible(panel);
            }
        } else if (normalizedScope === 'kits') {
            refreshMasterTablesTemplateView('kits');
        } else if (normalizedScope === 'inventory') {
            refreshMasterTablesTemplateView('inventory');
        }

        if (panel) {
            forceMasterTablesPanelVisible(panel);
        }
        return panel;
    }

    function installSidebarSingleActiveHandler() {
        var sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!sidebar || sidebar.__occSingleActiveHandlerBound) return;
        sidebar.__occSingleActiveHandlerBound = true;

        sidebar.addEventListener('click', function (e) {
            var clicked = e.target && e.target.closest ? e.target.closest('.nav-link, .nav-item, .nav-subitem') : null;
            if (!clicked || !sidebar.contains(clicked)) return;
            setTimeout(function () {
                try {
                    sidebar.querySelectorAll('.nav-link, .nav-item, .nav-subitem').forEach(function (nav) {
                        nav.classList.remove('active');
                    });
                    clicked.classList.add('active');
                } catch (err) {
                    console.warn('Erro isolado ao normalizar active da sidebar:', err);
                }
            }, 0);
        });
    }

    async function loadMasterTablesTemplateData(target, forceReload) {
        if (!window.__isMasterTablesMode) return;

        var scope = String(target || 'all').trim().toLowerCase() || 'all';
        var promiseKey = scope + 'LoadingPromise';
        var loadedKey = scope + 'Loaded';

        if (!forceReload && scope !== 'all' && masterTablesTemplateLoadState[loadedKey]) return;
        if (!forceReload && scope === 'all' && masterTablesTemplateLoadState.allLoaded) return;
        if (masterTablesTemplateLoadState[promiseKey]) return masterTablesTemplateLoadState[promiseKey];

        masterTablesTemplateLoadState[promiseKey] = Promise.resolve().then(async function () {
            var shouldLoadKits = scope === 'all' || scope === 'kits';
            var shouldLoadInventory = scope === 'all' || scope === 'inventory';

            if (shouldLoadKits) {
                var modelItemsRes = await queryExistingTable(['model_items_template'], 'model_id');
                if (modelItemsRes.error && !isMissingSupabaseTableError(modelItemsRes.error)) {
                    console.warn('Erro isolado ao carregar model_items_template:', modelItemsRes.error);
                }

                var modelsRes = await queryExistingTable(['usage_models_template'], 'nome_modelo');
                if (modelsRes.error && !isMissingSupabaseTableError(modelsRes.error)) {
                    console.warn('Erro isolado ao carregar usage_models_template:', modelsRes.error);
                }

                try {
                    usageModelItems = Array.isArray(modelItemsRes.data) ? modelItemsRes.data : [];
                } catch { }
                try {
                    usageModels = Array.isArray(modelsRes.data) && modelsRes.data.length
                        ? modelsRes.data
                        : buildFallbackModelsFromTemplateItems(modelItemsRes.data);
                } catch { }

                masterTablesTemplateLoadState.kitsLoaded = true;
            }

            if (shouldLoadInventory || shouldLoadKits) {
                var inventoryRes = await queryExistingTable(['inventory_template', 'inventury_template'], 'nome');
                if (inventoryRes.error && !isMissingSupabaseTableError(inventoryRes.error)) {
                    console.warn('Erro isolado ao carregar inventory_template/inventury_template:', inventoryRes.error);
                }
                try {
                    inventoryItems = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
                } catch { }
                masterTablesTemplateLoadState.inventoryLoaded = true;
            }

            updateMasterTemplateInventoryDerivedState();

            if (scope === 'all') {
                masterTablesTemplateLoadState.allLoaded = true;
            }

            try {
                window.__estoqueLoadedEmpresa = '__master_tables_templates__';
            } catch { }
        }).finally(function () {
            masterTablesTemplateLoadState[promiseKey] = null;
        });

        return masterTablesTemplateLoadState[promiseKey];
    }

    function refreshMasterTablesTemplateView(target) {
        var scope = String(target || 'all').trim().toLowerCase() || 'all';
        try {
            if (scope === 'all' || scope === 'kits') {
                if (scope === 'kits') ensureMasterTablesScopeVisible('kits');
                if (typeof window.renderUsageModelsTable === 'function') window.renderUsageModelsTable();
                if (typeof window.renderModelItemsEditor === 'function') window.renderModelItemsEditor();
                var kitsBody = document.getElementById('usageModelsTableBody');
                if (kitsBody && !String(kitsBody.innerHTML || '').trim() && Array.isArray(usageModels) && usageModels.length) {
                    renderMasterKitsTable(usageModels);
                }
            }
        } catch (err) {
            console.warn('Erro isolado ao renderizar Modelos / Kits padrão:', err);
            try {
                renderMasterKitsTable(usageModels || []);
                if (scope === 'kits') ensureMasterTablesScopeVisible('kits');
            } catch { }
        }
        try {
            if (scope === 'all' || scope === 'inventory') {
                if (scope === 'inventory') ensureMasterTablesScopeVisible('inventory');
                if (typeof window.renderInventoryTable === 'function') window.renderInventoryTable();
                var inventoryBody = document.getElementById('inventoryTableBody');
                if (inventoryBody && !String(inventoryBody.innerHTML || '').trim() && Array.isArray(inventoryItems) && inventoryItems.length) {
                    renderMasterInventoryTable(inventoryItems);
                }
            }
        } catch (err) {
            console.warn('Erro isolado ao renderizar Inventário Padrão:', err);
            try {
                renderMasterInventoryTable(inventoryItems || []);
                if (scope === 'inventory') ensureMasterTablesScopeVisible('inventory');
            } catch { }
        }
    }

    function bindMasterTablesTemplateTabHandlers() {
        var sidebarSnapshot = getSidebarActiveStateSnapshot;
        var tabMasterKits = document.getElementById('tabMasterKits');
        var tabMasterInventory = document.getElementById('tabMasterInventory');
        var tabMasterSpecialties = document.getElementById('tabMasterSpecialties');
        var tabMasterServices = document.getElementById('tabMasterServices');

        if (tabMasterKits && !tabMasterKits.__occTemplateDataBound) {
            tabMasterKits.__occTemplateDataBound = true;
            tabMasterKits.addEventListener('click', function () {
                var snapshot = sidebarSnapshot();
                syncMasterTablesTabButtons('tabMasterKits');
                switchMasterTablesPanel('kits');
                scheduleSidebarStateRestore(snapshot);
                setTimeout(function () {
                    loadMasterTablesTemplateData('kits', true).then(function () {
                        switchMasterTablesPanel('kits');
                        scheduleSidebarStateRestore(snapshot);
                    }).catch(function (err) {
                        console.warn('Erro isolado ao carregar aba Modelos / Kits:', err);
                        scheduleSidebarStateRestore(snapshot);
                    });
                }, 0);
            });
        }

        if (tabMasterInventory && !tabMasterInventory.__occTemplateDataBound) {
            tabMasterInventory.__occTemplateDataBound = true;
            tabMasterInventory.addEventListener('click', function () {
                var snapshot = sidebarSnapshot();
                syncMasterTablesTabButtons('tabMasterInventory');
                switchMasterTablesPanel('inventory');
                scheduleSidebarStateRestore(snapshot);
                setTimeout(function () {
                    loadMasterTablesTemplateData('inventory', true).then(function () {
                        switchMasterTablesPanel('inventory');
                        scheduleSidebarStateRestore(snapshot);
                    }).catch(function (err) {
                        console.warn('Erro isolado ao carregar aba Inventário Padrão:', err);
                        scheduleSidebarStateRestore(snapshot);
                    });
                }, 0);
            });
        }

        if (tabMasterSpecialties && !tabMasterSpecialties.__occSidebarStateGuardBound) {
            tabMasterSpecialties.__occSidebarStateGuardBound = true;
            tabMasterSpecialties.addEventListener('click', function () {
                syncMasterTablesTabButtons('tabMasterSpecialties');
                switchMasterTablesPanel('specialties');
                scheduleSidebarStateRestore(sidebarSnapshot());
            });
        }

        if (tabMasterServices && !tabMasterServices.__occSidebarStateGuardBound) {
            tabMasterServices.__occSidebarStateGuardBound = true;
            tabMasterServices.addEventListener('click', function () {
                syncMasterTablesTabButtons('tabMasterServices');
                switchMasterTablesPanel('services');
                scheduleSidebarStateRestore(sidebarSnapshot());
            });
        }
    }

    function hookLoadMasterTablesData() {
        wrapGlobalFunction('loadMasterTablesData', '__occMasterTablesTemplateWrapped', function (base) {
            return function () {
                var result = base.apply(this, arguments);
                setTimeout(function () {
                    try {
                        bindMasterTablesTemplateTabHandlers();
                    } catch (err) {
                        console.warn('Erro isolado ao vincular abas de Tabelas Padrão:', err);
                    }
                    try {
                        loadMasterTablesTemplateData('all', false).then(function () {
                            var activeTabId = '';
                            try {
                                activeTabId = String(Array.from(document.querySelectorAll('#masterTablesView .tabs button')).find(function (btn) {
                                    return btn && btn.classList.contains('active');
                                }) && Array.from(document.querySelectorAll('#masterTablesView .tabs button')).find(function (btn) {
                                    return btn && btn.classList.contains('active');
                                }).id || '');
                            } catch { }
                            if (activeTabId === 'tabMasterKits') {
                                syncMasterTablesTabButtons('tabMasterKits');
                                switchMasterTablesPanel('kits');
                            } else if (activeTabId === 'tabMasterInventory') {
                                syncMasterTablesTabButtons('tabMasterInventory');
                                switchMasterTablesPanel('inventory');
                            } else if (activeTabId === 'tabMasterServices') {
                                syncMasterTablesTabButtons('tabMasterServices');
                                switchMasterTablesPanel('services');
                            } else {
                                syncMasterTablesTabButtons('tabMasterSpecialties');
                                switchMasterTablesPanel('specialties');
                            }
                        }).catch(function (err) {
                            console.warn('Erro isolado ao carregar templates de Tabelas Padrão:', err);
                        });
                    } catch (err) {
                        console.warn('Erro isolado ao iniciar templates de Tabelas Padrão:', err);
                    }
                }, 0);
                return result;
            };
        });
    }

    function hookLoadEstoqueData() {
        var base = typeof window.loadEstoqueData === 'function' ? window.loadEstoqueData : null;
        if (!base || base.__occStockReportsWrapped) return;
        if (!window.__occNativeLoadEstoqueData) window.__occNativeLoadEstoqueData = base;
        var wrapped = function () {
            if (hasAnyActiveStockPermission()) {
                try {
                    ensureStockSessionPermissions(String(sessionStorage.getItem('lastTab') || ''));
                } catch (err) {
                    console.warn('Erro isolado no patch de estoque:', err);
                }
            }
            var baseResult = base.apply(this, arguments);
            return Promise.resolve(baseResult).then(function (result) {
                if (!window.__isMasterTablesMode) return result;
                var target = 'all';
                try {
                    var lastTab = String(sessionStorage.getItem('lastTab') || '');
                    if (lastTab === 'stockModels') target = 'kits';
                    else if (lastTab === 'stockInventory') target = 'inventory';
                } catch { }
                return loadMasterTablesTemplateData(target, true).then(function () {
                    refreshMasterTablesTemplateView(target);
                    return result;
                }).catch(function (err) {
                    console.warn('Erro isolado ao complementar carga de Tabelas Padrão:', err);
                    return result;
                });
            });
        };
        wrapped.__occStockReportsWrapped = true;
        window.loadEstoqueData = wrapped;
    }

    function hookRenderInventoryLogsTable() {
        var base = typeof window.renderInventoryLogsTable === 'function' ? window.renderInventoryLogsTable : null;
        if (!base || base.__occStockReportsWrapped) return;
        if (!window.__occNativeRenderInventoryLogsTable) window.__occNativeRenderInventoryLogsTable = base;
        var wrapped = function () {
            if (!canAccessStockTabPatched('stockLogs')) {
                return base.apply(this, arguments);
            }
            var originalIsDentistRole = window.isDentistRole;
            try {
                if (typeof originalIsDentistRole === 'function') {
                    window.isDentistRole = function () { return false; };
                }
                return base.apply(this, arguments);
            } finally {
                if (typeof originalIsDentistRole === 'function') {
                    window.isDentistRole = originalIsDentistRole;
                }
            }
        };
        wrapped.__occStockReportsWrapped = true;
        window.renderInventoryLogsTable = wrapped;
    }

    function hookSidebarSync() {
        var base = typeof window.updateSidebarVisibility === 'function' ? window.updateSidebarVisibility : null;
        if (!base || base.__occStockReportsWrapped) return;
        if (!window.__occNativeUpdateSidebarVisibility) window.__occNativeUpdateSidebarVisibility = base;
        var wrapped = function () {
            var result;
            if (typeof base === 'function') {
                try {
                    result = base.apply(this, arguments);
                } catch (err) {
                    console.error(err);
                }
            }
            try {
                ensureMainAppContainersVisible();
            } catch (err) {
                console.warn('Erro isolado no patch de estoque:', err);
            }
            return result;
        };
        wrapped.__occStockReportsWrapped = true;
        window.updateSidebarVisibility = wrapped;
    }

    function hookSidebarRenderFunctions() {
        var hookNames = [
            'renderSidebar',
            'syncSidebar',
            'updateNavigation',
            'renderNavigation',
            'syncNavigation',
            'renderMenu',
            'updateMenu'
        ];
        hookNames.forEach(function (name) {
            var base = window[name];
            if (typeof base !== 'function' || base.__occStockReportsWrapped) return;
            var wrapped = function () {
                var result;
                try {
                    result = base.apply(this, arguments);
                } catch (err) {
                    console.error(err);
                }
                try {
                    ensureMainAppContainersVisible();
                } catch (err) {
                    console.warn('Erro isolado no patch de estoque:', err);
                }
                return result;
            };
            wrapped.__occStockReportsWrapped = true;
            window[name] = wrapped;
        });
    }

    function hookSetActiveTab() {
        var base = typeof window.setActiveTab === 'function' ? window.setActiveTab : null;
        if (!base || base.__occStockReportsWrapped) return;
        if (!window.__occNativeSetActiveTab) window.__occNativeSetActiveTab = base;
        var wrapped = function (tab) {
            var targetTab = String(tab || '').trim();
            if (targetTab && !isStockTab(targetTab)) {
                try {
                    window.hideStockViews();
                } catch (err) {
                    console.warn('Erro isolado ao ocultar telas do estoque:', err);
                }
            }
            var result;
            if (typeof base === 'function') {
                try {
                    result = base.apply(this, arguments);
                } catch (err) {
                    console.error(err);
                }
            }
            try {
                ensureMainAppContainersVisible();
            } catch (err) {
                console.warn('Erro isolado no patch de estoque:', err);
            }
            if (targetTab && !isStockTab(targetTab)) {
                try {
                    window.hideStockViews();
                } catch (err) {
                    console.warn('Erro isolado ao ocultar telas do estoque:', err);
                }
            }
            return result;
        };
        wrapped.__occStockReportsWrapped = true;
        window.setActiveTab = wrapped;
    }

    function stopReactivePatchLoops() {
        if (window.__occStockSidebarObserver) {
            try { window.__occStockSidebarObserver.disconnect(); } catch { }
            window.__occStockSidebarObserver = null;
        }
        if (window.__occStockReportsPatchObserver) {
            try { window.__occStockReportsPatchObserver.disconnect(); } catch { }
            window.__occStockReportsPatchObserver = null;
        }
        if (window.__occStockReportsPatchPolling) {
            try { window.clearInterval(window.__occStockReportsPatchPolling); } catch { }
            window.__occStockReportsPatchPolling = null;
        }
    }

    function initializeStockPatch(forcePermissionReload) {
        ensureMainAppContainersVisible();
        var sessionChanged = false;
        try {
            sessionChanged = syncSessionIdentity(false);
        } catch (err) {
            console.warn('Erro isolado ao sincronizar sessao do estoque:', err);
        }
        syncAbsoluteSuperAdminFlag();
        try {
            if (forcePermissionReload || sessionChanged) {
                refreshRemotePermissionsAsync(true);
            } else if (!window.__occStockPermissionsBootstrapped) {
                window.__occStockPermissionsBootstrapped = true;
                refreshRemotePermissionsAsync(false);
            }
        } catch (err) {
            console.warn('Erro isolado ao atualizar permissoes do estoque:', err);
        }
        try {
            ensurePermissionHooks();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookSidebarSync();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookSetActiveTab();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookSidebarRenderFunctions();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookLoadEstoqueData();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookLoadMasterTablesData();
        } catch (err) {
            console.warn('Erro isolado no patch de Tabelas Padrão:', err);
        }
        try {
            hookRenderInventoryLogsTable();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            hookCrudPermissionGuards();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            installCrudPermissionEventGuards();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            ensureStockMenuDataAttributes();
        } catch (err) {
            console.warn('Erro isolado no patch de estoque:', err);
        }
        try {
            bindMasterTablesTemplateTabHandlers();
        } catch (err) {
            console.warn('Erro isolado ao vincular abas das Tabelas Padrão:', err);
        }
        try {
            installSidebarSingleActiveHandler();
        } catch (err) {
            console.warn('Erro isolado ao normalizar active da sidebar:', err);
        }
        try {
            bindStockSubmenuHandlers();
        } catch (err) {
            console.warn('Erro isolado ao vincular submenus do estoque:', err);
        }
        try {
            installAuthStateSyncListener();
        } catch (err) {
            console.warn('Erro isolado ao instalar sincronizacao de autenticacao do estoque:', err);
        }
        schedulePatchRun(String(sessionStorage.getItem('lastTab') || ''));
        ensureMainAppContainersVisible();
    }

    function bootstrapStockPatchOnce() {
        stopReactivePatchLoops();
        runPatchSafely('bootstrap init', function () {
            initializeStockPatch(false);
        });
    }

    runPatchSafely('bootstrap', function () {
        ensureMainAppContainersVisible();
        ensureSupabaseClientIsNative();
        stopReactivePatchLoops();
        try {
            initializeStockPatch(false);
        } catch (err) {
            console.warn('Erro isolado ao iniciar patch imediato do estoque:', err);
        }
        try {
            syncSessionIdentity(false);
        } catch (err) {
            console.warn('Erro isolado ao preparar identidade inicial do estoque:', err);
        }
        try {
            installAuthStateSyncListener();
        } catch (err) {
            console.warn('Erro isolado ao registrar listener inicial de autenticacao do estoque:', err);
        }
        try {
            bindStockSubmenuHandlers();
        } catch (err) {
            console.warn('Erro isolado ao registrar vinculo inicial dos submenus do estoque:', err);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function onReady() {
                document.removeEventListener('DOMContentLoaded', onReady);
                bootstrapStockPatchOnce();
            });
            window.addEventListener('load', function onLoad() {
                window.removeEventListener('load', onLoad);
                bootstrapStockPatchOnce();
            });
            return;
        }
        setTimeout(function () {
            bootstrapStockPatchOnce();
        }, 0);
    });
})();
