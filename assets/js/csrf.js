/**
 * TISANATURE — assets/js/csrf.js
 * Inclure dans toutes les pages HTML avant les autres scripts :
 *   <script src="assets/js/csrf.js"></script>
 *
 * Remplace automatiquement fetch() pour ajouter le header CSRF
 * sur tous les POST → aucun autre fichier JS à modifier.
 */
(function () {
    var base = '';
    try {
        var cur = document.currentScript;
        if (cur && cur.src) {
            var u = new URL(cur.src);
            var p = u.pathname;
            var idx = p.indexOf('/assets/js/');
            if (idx !== -1) base = p.slice(0, idx);
        }
    } catch (e) {}
    if (!base) {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (!src || src.indexOf('/assets/js/') === -1) continue;
            try {
                var u2 = new URL(src);
                var p2 = u2.pathname;
                var j = p2.indexOf('/assets/js/');
                if (j !== -1) { base = p2.slice(0, j); break; }
            } catch (e2) {}
        }
    }
    window.__TN_SITE_BASE__ = base;
})();

(async function() {
    // Récupérer le token CSRF une seule fois au chargement
    let csrfToken = '';
    const CSRF_URL = (typeof window.__TN_SITE_BASE__ === 'string' ? window.__TN_SITE_BASE__ : '') + '/api/csrf.php';

    try {
        const res  = await fetch(CSRF_URL, { credentials: 'include' });
        const data = await res.json();
        csrfToken  = data.token || '';
    } catch (e) {
        console.warn('[CSRF] Impossible de récupérer le token:', e);
    }

    // Intercepter tous les fetch() POST pour injecter le header
    const _originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (options.method && options.method.toUpperCase() === 'POST') {
            options.headers = options.headers || {};
            // Gérer Headers object ou plain object
            if (options.headers instanceof Headers) {
                options.headers.set('X-CSRF-Token', csrfToken);
            } else {
                options.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return _originalFetch.call(this, url, options);
    };

    window.__csrfToken = csrfToken;
    console.debug('[CSRF] Token chargé ✓');
})();