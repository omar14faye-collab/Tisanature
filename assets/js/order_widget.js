/**
 * ═══════════════════════════════════════════════════════════════
 *  TISANATURE — order-widget.js
 *  Widget client : suivi de commandes + annulation sécurisée
 *
 *  Fonctionnalités :
 *  ✦ Le client voit ses commandes en cours
 *  ✦ Peut annuler avant la livraison (via token sécurisé)
 *  ✦ La commande disparaît une fois "Livrée"
 *  ✦ Données stockées en localStorage (phone + tokens)
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  const API = 'api/order.php'; // ← le fichier avec client_orders + cancel

  /* ── State ──────────────────────────────────────────────── */
  let myPhone  = localStorage.getItem('tn_order_phone') || '';
  let myTokens = JSON.parse(localStorage.getItem('tn_order_tokens') || '{}');
  // myTokens = { "TN-XXXXXXXX": "cancelToken...", ... }

  let isOpen   = false;
  let pollTimer = null;
  let myOrders  = [];

  /* ── Styles ─────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Bouton flottant commandes ── */
    #ow-btn {
      position:fixed;
      bottom:calc(100px + env(safe-area-inset-bottom, 0px));
      right:max(12px, env(safe-area-inset-right, 0px));
      z-index:7900;
      background:linear-gradient(135deg,#1E3627,#3A7D5C);
      border:1px solid rgba(77,184,122,0.35);
      border-radius:14px; padding:10px 16px;
      display:flex; align-items:center; gap:9px;
      cursor:pointer; box-shadow:0 6px 24px rgba(0,0,0,.4);
      color:#DDD9CE; font-family:'DM Sans',sans-serif; font-size:.79rem; font-weight:500;
      transition:transform .2s,box-shadow .2s;
    }
    #ow-btn:hover { transform:translateY(-2px); box-shadow:0 8px 30px rgba(58,125,92,.5); }
    #ow-btn svg   { width:16px; height:16px; fill:none; stroke:#6BB892; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0; }
    #ow-btn-label { color:#EDE8DC; }
    #ow-btn-badge {
      background:#C0392B; color:#fff; font-size:.6rem; font-weight:700;
      min-width:16px; height:16px; border-radius:8px; padding:0 4px;
      display:none; align-items:center; justify-content:center;
    }

    /* ── Panel commandes ── */
    #ow-panel {
      position:fixed;
      bottom:calc(160px + env(safe-area-inset-bottom, 0px));
      right:max(12px, env(safe-area-inset-right, 0px));
      z-index:7900;
      width:min(360px, calc(100vw - 16px));
      max-height:min(480px, calc(100dvh - 200px), calc(100vh - 200px));
      background:#112018; border:1px solid rgba(255,255,255,0.09);
      border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.6);
      display:flex; flex-direction:column; overflow:hidden;
      transform:scale(.92) translateY(16px); opacity:0; pointer-events:none;
      transition:transform .22s cubic-bezier(.22,1,.36,1), opacity .22s;
    }
    #ow-panel.open { transform:none; opacity:1; pointer-events:all; }
    @media(max-width:420px) {
      #ow-panel {
        left:max(8px, env(safe-area-inset-left, 0px));
        right:max(8px, env(safe-area-inset-right, 0px));
        width:auto;
        max-height:min(480px, calc(100dvh - 180px), calc(100vh - 180px));
      }
    }

    #ow-hdr {
      padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.07);
      background:linear-gradient(135deg,#1A3326,#243E2E);
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
    }
    #ow-hdr-title { font-family:'Playfair Display',serif; font-size:.92rem; color:#EDE8DC; }
    #ow-hdr-sub   { font-size:.65rem; color:rgba(255,255,255,.4); margin-top:1px; }
    #ow-close { background:none; border:none; color:rgba(255,255,255,.5); cursor:pointer; font-size:1rem; padding:4px 6px; transition:color .15s; }
    #ow-close:hover { color:#fff; }

    #ow-body { flex:1; overflow-y:auto; padding:14px 12px; display:flex; flex-direction:column; gap:10px; scrollbar-width:thin; scrollbar-color:#243E2E #0C1A14; }

    /* Formulaire téléphone */
    .ow-phone-form { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:16px; }
    .ow-phone-form p { font-size:.75rem; color:rgba(255,255,255,.55); margin-bottom:10px; line-height:1.55; }
    .ow-phone-input { width:100%; background:#182C20; border:1px solid rgba(255,255,255,.09); border-radius:7px; padding:8px 11px; color:#DDD9CE; font-size:.8rem; font-family:'DM Sans',sans-serif; outline:none; transition:border-color .15s; margin-bottom:8px; }
    .ow-phone-input:focus { border-color:#4DB87A; }
    .ow-phone-btn { width:100%; padding:9px; border:none; border-radius:7px; background:linear-gradient(135deg,#3A7D5C,#4F9B75); color:#fff; font-size:.78rem; font-weight:600; cursor:pointer; transition:opacity .15s; }
    .ow-phone-btn:hover { opacity:.9; }

    /* Carte commande */
    .ow-order-card {
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
      border-radius:10px; padding:12px 14px;
    }
    .ow-order-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .ow-order-ref { font-family:'DM Mono',monospace; font-size:.72rem; color:rgba(255,255,255,.5); }
    .ow-order-date { font-size:.65rem; color:rgba(255,255,255,.35); }
    .ow-order-items { font-size:.78rem; color:#C8D5CC; margin-bottom:8px; line-height:1.5; }
    .ow-order-bottom { display:flex; align-items:center; justify-content:space-between; }
    .ow-order-total { font-size:.9rem; font-weight:700; color:#4DB87A; }
    .ow-order-status { font-size:.66rem; font-weight:600; padding:3px 10px; border-radius:100px; text-transform:uppercase; letter-spacing:.05em; }
    .ow-status-new          { background:rgba(52,152,219,.15); color:#5DADE2; }
    .ow-status-confirmed    { background:rgba(39,174,96,.15);  color:#52D98A; }
    .ow-status-in_delivery  { background:rgba(230,126,34,.15); color:#E59866; }
    .ow-status-delivered    { background:rgba(42,102,68,.25);  color:#4DB87A; display:none; }
    .ow-status-cancelled    { background:rgba(192,57,43,.15);  color:#E8685E; }
    .ow-cancel-btn {
      background:none; border:1px solid rgba(192,57,43,.35); border-radius:5px;
      color:rgba(192,57,43,.8); font-size:.66rem; padding:3px 9px; cursor:pointer;
      transition:all .15s; margin-top:8px; display:block; width:100%; text-align:center;
    }
    .ow-cancel-btn:hover { background:rgba(192,57,43,.15); color:#E8685E; border-color:rgba(192,57,43,.6); }
    .ow-cancel-btn:disabled { opacity:.4; cursor:not-allowed; }

    /* Statut livré — carte grisée */
    .ow-order-card.delivered { opacity:.5; filter:grayscale(.6); }

    .ow-empty { text-align:center; padding:24px 16px; color:rgba(255,255,255,.3); font-size:.79rem; line-height:1.6; }
    .ow-empty svg { width:36px; height:36px; stroke:rgba(255,255,255,.1); margin-bottom:10px; }

    .ow-refresh-btn { background:none; border:1px solid rgba(255,255,255,.08); border-radius:7px; padding:7px 14px; color:rgba(255,255,255,.4); font-size:.71rem; cursor:pointer; width:100%; transition:all .15s; }
    .ow-refresh-btn:hover { border-color:rgba(77,184,122,.3); color:#6BB892; }

    /* Toast interne */
    .ow-toast { text-align:center; padding:8px 12px; border-radius:7px; font-size:.74rem; }
    .ow-toast.ok  { background:rgba(42,102,68,.3); color:#6BB892; }
    .ow-toast.err { background:rgba(192,57,43,.2); color:#E8685E; }
  `;
  document.head.appendChild(style);

  /* ── HTML ───────────────────────────────────────────────── */
  const root = document.createElement('div');
  root.innerHTML = `
    <button id="ow-btn" onclick="owToggle()" aria-label="Mes commandes">
      <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      <span id="ow-btn-label">Mes commandes</span>
      <span id="ow-btn-badge"></span>
    </button>

    <div id="ow-panel" role="dialog" aria-label="Suivi de commandes">
      <div id="ow-hdr">
        <div>
          <div id="ow-hdr-title">Mes commandes</div>
          <div id="ow-hdr-sub">Suivi en temps réel</div>
        </div>
        <button id="ow-close" onclick="owToggle()">✕</button>
      </div>
      <div id="ow-body">
        <div class="ow-empty">
          <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
          <div>Chargement…</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  /* ── Toggle ─────────────────────────────────────────────── */
  window.owToggle = function () {
    isOpen = !isOpen;
    document.getElementById('ow-panel').classList.toggle('open', isOpen);
    if (isOpen) owLoad();
    else owStopPoll();
  };

  /* ── Charge les commandes ───────────────────────────────── */
  async function owLoad() {
    if (!myPhone) { owShowPhoneForm(); return; }
    owShowLoading();
    try {
      const res  = await fetch(`${API}?action=client_orders&phone=${encodeURIComponent(myPhone)}`);
      const data = await res.json();
      if (!data.success) { owShowError(data.message); return; }
      myOrders = (data.orders || []).filter(o => o.status !== 'delivered'); // Masquer les livrées
      owRender();
      owStartPoll();
    } catch (e) {
      owShowError('Impossible de charger les commandes.');
    }
  }

  function owStartPoll() {
    owStopPoll();
    pollTimer = setInterval(owLoad, 15000); // Rafraîchir toutes les 15s
  }

  function owStopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ── Rendu des commandes ────────────────────────────────── */
  function owRender() {
    const body = document.getElementById('ow-body');
    if (!myOrders.length) {
      body.innerHTML = `
        <div class="ow-empty">
          <svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          <div>Aucune commande en cours</div>
          <div style="font-size:.67rem;margin-top:6px;color:rgba(255,255,255,.2)">Vos commandes livrées n'apparaissent plus ici</div>
        </div>
        <button class="ow-refresh-btn" onclick="owChangePhone()">🔄 Changer de numéro</button>`;
      return;
    }
    const statusLabels = { new:'⏳ En attente', confirmed:'✅ Confirmée', in_delivery:'🚚 En livraison', delivered:'📦 Livrée', cancelled:'❌ Annulée' };
    const canCancel    = ['new','confirmed'];

    body.innerHTML = myOrders.map(o => {
      const items = (() => { try { return JSON.parse(o.items||'[]'); } catch(e){ return []; } })();
      const itemsText = items.map(i => `${i.name} × ${i.qty}`).join(', ') || '—';
      const total  = Number(o.total||0).toLocaleString('fr-FR') + ' FCFA';
      const date   = new Date(o.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
      const hasToken  = !!myTokens[o.order_ref];
      const showCancel = canCancel.includes(o.status) && hasToken;
      return `
        <div class="ow-order-card ${o.status === 'delivered' ? 'delivered' : ''}" id="ocard-${o.id}">
          <div class="ow-order-top">
            <span class="ow-order-ref">${o.order_ref}</span>
            <span class="ow-order-date">${date}</span>
          </div>
          <div class="ow-order-items">${owEsc(itemsText)}</div>
          <div class="ow-order-bottom">
            <span class="ow-order-total">${total}</span>
            <span class="ow-order-status ow-status-${o.status}">${statusLabels[o.status]||o.status}</span>
          </div>
          ${showCancel ? `<button class="ow-cancel-btn" id="ocancel-${o.id}" onclick="owCancel('${o.order_ref}','${o.id}')">Annuler cette commande</button>` : ''}
          ${!hasToken && canCancel.includes(o.status) ? `<div style="font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px;text-align:center">Pour annuler, passez la commande depuis ce navigateur</div>` : ''}
        </div>`;
    }).join('') +
    `<button class="ow-refresh-btn" onclick="owChangePhone()">Changer de numéro</button>`;

    // Badge
    const inProgress = myOrders.filter(o => !['delivered','cancelled'].includes(o.status)).length;
    const badge = document.getElementById('ow-btn-badge');
    if (badge) { badge.textContent = inProgress; badge.style.display = inProgress > 0 ? 'flex' : 'none'; }
  }

  /* ── Annuler une commande ───────────────────────────────── */
  window.owCancel = async function(ref, orderId) {
    const token = myTokens[ref];
    if (!token) { owToast('Token manquant. Impossible d\'annuler.', 'err'); return; }
    if (!confirm(`Annuler la commande ${ref} ? Cette action est irréversible.`)) return;
    const btn = document.getElementById(`ocancel-${orderId}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Annulation…'; }
    try {
      const res  = await fetch(`${API}?action=cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ref: ref, cancel_token: token }),
      });
      const data = await res.json();
      if (data.success) {
        owToast('Commande annulée avec succès.', 'ok');
        // Supprimer le token (inutile après annulation)
        delete myTokens[ref];
        localStorage.setItem('tn_order_tokens', JSON.stringify(myTokens));
        await owLoad();
      } else {
        owToast(data.message || 'Erreur lors de l\'annulation.', 'err');
        if (btn) { btn.disabled = false; btn.textContent = 'Annuler cette commande'; }
      }
    } catch(e) {
      owToast('Erreur réseau.', 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Annuler cette commande'; }
    }
  };

  /* ── Formulaire téléphone ───────────────────────────────── */
  function owShowPhoneForm() {
    document.getElementById('ow-body').innerHTML = `
      <div class="ow-phone-form">
        <p>Entrez votre numéro de téléphone pour retrouver vos commandes.</p>
        <input class="ow-phone-input" id="ow-phone-in" type="tel" placeholder="Ex: 77 567 1821" value="${owEsc(myPhone)}">
        <button class="ow-phone-btn" onclick="owSetPhone()">Rechercher mes commandes →</button>
      </div>`;
    setTimeout(() => { const el = document.getElementById('ow-phone-in'); if (el) el.focus(); }, 200);
  }

  window.owSetPhone = function () {
    const input = document.getElementById('ow-phone-in');
    const val   = input?.value.trim();
    if (!val || val.length < 8) { input?.classList.add('err'); return; }
    myPhone = val;
    localStorage.setItem('tn_order_phone', myPhone);
    owLoad();
  };

  window.owChangePhone = function() {
    myPhone = '';
    localStorage.removeItem('tn_order_phone');
    owShowPhoneForm();
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  function owEsc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function owShowLoading() {
    document.getElementById('ow-body').innerHTML = `<div class="ow-empty">Chargement…</div>`;
  }
  function owShowError(msg) {
    document.getElementById('ow-body').innerHTML = `<div class="ow-empty">${owEsc(msg)}</div><button class="ow-refresh-btn" onclick="owLoad()">Réessayer</button>`;
  }
  function owToast(msg, type) {
    const el = document.createElement('div');
    el.className = `ow-toast ${type}`;
    el.textContent = msg;
    const body = document.getElementById('ow-body');
    if (body) { body.prepend(el); setTimeout(() => el.remove(), 4000); }
  }

  /* ═══════════════════════════════════════════════════════════
     INTÉGRATION : Après commande réussie, stocker le token
     ───────────────────────────────────────────────────────────
     À appeler depuis script.js après confirmOrder() :
     window.owRegisterOrder(order_ref, cancel_token, phone)
  ══════════════════════════════════════════════════════════ */
  window.owRegisterOrder = function(ref, token, phone) {
    if (!ref || !token) return;
    if (phone) {
      myPhone = phone;
      localStorage.setItem('tn_order_phone', phone);
    }
    myTokens[ref] = token;
    localStorage.setItem('tn_order_tokens', JSON.stringify(myTokens));
    // Badge
    const badge = document.getElementById('ow-btn-badge');
    if (badge) { badge.textContent = '1'; badge.style.display = 'flex'; }
  };

})();