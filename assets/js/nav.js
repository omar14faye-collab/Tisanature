/* ══════════════════════════════════════════════════════════════
   TISANATURE — nav.js  (v3 — Auth-aware)
   Navigation partagée pour toutes les pages
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = 'api';

  /* ── Sticky nav shadow ── */
  window.addEventListener('scroll', function () {
    var nav = document.getElementById('nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  /* ── Mobile menu ── */
  window.toggleMenu = function () {
    var menu   = document.getElementById('nav-mobile');
    var burger = document.getElementById('burger-btn');
    if (!menu || !burger) return;
    var isOpen = menu.classList.toggle('open');
    burger.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  /* Fermer le menu en cliquant en dehors */
  document.addEventListener('click', function (e) {
    var menu   = document.getElementById('nav-mobile');
    var burger = document.getElementById('burger-btn');
    var nav    = document.getElementById('nav');
    if (!menu || !menu.classList.contains('open')) return;
    if (nav && nav.contains(e.target)) return;
    menu.classList.remove('open');
    if (burger) { burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
    document.body.style.overflow = '';
  });

  /* Fix scroll lock upon resize */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) {
      var menu   = document.getElementById('nav-mobile');
      var burger = document.getElementById('burger-btn');
      if (menu && menu.classList.contains('open')) {
        menu.classList.remove('open');
        if (burger) { burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
      }
      // Toujours s'assurer que le body n'est pas bloqué sur desktop
      if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
      }
    }
  }, { passive: true });

  /* ── Smooth scroll ── */
  window.goTo = function (id) {
    var el = document.getElementById(id);
    if (!el) {
      window.location.href = 'index.html#' + id;
      return;
    }
    // Temporarily enable smooth scroll for intentional navigation only
    document.documentElement.style.scrollBehavior = 'smooth';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { document.documentElement.style.scrollBehavior = 'auto'; }, 800);
  };

  /* ── Password visibility toggle ── */
  window.togglePwd = function (btnEl, inputId) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btnEl.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    var svg = btnEl.querySelector('svg');
    if (svg) {
      svg.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  };

  /* ── Password strength ── */
  window.checkStrength = function (val) {
    var bar  = document.getElementById('ps-fill');
    var text = document.getElementById('ps-text');
    if (!bar || !text) return;
    if (!val) {
      bar.style.width = '0%'; bar.style.background = 'transparent';
      text.textContent = ''; text.style.color = 'transparent'; return;
    }
    var score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;
    var levels = [
      { label: 'Très faible', pct: '15%',  color: '#e74c3c' },
      { label: 'Faible',      pct: '25%',  color: '#e74c3c' },
      { label: 'Moyen',       pct: '50%',  color: '#f39c12' },
      { label: 'Fort',        pct: '75%',  color: '#27ae60' },
      { label: 'Excellent',   pct: '100%', color: '#1a8c4e' },
    ];
    var lvl = levels[score] || levels[0];
    bar.style.width = lvl.pct; bar.style.background = lvl.color;
    text.textContent = lvl.label; text.style.color = lvl.color;
  };

  /* ── Form validation helper ── */
  window.validateForm = function (formId, rules) {
    var valid = true;
    Object.keys(rules).forEach(function (id) {
      var el  = document.getElementById(id);
      var msg = document.getElementById(id + '-error');
      if (!el) return;
      el.classList.remove('error');
      if (msg) { msg.textContent = ''; msg.style.display = 'none'; msg.classList.remove('on'); }
      var err = rules[id](el.value.trim());
      if (err) {
        valid = false; el.classList.add('error');
        if (msg) { msg.textContent = err; msg.style.display = 'block'; msg.classList.add('on'); }
      }
    });
    return valid;
  };

  /* ── Contact form submit ── */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var rules = {
        'contact-name':    function (v) { return v.length < 2  ? 'Veuillez entrer votre nom.' : null; },
        'contact-email':   function (v) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'E-mail invalide.' : null; },
        'contact-message': function (v) { return v.length < 10 ? 'Message trop court (min. 10 car.).' : null; },
      };
      if (!window.validateForm('contact-form', rules)) return;
      var btn = this.querySelector('.form-submit');
      if (btn) { btn.textContent = 'Envoi…'; btn.disabled = true; }
      setTimeout(function () {
        contactForm.style.display = 'none';
        var s = document.getElementById('form-success');
        if (s) s.style.display = 'block';
      }, 1000);
    });
  }

  /* ════════════════════════════════════════════════════════
     AUTH HELPERS
  ════════════════════════════════════════════════════════ */
  function redirectAfterLogin(data) {
    if (data.redirect) { window.location.href = data.redirect; return; }
    window.location.href = (data.role === 'admin') ? 'admin/dashboard.html' : 'account.html';
  }

  function showFormError(formEl, msg) {
    var box = formEl.querySelector('.form-global-error');
    if (!box) {
      box = document.createElement('p');
      box.className = 'form-global-error';
      box.style.cssText = 'font-size:.78rem;color:#c0392b;margin-bottom:1rem;padding:.65rem 1rem;background:rgba(192,57,43,.07);border:1px solid rgba(192,57,43,.2);border-radius:4px;font-weight:400;line-height:1.5';
      formEl.insertBefore(box, formEl.firstChild);
    }
    box.textContent = msg; box.style.display = 'block';
  }

  function hideFormError(formEl) {
    var box = formEl.querySelector('.form-global-error');
    if (box) box.style.display = 'none';
  }

  function setBtn(btn, text, disabled) {
    if (!btn) return; btn.textContent = text; btn.disabled = disabled;
  }

  function networkErrorMsg(err) {
    if (!navigator.onLine) return 'Pas de connexion internet.';
    if (err && err.message) return err.message;
    return 'Une erreur est survenue. Veuillez réessayer.';
  }

  /* ════════════════════════════════════════════════════════
     CHECK AUTH — met à jour le bouton nav dynamiquement
     Appelé sur toutes les pages sauf account.html
  ════════════════════════════════════════════════════════ */
  window.checkAuth = function () {
    fetch(API_BASE + '/account.php', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success) return; /* Non connecté — UI par défaut */
        var user      = data.user || {};
        var firstName = (user.name || '').split(' ')[0] || 'Mon espace';

        /* ── Bouton desktop ── */
        var authBtn = document.getElementById('nav-auth-btn');
        if (authBtn) {
          authBtn.href        = 'account.html';
          authBtn.textContent = firstName + ' →';
          authBtn.title       = 'Accéder à mon espace';
          authBtn.style.background    = 'transparent';
          authBtn.style.color         = 'var(--forest)';
          authBtn.style.border        = '1px solid rgba(46,107,79,0.25)';
          authBtn.style.boxShadow     = 'none';
        }

        /* ── Mobile menu : remplacer "Connexion / Créer un compte" ── */
        var mobileAuth = document.getElementById('mobile-auth-links');
        if (mobileAuth) {
          mobileAuth.innerHTML =
            '<li><a href="account.html" style="color:var(--forest);font-weight:600">✦ ' + (user.name || 'Mon espace') + '</a></li>' +
            '<li><a href="#" onclick="navLogout();return false;" style="color:#c0392b">Déconnexion</a></li>';
        }
      })
      .catch(function () { /* silencieux */ });
  };

  /* Déconnexion depuis le menu mobile */
  window.navLogout = function () {
    if (!confirm('Vous déconnecter ?')) return;
    fetch(API_BASE + '/logout.php', { method: 'POST', credentials: 'same-origin' })
      .catch(function(){})
      .finally(function () { window.location.href = 'login.html'; });
  };

  /* ════════════════════════════════════════════════════════
     LOGIN
  ════════════════════════════════════════════════════════ */
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideFormError(this);
      var rules = {
        'login-email': function (v) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Adresse e-mail invalide.' : null; },
        'login-pwd':   function (v) { return v.length < 6 ? 'Veuillez saisir votre mot de passe.' : null; },
      };
      if (!window.validateForm('login-form', rules)) return;
      var emailEl    = document.getElementById('login-email');
      var pwdEl      = document.getElementById('login-pwd');
      var rememberEl = document.getElementById('login-remember');
      var btn        = this.querySelector('.form-submit');
      var origText   = btn ? btn.textContent : 'Se connecter';
      if (!emailEl || !pwdEl) return;
      setBtn(btn, 'Connexion en cours…', true);
      try {
        var res = await fetch(API_BASE + '/login.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailEl.value.trim(), password: pwdEl.value,
            remember: rememberEl ? rememberEl.checked : false,
          }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.success) throw new Error(data.message || 'Identifiants incorrects.');
        redirectAfterLogin(data);
      } catch (err) {
        showFormError(this, networkErrorMsg(err));
        setBtn(btn, origText, false);
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     INSCRIPTION
  ════════════════════════════════════════════════════════ */
  var signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideFormError(this);
      var pwdEl = document.getElementById('signup-pwd');
      var rules = {
        'signup-name':  function (v) { return v.length < 2 ? 'Veuillez entrer votre nom.' : null; },
        'signup-email': function (v) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'E-mail invalide.' : null; },
        'signup-phone': function (v) { return v.replace(/\D/g, '').length < 8 ? 'Téléphone invalide.' : null; },
        'signup-pwd':   function (v) { return v.length < 8 ? 'Minimum 8 caractères.' : null; },
        'signup-pwd2':  function (v) { return v !== (pwdEl ? pwdEl.value : '') ? 'Les mots de passe ne correspondent pas.' : null; },
      };
      var fieldsValid = window.validateForm('signup-form', rules);
      var terms    = document.getElementById('signup-terms');
      var termsMsg = document.getElementById('terms-error');
      var termsValid = terms ? terms.checked : true;
      if (!termsValid && termsMsg) {
        termsMsg.textContent = 'Vous devez accepter les conditions générales.';
        termsMsg.style.display = 'block'; termsMsg.classList.add('on');
      } else if (termsMsg) {
        termsMsg.textContent = ''; termsMsg.style.display = 'none'; termsMsg.classList.remove('on');
      }
      if (!fieldsValid || !termsValid) return;
      var btn = this.querySelector('.form-submit');
      var origText = btn ? btn.textContent : 'Créer mon compte';
      setBtn(btn, 'Création du compte…', true);
      try {
        var nameEl    = document.getElementById('signup-name');
        var emailEl   = document.getElementById('signup-email');
        var phoneEl   = document.getElementById('signup-phone');
        var addressEl = document.getElementById('signup-address');
        var nlEl      = document.getElementById('signup-newsletter');
        var res = await fetch(API_BASE + '/register.php', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:       nameEl    ? nameEl.value.trim()    : '',
            email:      emailEl   ? emailEl.value.trim()   : '',
            phone:      phoneEl   ? phoneEl.value.trim()   : '',
            password:   pwdEl     ? pwdEl.value            : '',
            address:    addressEl ? addressEl.value.trim() : '',
            newsletter: nlEl      ? nlEl.checked           : false,
          }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.success) throw new Error(data.message || 'Erreur. Veuillez réessayer.');
        redirectAfterLogin(data);
      } catch (err) {
        showFormError(this, networkErrorMsg(err));
        setBtn(btn, origText, false);
      }
    });
  }

  /* ── Reveal on scroll ── */
  var ro = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); ro.unobserve(entry.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-left').forEach(function (el) { ro.observe(el); });

})();