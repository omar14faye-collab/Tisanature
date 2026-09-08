'use strict';

const ACCOUNT_API_BASE = 'api';
const qs  = id => document.getElementById(id);
const fmtAccount = n  => Number(n).toLocaleString('fr-FR') + '\u00a0FCFA';

/* Cache des commandes pour la génération de facture */
let ordersCache = [];

/* ── Toast ── */
function showToast(msg, type) {
  type = type || 'info';
  const el = qs('toast');
  if (!el) return;
  el.innerHTML = msg;
  el.className = 'toast on' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 3500);
}

/* ── Navigation sections ── */
function showSection(name) {
  document.querySelectorAll('.account-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.account-nav-item').forEach(a => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
  const section = qs('section-' + name);
  if (section) section.classList.add('active');
  const navItem = document.querySelector('.account-nav-item[href="#' + name + '"]');
  if (navItem) { navItem.classList.add('active'); navItem.setAttribute('aria-current', 'page'); }
  
  if (window.innerWidth <= 860) {
    const mainContent = qs('main-content');
    if (mainContent) {
      const y = mainContent.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ── Annulation commande ── */
async function cancelOrder(ref, token) {
  if (!confirm('Annuler la commande ' + ref + ' ?\nCette action est irréversible.')) return;

  document.querySelectorAll('.order-cancel-btn').forEach(b => { b.disabled = true; b.textContent = '…'; });

  try {
    const res = await fetch(ACCOUNT_API_BASE + '/order.php?action=cancel', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ref: ref, cancel_token: token }),
    });

    let data;
    const text = await res.text();
    try   { data = JSON.parse(text); }
    catch { console.error('[cancelOrder] Réponse non-JSON :', text); showToast('Erreur serveur inattendue.', 'error'); return; }

    if (data.success) {
      showToast('Commande ' + ref + ' annulée avec succès.', 'success');
      loadAccountData();
    } else {
      showToast(data.message || 'Impossible d\'annuler cette commande.', 'error');
      document.querySelectorAll('.order-cancel-btn').forEach(b => { b.disabled = false; b.textContent = 'Annuler'; });
    }
  } catch (e) {
    console.error('[cancelOrder] Erreur réseau :', e);
    showToast('Erreur réseau — vérifiez votre connexion.', 'error');
    document.querySelectorAll('.order-cancel-btn').forEach(b => { b.disabled = false; b.textContent = 'Annuler'; });
  }
}

/* ── Chargement des données ── */
async function loadAccountData() {
  try {
    const res = await fetch(ACCOUNT_API_BASE + '/account.php', { credentials: 'same-origin' });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) { showToast('Erreur serveur (' + res.status + '). Réessayez.', 'error'); return; }
    const data = await res.json();
    if (!data.success) { window.location.href = 'login.html'; return; }
    renderUser(data.user);
    renderOrders(data.orders || []);
    renderTracking(data.orders || []);
    applyPreferences(data.preferences || {});
  } catch (err) {
    console.error('[TISANATURE] Erreur réseau :', err.message);
    showToast('Impossible de joindre le serveur. Vérifiez votre connexion.', 'error');
    const sk = qs('orders-skeleton');
    if (sk) sk.style.display = 'none';
    const container = qs('orders-container');
    if (container) container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-state-ring"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
        '<div class="empty-state-title">Serveur inaccessible</div>' +
        '<div class="empty-state-sub">Vérifiez que XAMPP est démarré et que les fichiers PHP sont bien en place.</div>' +
        '<button onclick="loadAccountData()" class="checkout-btn" style="max-width:200px">Réessayer</button>' +
      '</div>';
  }
}

/* ── Rendu utilisateur ── */
function renderUser(user) {
  const initial   = (user.name || '?')[0].toUpperCase();
  const firstName = (user.name || '').split(' ')[0] || '—';
  const hn = qs('header-name');       if (hn) hn.textContent = firstName;
  const av = qs('sidebar-avatar');    if (av) av.textContent = initial;
  const sn = qs('sidebar-name');      if (sn) sn.textContent = user.name  || '—';
  const se = qs('sidebar-email');     if (se) se.textContent = user.email || '—';
  const pb = qs('prof-avatar-big');   if (pb) pb.textContent = initial;
  const pn = qs('prof-avatar-name');  if (pn) pn.textContent = user.name  || '—';
  const pe = qs('prof-avatar-email'); if (pe) pe.textContent = user.email || '—';
  if (qs('prof-name'))    qs('prof-name').value    = user.name    || '';
  if (qs('prof-email'))   qs('prof-email').value   = user.email   || '';
  if (qs('prof-phone'))   qs('prof-phone').value   = user.phone   || '';
  if (qs('prof-address')) qs('prof-address').value = user.address || '';
  if (qs('prof-city'))    qs('prof-city').value    = user.city    || 'Dakar';
  if (qs('prof-zone'))    qs('prof-zone').value    = user.zone    || '';
}

/* ── Rendu commandes ── */
function renderOrders(orders) {
  const container = qs('orders-container');
  if (!container) return;

  /* Mettre en cache pour la génération de facture */
  ordersCache = orders;

  const total = orders.length;
  const spent = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const last  = orders.length > 0 ? orders[0].date : '—';

  const ho = qs('hstat-orders'); if (ho) ho.textContent = total;
  const hs = qs('hstat-spent');  if (hs) hs.textContent = total > 0 ? fmtAccount(spent) : '—';
  const statO = qs('stat-total-orders'); if (statO) statO.textContent = total;
  const statS = qs('stat-total-spent');  if (statS) statS.textContent = total > 0 ? fmtAccount(spent) : '—';
  const statL = qs('stat-last-order');   if (statL) statL.textContent = last;

  if (!orders.length) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-state-ring"><svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>' +
        '<div class="empty-state-title">Aucune commande pour l\'instant</div>' +
        '<div class="empty-state-sub">Découvrez nos produits naturels et passez votre première commande.</div>' +
        '<a href="index.html#products-anchor" class="checkout-btn" style="text-decoration:none;display:block;max-width:220px">Voir la boutique</a>' +
      '</div>';
    return;
  }

  const STATUS_MAP = {
    new:         { label: 'En attente',   cls: 'status-new'         },
    confirmed:   { label: 'Confirmee',    cls: 'status-confirmed'   },
    in_delivery: { label: 'En livraison', cls: 'status-in-delivery' },
    delivered:   { label: 'Livree',       cls: 'status-delivered'   },
    cancelled:   { label: 'Annulee',      cls: 'status-cancelled'   },
  };

  const rows = orders.map(o => {
    const st = STATUS_MAP[o.status] || STATUS_MAP['new'];
    const waLink = 'https://wa.me/221775671821?text=' + encodeURIComponent('Bonjour, je voudrais des informations sur ma commande ' + o.ref);
    const canCancel = o.cancellable && (o.status === 'new' || o.status === 'confirmed');
    const cancelBtn = canCancel
      ? '<button class="order-cancel-btn" onclick="cancelOrder(\'' + o.ref + '\',\'' + o.cancel_token + '\')">Annuler</button>'
      : '';
    const invoiceBtn = o.status === 'delivered'
      ? '<button class="order-action-btn" data-invoice="' + o.ref + '" onclick="downloadInvoice(\'' + o.ref + '\')" style="color:var(--forest);border-color:rgba(42,102,68,0.3)">↓ Facture</button>'
      : '';
    return (
      '<div class="order-row">' +
        '<div>' +
          '<div class="order-ref">' + o.ref + '</div>' +
          '<div class="order-ref-sub">' + (o.items_label || '—') + '</div>' +
          '<div class="order-row-actions">' +
            '<a href="' + waLink + '" target="_blank" rel="noopener noreferrer" class="order-action-btn">Contacter</a>' +
            cancelBtn +
            invoiceBtn +
          '</div>' +
        '</div>' +
        '<div class="order-cell">' + o.date + '</div>' +
        '<div class="order-amount">' + fmtAccount(o.amount) + '</div>' +
        '<div><span class="order-status ' + st.cls + '"><span class="status-dot"></span>' + st.label + '</span></div>' +
      '</div>'
    );
  });

  container.innerHTML =
    '<div class="orders-table-head">' +
      '<span>Référence &amp; Produits</span><span>Date</span><span>Montant</span><span>Statut</span>' +
    '</div>' +
    rows.join('');
}

/* ── Rendu tracking ── */
function renderTracking(orders) {
  const STATUS_MAP = {
    new:         { label: 'En attente',   cls: 'status-new'         },
    confirmed:   { label: 'Confirmee',    cls: 'status-confirmed'   },
    in_delivery: { label: 'En livraison', cls: 'status-in-delivery' },
    delivered:   { label: 'Livree',       cls: 'status-delivered'   },
    cancelled:   { label: 'Annulee',      cls: 'status-cancelled'   },
  };

  const active    = orders.filter(o => o.status === 'new' || o.status === 'confirmed' || o.status === 'in_delivery');
  const container = qs('tracking-container');
  if (!container) return;

  if (!active.length) {
    const emptyEl = qs('tracking-empty');
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  const cards = active.map(o => {
    const steps = [
      { label: 'Commande recue', done: true },
      { label: 'Confirmee',      done: o.status === 'confirmed' || o.status === 'in_delivery' },
      { label: 'En livraison',   done: o.status === 'in_delivery' },
      { label: 'Livree',         done: o.status === 'delivered'  },
    ];
    const firstPending = steps.findIndex(s => !s.done);
    const stepsHtml = steps.map((step, i) => {
      const isDone    = step.done;
      const isPending = !isDone && i === firstPending;
      const inner = isDone
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : isPending
          ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--sage-pale);animation:tisaPulse 1.4s ease-in-out infinite"></div>'
          : '<div style="width:8px;height:8px;border-radius:50%;background:var(--line)"></div>';
      const connector = i < steps.length - 1
        ? '<div style="position:absolute;top:14px;left:50%;width:100%;height:2px;background:' + (isDone ? 'var(--sage)' : 'var(--ivory-3)') + '"></div>'
        : '';
      return (
        '<div style="flex:1;text-align:center;position:relative">' +
          '<div style="width:28px;height:28px;border-radius:50%;background:' + (isDone ? 'var(--sage)' : 'var(--ivory-3)') + ';border:2px solid ' + (isDone ? 'var(--sage)' : 'var(--line)') + ';display:flex;align-items:center;justify-content:center;margin:0 auto 0.6rem;position:relative;z-index:1;transition:all 0.3s">' + inner + '</div>' +
          connector +
          '<div style="font-size:0.62rem;color:' + (isDone ? 'var(--forest)' : 'var(--text-faint)') + ';font-weight:' + (isDone ? '600' : '300') + ';letter-spacing:0.04em;line-height:1.4">' + step.label + '</div>' +
        '</div>'
      );
    }).join('');

    const st = STATUS_MAP[o.status] || STATUS_MAP['new'];
    const canCancel = o.cancellable && (o.status === 'new' || o.status === 'confirmed');

    return (
      '<div style="background:var(--white);border:1px solid var(--line);border-radius:var(--r-lg);padding:2rem 2.25rem;margin-bottom:1.25rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2rem;flex-wrap:wrap;gap:1rem">' +
          '<div>' +
            '<div style="font-family:\'Playfair Display\',serif;font-size:1rem;color:var(--forest);margin-bottom:0.2rem">' + o.ref + '</div>' +
            '<div style="font-size:0.72rem;color:var(--text-faint)">' + (o.items_label || '—') + ' · ' + o.date + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">' +
            '<span class="order-status ' + st.cls + '" style="font-size:0.65rem"><span class="status-dot"></span>' + st.label + '</span>' +
            '<a href="https://wa.me/221775671821?text=' + encodeURIComponent('Bonjour, suivi de commande ' + o.ref) + '" target="_blank" rel="noopener noreferrer" class="order-action-btn">WhatsApp</a>' +
            (canCancel ? '<button class="order-cancel-btn" onclick="cancelOrder(\'' + o.ref + '\',\'' + o.cancel_token + '\')">Annuler</button>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0">' + stepsHtml + '</div>' +
      '</div>'
    );
  }).join('');

  container.innerHTML = cards;
}

/* ── Préférences ── */
function applyPreferences(prefs) {
  const map = {
    'pref-confirm':    prefs.confirm    !== undefined ? prefs.confirm    : true,
    'pref-tracking':   prefs.tracking   !== undefined ? prefs.tracking   : true,
    'pref-newsletter': prefs.newsletter !== undefined ? prefs.newsletter : false,
    'pref-tips':       prefs.tips       !== undefined ? prefs.tips       : false,
    'pref-analytics':  prefs.analytics  !== undefined ? prefs.analytics  : false,
  };
  Object.keys(map).forEach(id => { const el = qs(id); if (el) el.checked = map[id]; });
}

async function savePreferences() {
  const prefs = {
    confirm:    qs('pref-confirm')    ? qs('pref-confirm').checked    : true,
    tracking:   qs('pref-tracking')   ? qs('pref-tracking').checked   : true,
    newsletter: qs('pref-newsletter') ? qs('pref-newsletter').checked : false,
    tips:       qs('pref-tips')       ? qs('pref-tips').checked       : false,
    analytics:  qs('pref-analytics')  ? qs('pref-analytics').checked  : false,
  };
  try {
    await fetch(ACCOUNT_API_BASE + '/preference.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
      credentials: 'same-origin'
    });
  } catch (e) { /* silencieux */ }
  showToast('<strong>Préférences</strong> enregistrées.', 'success');
}

/* ── Formulaire profil ── */
const profileForm = qs('profile-form');
if (profileForm) {
  profileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.checkout-btn');
    const origText = btn ? btn.textContent : 'Enregistrer';
    if (btn) { btn.textContent = 'Enregistrement…'; btn.disabled = true; }
    try {
      const res = await fetch(ACCOUNT_API_BASE + '/update_profile.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name:         qs('prof-name')    ? qs('prof-name').value.trim()    : '',
          email:        qs('prof-email')   ? qs('prof-email').value.trim()   : '',
          phone:        qs('prof-phone')   ? qs('prof-phone').value.trim()   : '',
          address:      qs('prof-address') ? qs('prof-address').value.trim() : '',
          city:         qs('prof-city')    ? qs('prof-city').value.trim()    : '',
          zone:         qs('prof-zone')    ? qs('prof-zone').value.trim()    : '',
          old_password: qs('prof-pwd-old') ? qs('prof-pwd-old').value || null : null,
          new_password: qs('prof-pwd-new') ? qs('prof-pwd-new').value || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'Erreur lors de la mise à jour.', 'error');
        if (btn) { btn.textContent = origText; btn.disabled = false; }
        return;
      }
    } catch (err) {
      showToast('Erreur réseau. Réessayez.', 'error');
      if (btn) { btn.textContent = origText; btn.disabled = false; }
      return;
    }
    showToast('<strong>Profil</strong> mis à jour avec succès.', 'success');
    const newName = qs('prof-name') ? qs('prof-name').value.trim() : '';
    if (newName) {
      const initial = newName[0].toUpperCase();
      const fn = newName.split(' ')[0];
      const hn = qs('header-name');       if (hn) hn.textContent = fn;
      const sn = qs('sidebar-name');      if (sn) sn.textContent = newName;
      const av = qs('sidebar-avatar');    if (av) av.textContent = initial;
      const pb = qs('prof-avatar-big');   if (pb) pb.textContent = initial;
      const pn = qs('prof-avatar-name');  if (pn) pn.textContent = newName;
    }
    const newEmail = qs('prof-email') ? qs('prof-email').value.trim() : '';
    if (newEmail) {
      const se = qs('sidebar-email');     if (se) se.textContent = newEmail;
      const pe = qs('prof-avatar-email'); if (pe) pe.textContent = newEmail;
    }
    if (btn) { btn.textContent = origText; btn.disabled = false; }
    const pwdOld = qs('prof-pwd-old'); if (pwdOld) pwdOld.value = '';
    const pwdNew = qs('prof-pwd-new'); if (pwdNew) pwdNew.value = '';
  });
}

/* ── Toggle mot de passe ── */
function togglePwd(btn, inputId) {
  const input = qs(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ── Déconnexion ── */
function confirmLogout() {
  if (!confirm('Êtes-vous sûr de vouloir vous déconnecter\u00a0?')) return;
  fetch(ACCOUNT_API_BASE + '/logout.php', { method: 'POST', credentials: 'same-origin' })
    .catch(() => {})
    .finally(() => { window.location.href = 'login.html'; });
}

function cancelProfileEdit() { loadAccountData(); }

/* ── Init + polling 15s ── */
loadAccountData();

setInterval(async () => {
  try {
    const res = await fetch(ACCOUNT_API_BASE + '/account.php', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;
    renderOrders(data.orders || []);
    renderTracking(data.orders || []);
  } catch (e) { /* silencieux */ }
}, 15000);

/* ══════════════════════════════════════════════════════════════
   TÉLÉCHARGEMENT FACTURE (disponible uniquement après livraison)
══════════════════════════════════════════════════════════════ */
async function downloadInvoice(ref) {
  const order = ordersCache.find(o => o.ref === ref);
  if (!order) { showToast('Commande introuvable.', 'error'); return; }

  const btn = document.querySelector('[data-invoice="' + ref + '"]');
  if (btn) { btn.textContent = 'Génération…'; btn.disabled = true; }

  try {
    const blob = await generateInvoicePNG({
      orderRef:     order.ref,
      token:        order.cancel_token || '',
      customerName: order.customer_name || '—',
      phone:        order.customer_phone || '—',
      address:      order.customer_address || '—',
      note:         order.note || '',
      items:        order.items || [],
      subtotal:     order.subtotal || 0,
      delivery:     order.delivery_fee || 3000,
      total:        order.amount,
      date:         order.date,
    });

    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'Facture-' + ref + '.png',
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    showToast('Facture téléchargée !', 'success');
  } catch (e) {
    console.error('[downloadInvoice]', e);
    showToast('Erreur lors de la génération de la facture.', 'error');
  } finally {
    if (btn) { btn.textContent = '↓ Facture'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════════
   GÉNÉRATION FACTURE PNG (Canvas)
══════════════════════════════════════════════════════════════ */
/* Polyfill ctx.roundRect */
if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y,     x + w, y + h, r);
    this.arcTo(x + w, y + h, x,     y + h, r);
    this.arcTo(x,     y + h, x,     y,     r);
    this.arcTo(x,     y,     x + w, y,     r);
    this.closePath();
    return this;
  };
}

async function generateInvoicePNG(data) {
  const W=1080,PAD=60,CW=W-PAD*2,HEADER_H=180,REFBAR_H=90,CLIENT_H=150,SEP_H=20,TH_H=70,ROW_H=80,TOTALS_H=200,TOKEN_H=110,FOOTER_H=100;
  const H=HEADER_H+REFBAR_H+CLIENT_H+SEP_H+TH_H+ROW_H*(data.items?.length??0)+SEP_H+TOTALS_H+SEP_H+TOKEN_H+FOOTER_H;
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  const fmtI = n => Number(n).toLocaleString('fr-FR') + ' FCFA';
  function block(x,y,w,h,fill,r=0){ctx.beginPath();r>0?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);ctx.fillStyle=fill;ctx.fill();}
  function text(str,x,y,{size=28,color='#1C2E24',weight='400',align='left',maxWidth}={}){ctx.save();ctx.fillStyle=color;ctx.font=`${weight} ${size}px -apple-system,"Helvetica Neue",Arial,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';maxWidth?ctx.fillText(String(str),x,y,maxWidth):ctx.fillText(String(str),x,y);ctx.restore();}
  function hline(y,color='rgba(0,0,0,0.08)',t=2){ctx.beginPath();ctx.moveTo(PAD,y);ctx.lineTo(W-PAD,y);ctx.strokeStyle=color;ctx.lineWidth=t;ctx.stroke();}
  block(0,0,W,H,'#FAFAF8');
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-35*Math.PI/180);ctx.font='700 120px Arial';ctx.fillStyle='rgba(46,100,70,0.03)';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let fy=-H*1.5;fy<H*1.5;fy+=220)ctx.fillText('TISANATURE',0,fy);ctx.restore();
  const hg=ctx.createLinearGradient(0,0,W,HEADER_H);hg.addColorStop(0,'#152E1E');hg.addColorStop(1,'#2A6644');
  block(0,0,W,HEADER_H,hg);block(0,HEADER_H-5,W,5,'#3A9E6A');
  const lx=PAD+36,ly=HEADER_H/2;ctx.beginPath();ctx.arc(lx,ly,36,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fill();
  text('T',lx,ly+2,{size:42,color:'#FFFFFF',weight:'700',align:'center'});
  text('TISANATURE',PAD+90,HEADER_H/2-16,{size:46,color:'#FFFFFF',weight:'700'});
  text('Bien-être Naturel · Dakar, Sénégal',PAD+90,HEADER_H/2+22,{size:22,color:'rgba(255,255,255,0.62)'});
  block(W-PAD-160,36,160,50,'rgba(255,255,255,0.14)',10);text('FACTURE',W-PAD-80,62,{size:24,color:'#FFFFFF',weight:'700',align:'center'});
  let y=HEADER_H;block(0,y,W,REFBAR_H,'#1E4A2E');
  text(data.orderRef,PAD,y+REFBAR_H/2,{size:36,color:'#FFFFFF',weight:'700'});
  text(data.date,W/2,y+REFBAR_H/2,{size:26,color:'rgba(255,255,255,0.7)',align:'center'});
  block(W-PAD-190,y+18,190,54,'rgba(57,210,120,0.18)',10);
  ctx.beginPath();ctx.arc(W-PAD-170,y+REFBAR_H/2,8,0,Math.PI*2);ctx.fillStyle='#3DD68C';ctx.fill();
  text('LIVRÉE',W-PAD-155,y+REFBAR_H/2,{size:24,color:'#3DD68C',weight:'700'});
  y+=REFBAR_H;block(0,y,W,CLIENT_H,'#FFFFFF');hline(y,'rgba(0,0,0,0.05)',1);hline(y+CLIENT_H,'rgba(0,0,0,0.06)',1);block(0,y,6,CLIENT_H,'#2A6644',12);
  text('CLIENT',PAD+20,y+36,{size:20,color:'#7A9080',weight:'700'});
  const ns=data.customerName.length>28?data.customerName.slice(0,26)+'…':data.customerName;
  text(ns,PAD+20,y+72,{size:34,color:'#1C2E24',weight:'600'});text(data.phone,PAD+20,y+106,{size:26,color:'#4A6E58'});
  const as=data.address.length>32?data.address.slice(0,30)+'…':data.address;
  text(as,W-PAD-20,y+72,{size:26,color:'#4A6E58',align:'right',maxWidth:CW/2});
  if(data.note){const nt=data.note.length>32?data.note.slice(0,30)+'…':data.note;text('Note : '+nt,W-PAD-20,y+106,{size:22,color:'#8A9E90',align:'right',maxWidth:CW/2});}
  y+=CLIENT_H+SEP_H;block(PAD,y,CW,TH_H,'#1C2E24',10);
  const C1=PAD+24,C2=PAD+CW*0.56,C3=PAD+CW*0.72,C4=PAD+CW-20;
  text('PRODUIT',C1,y+TH_H/2,{size:22,color:'#A8C4B0',weight:'700'});text('QTÉ',C2+20,y+TH_H/2,{size:22,color:'#A8C4B0',weight:'700',align:'center'});
  text('PRIX UNIT.',C3,y+TH_H/2,{size:22,color:'#A8C4B0',weight:'700',align:'right'});text('TOTAL',C4,y+TH_H/2,{size:22,color:'#A8C4B0',weight:'700',align:'right'});
  y+=TH_H;
  (data.items??[]).forEach((item,idx)=>{
    block(PAD,y,CW,ROW_H,idx%2===0?'#FFFFFF':'#F5F7F5');hline(y,'rgba(0,0,0,0.05)',1);
    block(C1,y+ROW_H/2-16,32,32,'rgba(42,102,68,0.1)',8);text(String(idx+1),C1+16,y+ROW_H/2,{size:20,color:'#2A6644',weight:'700',align:'center'});
    const pn=item.name.length>24?item.name.slice(0,22)+'…':item.name;
    text(pn,C1+48,y+ROW_H/2,{size:28,color:'#1C2E24',weight:'500'});
    block(C2,y+ROW_H/2-20,52,40,'rgba(42,102,68,0.12)',8);text(String(item.qty),C2+26,y+ROW_H/2,{size:26,color:'#2A6644',weight:'700',align:'center'});
    text(fmtI(item.price),C3,y+ROW_H/2,{size:24,color:'#5A7868',align:'right'});
    text(fmtI(item.price*item.qty),C4,y+ROW_H/2,{size:28,color:'#1C2E24',weight:'700',align:'right'});y+=ROW_H;
  });
  hline(y,'rgba(0,0,0,0.12)',2);y+=SEP_H;
  const TX=PAD+CW*0.45;
  text('Sous-total',TX+20,y+34,{size:26,color:'#5A7868'});text(fmtI(data.subtotal),PAD+CW-20,y+34,{size:28,color:'#2A3A2E',weight:'600',align:'right'});
  hline(y+55,'rgba(0,0,0,0.05)',1);text('Frais de livraison',TX+20,y+90,{size:26,color:'#5A7868'});text(fmtI(data.delivery),PAD+CW-20,y+90,{size:28,color:'#2A3A2E',weight:'600',align:'right'});
  y+=115;const tg=ctx.createLinearGradient(TX,y,TX+CW*0.55,y);tg.addColorStop(0,'#1B3D2A');tg.addColorStop(1,'#2A6644');
  block(TX,y,CW*0.55,72,tg,12);text('TOTAL PAYÉ',TX+24,y+36,{size:24,color:'rgba(255,255,255,0.7)',weight:'700'});
  text(fmtI(data.total),PAD+CW-24,y+36,{size:36,color:'#FFFFFF',weight:'700',align:'right'});
  y+=72+SEP_H+20;block(PAD,y,CW,TOKEN_H,'#F0F5F2',12);block(PAD,y,6,TOKEN_H,'#2A6644',12);
  text('RÉFÉRENCE DE VÉRIFICATION',PAD+28,y+32,{size:20,color:'#2A6644',weight:'700'});
  const ta=(data.token??'').slice(0,32).toUpperCase(),tb=(data.token??'').slice(32,48).toUpperCase()+'…';
  text(ta,PAD+28,y+64,{size:22,color:'#1C2E24',weight:'600'});text(tb,PAD+28,y+90,{size:20,color:'#7A9080'});
  text('Anti-fraude',PAD+CW-20,y+56,{size:20,color:'#2A6644',weight:'600',align:'right'});
  y+=TOKEN_H+20;block(0,y,W,FOOTER_H,'#1C2E24');block(0,y,W,4,'#3A9E6A');
  text('TISANATURE · www.tisanature.sn · +221 77 567 18 21',W/2,y+38,{size:22,color:'#8AB49A',weight:'600',align:'center'});
  text('Merci pour votre confiance !',W/2,y+72,{size:20,color:'rgba(255,255,255,0.3)',align:'center'});
  return new Promise(resolve=>canvas.toBlob(blob=>resolve(blob),'image/png',0.96));
}