'use strict';

/* ═══════════════════════════════════════════════════════════
   TISANATURE — admin.js
   Compatible : localhost/projet3/
═══════════════════════════════════════════════════════════ */

/* ── UTILS ───────────────────────────────────────────────── */
const $      = id => document.getElementById(id);
const esc    = s  => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmt    = n  => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
const fmtNum = n  => Number(n || 0).toLocaleString('fr-FR');

function toSlug(str) {
  const a = {à:'a',â:'a',ä:'a',é:'e',è:'e',ê:'e',ë:'e',î:'i',ï:'i',ô:'o',ö:'o',ù:'u',û:'u',ü:'u',ç:'c'};
  return str.toLowerCase()
    .replace(/[àâäéèêëîïôöùûüç]/g, m => a[m] || m)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '');
}

const PAGE_META = {
  dashboard: { title: 'Tableau de bord', sub: "Vue d'ensemble" },
  orders:    { title: 'Commandes',       sub: 'Gestion des commandes' },
  products:  { title: 'Produits',        sub: 'Catalogue & stock' },
  clients:   { title: 'Clients',         sub: 'Base de données clients' },
  messages:  { title: 'Messagerie',      sub: 'Conversations clients' },
  settings:  { title: 'Paramètres',      sub: 'Configuration du site' },
};

/* ── STATE ───────────────────────────────────────────────── */
let currentPage     = 'dashboard';
let ordersData      = [];
let allProducts     = [];
let allClients      = [];
let ordersFilter    = 'all';
let productsFilter  = 'all';
let ordersSearch    = '';
let productsSearch  = '';
let lastOrderId     = 0;
let ordersPollTimer = null;
let unreadPollTimer = null;
let msgPollTimer    = null;
let currentConvId   = null;
let isUpdatingStatus = false;  // bloque le re-render pendant un update
let chartMode       = '7d';

/* ── CHEMINS API ─────────────────────────────────────────── */
const SITE_BASE = typeof window.__TN_SITE_BASE__ === 'string' ? window.__TN_SITE_BASE__ : '';
const API     = SITE_BASE + '/api';
const MSG_API = SITE_BASE + '/api/messages.php';

/* ── CLOCK ───────────────────────────────────────────────── */
function updateClock() {
  const el = $('topbar-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ── API FETCH ───────────────────────────────────────────── */
async function apiFetch(url, options = {}) {
  try {
    const isFormData = options.body instanceof FormData;
    const headers    = isFormData ? {} : { 'Content-Type': 'application/json' };
    const res = await fetch(url, {
      credentials: 'include',
      headers: { ...headers, ...(options.headers || {}) },
      ...options,
    });
    if (res.status === 401) { showLogin(); return { success: false, message: 'Non authentifié' }; }
    const text = await res.text();
    try   { return JSON.parse(text); }
    catch { console.error('[parse]', url, text.slice(0, 200)); return { success: false, message: 'Réponse invalide' }; }
  } catch (err) {
    console.error('[apiFetch]', err);
    return { success: false, message: 'Erreur réseau : ' + err.message };
  }
}

/* ── TOAST ───────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el    = $('admin-toast');
  const msgEl = $('admin-toast-msg');
  const icon  = el?.querySelector('.toast-icon');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  if (icon) icon.textContent = icons[type] || 'ℹ';
  el.className = `admin-toast on ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'admin-toast', 3500);
}

/* ── AUTH ────────────────────────────────────────────────── */
function showLogin() {
  stopAllPolling();
  $('app').style.display          = 'none';
  $('login-screen').style.display = 'flex';
}

function showApp() {
  $('app').style.display          = 'flex';
  $('login-screen').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = $('login-user')?.value.trim();
  const password = $('login-pass')?.value;
  const errEl    = $('login-error');
  const btn      = $('login-btn');
  if (errEl) errEl.style.display = 'none';
  if (btn)   { btn.textContent = 'Connexion…'; btn.disabled = true; }

  const data = await apiFetch(`${API}/auth.php?action=login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.success) {
    showApp();
    updateAdminUI(data.name, data.role);
    goPage('dashboard', document.querySelector('[data-page="dashboard"]'));
    toast(`Bienvenue ${data.name || ''} !`, 'success');
    startAllPolling();
  } else {
    if (errEl) { errEl.textContent = data.message || 'Identifiants incorrects'; errEl.style.display = 'block'; }
  }
  if (btn) { btn.textContent = 'Se connecter'; btn.disabled = false; }
}

async function logout() {
  await apiFetch(`${API}/auth.php?action=logout`, { method: 'POST' });
  showLogin();
}

async function checkSession() {
  const data = await apiFetch(`${API}/auth.php?action=check`);
  if (data.authenticated) {
    updateAdminUI(data.name, data.role);
    showApp();
    startAllPolling();
    goPage('dashboard', document.querySelector('[data-page="dashboard"]'));
  } else {
    showLogin();
  }
}

/** Met à jour le nom et le rôle affichés dans la sidebar */
function updateAdminUI(name, role) {
  const nameEl = $('sidebar-admin-name');
  const roleEl = $('sidebar-admin-role');
  const avEl   = $('sidebar-admin-av');
  if (nameEl) nameEl.textContent = name || 'Admin';
  if (roleEl) roleEl.textContent = role === 'super_admin' ? 'Super Admin' : 'Administrateur';
  if (avEl)   avEl.textContent   = (name || 'A')[0].toUpperCase();
}

/* ── NAVIGATION ──────────────────────────────────────────── */
function goPage(name, el) {
  currentPage = name;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    const nav = document.querySelector(`.nav-item[data-page="${name}"]`);
    if (nav) nav.classList.add('active');
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = $(`page-${name}`);
  if (pg) pg.classList.add('active');
  const meta = PAGE_META[name] || {};
  if ($('page-title')) $('page-title').textContent = meta.title || name;
  if ($('page-sub'))   $('page-sub').textContent   = meta.sub || '';
  if (name === 'dashboard') loadDashboard();
  if (name === 'orders')    renderOrders();
  if (name === 'products')  loadProducts();
  if (name === 'clients')   loadClients();
  if (name === 'messages')  initMessages();
  if (name === 'settings')  initSettings();
}

/* ── POLLING ─────────────────────────────────────────────── */
function startAllPolling() {
  loadOrdersData();
  loadUnreadCount();
  ordersPollTimer = setInterval(() => loadOrdersData(true), 15000);
  unreadPollTimer = setInterval(loadUnreadCount, 30000);
}

function stopAllPolling() {
  clearInterval(ordersPollTimer); ordersPollTimer = null;
  clearInterval(unreadPollTimer); unreadPollTimer = null;
  stopMsgPolling();
}

/* ── DASHBOARD ───────────────────────────────────────────── */
function loadDashboard() {
  updateKPIs();
  renderRecentOrders(ordersData.slice(0, 8));
  drawRevenueChart();
  renderStatusDist();
  renderActivityFeed();
}

function updateKPIs() {
  const today  = new Date().toDateString();
  const todayO = ordersData.filter(o => new Date(normalizeDate(o.created_at)).toDateString() === today);
  const rev    = todayO.reduce((s, o) => s + Number(o.total || 0), 0);
  const pend   = ordersData.filter(o => normalizeStatus(o.status) === 'new').length;
  const total  = ordersData.reduce((s, o) => s + Number(o.total || 0), 0);
  const phones = [...new Set(ordersData.map(o => o.customer_phone || o.client_phone).filter(Boolean))];
  if ($('kpi-revenue'))   $('kpi-revenue').textContent   = fmt(rev);
  if ($('kpi-orders'))    $('kpi-orders').textContent     = fmtNum(todayO.length);
  if ($('kpi-pending'))   $('kpi-pending').textContent    = fmtNum(pend);
  if ($('kpi-clients'))   $('kpi-clients').textContent    = fmtNum(phones.length);
  if ($('kpi-revenue-m')) $('kpi-revenue-m').textContent  = fmt(total);
}

function renderRecentOrders(orders) {
  const tbody = $('recent-orders-body');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="td-empty">Aucune commande pour l\'instant</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const sNorm = normalizeStatus(o.status);
    return `<tr>
      <td><span class="order-ref">${esc(o.order_ref || o.id)}</span></td>
      <td>
        <div class="td-name">${esc(o.customer_name || o.client_name || '—')}</div>
        <div class="td-sub">${esc(o.customer_phone || o.client_phone || '')}</div>
      </td>
      <td class="td-mono td-green">${fmt(o.total)}</td>
      <td><span class="status-badge status-${sNorm}">${statusLabel(o.status)}</span></td>
      <td style="color:var(--text3);white-space:nowrap;font-size:.74rem">${formatDate(o.created_at)}</td>
    </tr>`;
  }).join('');
}

/* ── REVENUE CHART ───────────────────────────────────────── */
function drawRevenueChart() {
  const canvas = $('revenue-chart');
  if (!canvas) return;
  const days = chartMode === '7d' ? 7 : 30;
  const W    = Math.max((canvas.parentElement?.clientWidth || 0) - 40, 200);
  canvas.width  = W;
  canvas.height = 130;
  const ctx = canvas.getContext('2d');

  const buckets = [], labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    buckets.push(ordersData.filter(o => new Date(normalizeDate(o.created_at)).toDateString() === key).reduce((s, o) => s + Number(o.total || 0), 0));
    labels.push(days === 7 ? d.toLocaleDateString('fr-FR', { weekday: 'short' }) : d.getDate());
  }

  const maxVal = Math.max(...buckets, 1);
  const [padL, padR, padT, padB] = [6, 6, 16, 28];
  const chartW = W - padL - padR;
  const chartH = canvas.height - padT - padB;
  const step   = chartW / Math.max(days - 1, 1);

  ctx.clearRect(0, 0, W, canvas.height);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, canvas.height);

  ctx.strokeStyle = 'rgba(28,46,36,.07)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (chartH / 3) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }

  const grd = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grd.addColorStop(0, 'rgba(42,102,68,.18)');
  grd.addColorStop(1, 'rgba(42,102,68,0)');
  ctx.beginPath();
  buckets.forEach((v, i) => { const x = padL + i * step, y = padT + chartH - (v / maxVal) * chartH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.lineTo(padL + (days - 1) * step, padT + chartH); ctx.lineTo(padL, padT + chartH);
  ctx.closePath(); ctx.fillStyle = grd; ctx.fill();

  ctx.beginPath();
  buckets.forEach((v, i) => { const x = padL + i * step, y = padT + chartH - (v / maxVal) * chartH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.strokeStyle = 'rgba(42,102,68,.75)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  buckets.forEach((v, i) => {
    const x = padL + i * step, y = padT + chartH - (v / maxVal) * chartH;
    if (v > 0) {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#2A6644'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);   ctx.fillStyle = '#FFFFFF'; ctx.fill();
    }
    if (days <= 7 || i % 5 === 0) {
      ctx.fillStyle = 'rgba(74,100,85,.65)'; ctx.font = '10px Karla, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(String(labels[i]), x, canvas.height - 8);
    }
  });
}

function switchChart(mode, btn) {
  chartMode = mode;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  drawRevenueChart();
}

function renderStatusDist() {
  const el = $('status-dist');
  if (!el || !ordersData.length) return;
  const counts = { new: 0, confirmed: 0, in_delivery: 0, delivered: 0, cancelled: 0 };
  ordersData.forEach(o => { const s = normalizeStatus(o.status); if (s in counts) counts[s]++; });
  const total = ordersData.length;
  const rows  = [
    { label: 'En attente', key: 'new',         color: 'var(--amber)'  },
    { label: 'Confirmée',  key: 'confirmed',   color: 'var(--green3)' },
    { label: 'Livraison',  key: 'in_delivery', color: 'var(--blue)'   },
    { label: 'Livrée',     key: 'delivered',   color: 'var(--green2)' },
    { label: 'Annulée',    key: 'cancelled',   color: 'var(--red)'    },
  ];
  el.innerHTML = rows.map(r => {
    const pct = total ? Math.round((counts[r.key] / total) * 100) : 0;
    return `<div class="status-dist-row">
      <span class="status-dist-label">${r.label}</span>
      <div class="status-dist-bar"><div class="status-dist-fill" style="width:${pct}%;background:${r.color}"></div></div>
      <span class="status-dist-val">${counts[r.key]}</span>
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const el = $('activity-feed');
  if (!el) return;
  const recent = ordersData.slice(0, 6);
  if (!recent.length) { el.innerHTML = '<div style="color:var(--text3);font-size:.78rem;padding:12px 0">Aucune activité récente</div>'; return; }
  el.innerHTML = recent.map((o, i) => {
    const sNorm    = normalizeStatus(o.status);
    const dotClass = sNorm === 'new' ? 'amber' : sNorm === 'in_delivery' ? 'blue' : 'green';
    return `<div class="activity-item" style="animation-delay:${i * 0.05}s">
      <div class="activity-dot ${dotClass}"></div>
      <div class="activity-text">Commande <strong>${esc(o.order_ref || '#' + o.id)}</strong> de <strong>${esc(o.customer_name || o.client_name || 'Client')}</strong> — ${fmt(o.total)}</div>
      <span class="activity-time">${formatDate(o.created_at, 'short')}</span>
    </div>`;
  }).join('');
}

/* ── ORDERS ──────────────────────────────────────────────── */
async function loadOrdersData(silent = false) {
  const data = await apiFetch(`${API}/orders.php?action=list`);
  if (!data.success) return;
  const newOrders = data.orders || [];

  if (lastOrderId > 0 && newOrders.length > 0) {
    const newest   = newOrders[0];
    const newCount = newOrders.filter(o => o.id > lastOrderId).length;
    if (newest.id > lastOrderId) showNewOrderAlert(newCount, newest);
  }
  if (newOrders.length > 0) lastOrderId = Math.max(...newOrders.map(o => o.id));

  ordersData = newOrders;
  const pending = newOrders.filter(o => normalizeStatus(o.status) === 'new').length;
  const badge   = $('nb-orders');
  if (badge) { badge.textContent = pending; badge.className = `nav-badge${pending > 0 ? ' show' : ''}`; }
  if (currentPage === 'orders' && !isUpdatingStatus) renderOrders();
  if (currentPage === 'dashboard') loadDashboard();
}

function showNewOrderAlert(count, order) {
  const alert = $('new-order-alert'), txt = $('new-order-alert-text');
  if (!alert || !txt) return;
  const name = order.customer_name || order.client_name || 'un client';
  txt.textContent = count === 1 ? `Nouvelle commande de ${name} — ${fmt(order.total)}` : `${count} nouvelles commandes !`;
  alert.style.display = 'flex';
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
    osc.start(); osc.stop(ctx.currentTime + .4);
  } catch (e) {}
  const nb = $('nb-orders');
  if (nb) { nb.classList.add('pulse'); setTimeout(() => nb.classList.remove('pulse'), 2000); }
  setTimeout(() => { if (alert) alert.style.display = 'none'; }, 10000);
}

function normalizeStatus(s) { return s === 'nouvelle' ? 'new' : (s || 'new'); }

function renderOrders() {
  const tbody = $('orders-tbody');
  if (!tbody) return;
  let filtered = ordersData.slice();
  if (ordersFilter !== 'all') filtered = filtered.filter(o => normalizeStatus(o.status) === ordersFilter);
  if (ordersSearch) {
    const q = ordersSearch.toLowerCase();
    filtered = filtered.filter(o =>
      (o.order_ref || '').toLowerCase().includes(q) ||
      (o.customer_name || o.client_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || o.client_phone || '').toLowerCase().includes(q)
    );
  }
  const countEl = $('orders-count');
  if (countEl) countEl.textContent = `${filtered.length} commande${filtered.length > 1 ? 's' : ''}`;
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Aucune commande trouvée</td></tr>'; return; }
  tbody.innerHTML = filtered.map(o => {
    const items = parseItems(o);
    const label = items.map(i => `${esc(i.name)}×${i.qty || 1}`).join(', ');
    const sNorm = normalizeStatus(o.status);
    return `<tr id="orow-${o.id}">
      <td><span class="order-ref">${esc(o.order_ref || o.id)}</span></td>
      <td><div class="td-name">${esc(o.customer_name || o.client_name || '—')}</div><div class="td-sub">${esc(o.customer_phone || o.client_phone || '')}</div></td>
      <td class="items-cell" title="${esc(label)}">${label || '—'}</td>
      <td class="td-mono td-green">${fmt(o.total)}</td>
      <td>
        <select class="status-select status-${sNorm}" onchange="updateOrderStatus(${o.id},this)" data-prev="${sNorm}">
          <option value="new"         ${sNorm === 'new'         ? 'selected' : ''}>⏳ En attente</option>
          <option value="confirmed"   ${sNorm === 'confirmed'   ? 'selected' : ''}>✅ Confirmée</option>
          <option value="in_delivery" ${sNorm === 'in_delivery' ? 'selected' : ''}>🚚 En livraison</option>
          <option value="delivered"   ${sNorm === 'delivered'   ? 'selected' : ''}>📦 Livrée</option>
          <option value="cancelled"   ${sNorm === 'cancelled'   ? 'selected' : ''}>❌ Annulée</option>
        </select>
      </td>
      <td style="white-space:nowrap;color:var(--text3);font-size:.74rem">${formatDate(o.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" onclick="viewOrder(${o.id})" title="Détails"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Voir</button>
          <button class="action-btn danger" onclick="deleteOrder(${o.id})" title="Supprimer"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterOrders(status, btn) {
  ordersFilter = status;
  document.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  renderOrders();
}
function searchOrders(q) { ordersSearch = q; renderOrders(); }

async function updateOrderStatus(id, sel) {
  const status = sel.value, prev = sel.dataset.prev || 'new';
  if (status === prev) return;

  /* ── Verrouiller : empêche le polling de re-rendre le tableau
        pendant que l'appel API est en cours ── */
  isUpdatingStatus = true;
  sel.dataset.prev = status;
  sel.className    = `status-select status-${status}`;
  sel.disabled     = true;

  /* Mise à jour locale dans ordersData (optimiste) */
  const o = ordersData.find(o => o.id === id);
  if (o) o.status = status;

  /* Appel API */
  const data = await apiFetch(
    `${API}/orders.php?action=update_status`,
    { method: 'POST', body: JSON.stringify({ id, status }) }
  );

  isUpdatingStatus = false; // déverrouiller dans tous les cas
  sel.disabled = false;

  if (!data.success) {
    /* Revert complet */
    toast(data.message || 'Erreur mise à jour', 'error');
    sel.value        = prev;
    sel.className    = `status-select status-${prev}`;
    sel.dataset.prev = prev;
    if (o) o.status  = prev;
    renderOrders(); // re-rendre avec l'état revert
    return;
  }

  /* Succès : re-rendre le tableau avec le bon statut + màj badges */
  renderOrders();
  toast(`Statut → ${statusLabel(status)}`, 'success');
  const pending = ordersData.filter(o => normalizeStatus(o.status) === 'new').length;
  const badge   = $('nb-orders');
  if (badge) { badge.textContent = pending; badge.className = `nav-badge${pending > 0 ? ' show' : ''}`; }
  if ($('kpi-pending')) $('kpi-pending').textContent = fmtNum(pending);
  if (currentPage === 'dashboard') loadDashboard();
}

function viewOrder(id) {
  const o = ordersData.find(o => o.id === id);
  if (!o) return;
  const items = parseItems(o);
  showModal(`
    <h3>Commande <span style="color:var(--green2)">${esc(o.order_ref || '#' + o.id)}</span></h3>
    <div class="modal-divider"></div>
    <div class="modal-field"><label>Client</label><p>${esc(o.customer_name || o.client_name || '—')}</p></div>
    <div class="modal-field"><label>Téléphone</label><p>${esc(o.customer_phone || o.client_phone || '—')}</p></div>
    <div class="modal-field"><label>Adresse</label><p>${esc(o.customer_address || o.client_address || '—')}</p></div>
    ${o.note ? `<div class="modal-field"><label>Note</label><p>${esc(o.note)}</p></div>` : ''}
    <div class="modal-divider"></div>
    <div class="modal-field"><label>Articles</label>
      <div class="modal-order-items" style="margin-top:6px">
        ${items.map(i => `<div class="modal-order-item"><span>${esc(i.name)} × ${i.qty || 1}</span><span>${fmt((i.price || 0) * (i.qty || 1))}</span></div>`).join('') || '<div class="modal-order-item"><span>—</span></div>'}
      </div>
    </div>
    <div class="modal-divider"></div>
    <div class="modal-field"><label>Frais de livraison</label><p>${fmt(o.delivery_fee || 3000)}</p></div>
    <div class="modal-field"><label>Total</label><p class="modal-total">${fmt(o.total)}</p></div>
    <div class="modal-field"><label>Date</label><p>${formatDate(o.created_at)}</p></div>
  `);
}

async function deleteOrder(id) {
  if (!confirm('Supprimer cette commande ? Cette action est irréversible.')) return;
  const data = await apiFetch(`${API}/orders.php?action=delete`, { method: 'POST', body: JSON.stringify({ id }) });
  if (data.success) { ordersData = ordersData.filter(o => o.id !== id); renderOrders(); toast('Commande supprimée', 'success'); }
  else toast(data.message || 'Erreur', 'error');
}

function parseItems(o) {
  const raw = o.products_json || o.items || '[]';
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  catch { console.warn('[parseItems] JSON invalide commande', o.id); return []; }
}

/* ── PRODUCTS ────────────────────────────────────────────── */
async function loadProducts() {
  const grid = $('products-grid');
  if (grid) grid.innerHTML = '<div class="empty-state">⏳ Chargement…</div>';
  const data = await apiFetch(`${API}/products.php?action=list`);
  if (!data.success || !grid) { toast(data.message || 'Erreur', 'error'); return; }
  allProducts = data.products || [];
  const countEl = $('products-count'); if (countEl) countEl.textContent = allProducts.length;
  applyProductFilters();
}

function applyProductFilters() {
  let filtered = allProducts.slice();
  if (productsFilter !== 'all') {
    if (productsFilter === 'epicerie') {
      filtered = filtered.filter(p => p.category === 'epicerie');
    } else {
      filtered = filtered.filter(p => p.category === productsFilter);
    }
  }
  if (productsSearch) { const q = productsSearch.toLowerCase(); filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q)); }
  const countEl = $('products-count');
  if (countEl) countEl.textContent = `${filtered.length} produit${filtered.length > 1 ? 's' : ''}`;
  renderProducts(filtered);
}

function filterProducts(cat, btn) {
  productsFilter = cat;
  document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  applyProductFilters();
}
function searchProducts(q) { productsSearch = q; applyProductFilters(); }

function renderProducts(products) {
  const grid = $('products-grid');
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = `<div class="empty-state">📦 Aucun produit.<br><button onclick="openProductDrawer()" style="color:var(--green2);text-decoration:underline;cursor:pointer;background:none;border:none;font-size:.82rem;margin-top:8px">Ajouter le premier</button></div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const stock   = Number(p.stock ?? 0);
    const stColor = stock === 0 ? 'var(--red)' : stock < 5 ? 'var(--amber)' : 'var(--green2)';
    const stLabel = stock === 0 ? '⚠ Rupture'  : stock < 5 ? `⚠ Faible (${stock})` : `${stock} en stock`;
    const catLabel = p.category === 'tisanes' ? '🌿 Tisanes' : p.category === 'epicerie' ? '🌿 Alimentaire' : p.category === 'cosmetiques' ? '✨ Cosmétiques' : p.category === 'services' ? '🛎️ Services' : esc(p.category || 'epicerie');
    const subLabel = (p.category === 'cosmetiques' && p.subcategory) ? `<span class="product-subcat-badge">${esc(p.subcategory)}</span>` : '';
    return `<div class="product-card" id="pcard-${p.id}">
      <div class="product-card-img">
        ${p.image ? `<img src="${SITE_BASE}/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="product-img-placeholder">📦</div>`}
        <span class="product-cat-badge">${catLabel}</span>
        ${subLabel}
        ${p.is_new  ? '<span class="product-new-badge">NEW</span>' : ''}
        ${!p.is_active ? '<div class="product-inactive-overlay"><span class="product-inactive-tag">Inactif</span></div>' : ''}
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${esc(p.name)}</div>
        <div class="product-card-price">${fmt(p.price)}</div>
        <div class="product-card-stock" style="color:${stColor}">${stLabel}</div>
        <div class="product-card-actions">
          <button class="action-btn" style="flex:1;justify-content:center" onclick="openProductDrawer(${p.id})">✏️ Modifier</button>
          <button class="action-btn danger" onclick="deleteProduct(${p.id})" title="Supprimer"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── PRODUCT DRAWER ──────────────────────────────────────── */
let dpEditMode = false, dpEditId = null, dpFileObj = null;

function openProductDrawer(editId = null) {
  dpResetForm();
  const btn = $('dp-save-btn');
  if (editId) {
    dpEditMode = true; dpEditId = editId;
    if ($('drawer-title')) $('drawer-title').textContent = 'Modifier le produit';
    if ($('drawer-sub'))   $('drawer-sub').textContent   = 'Mise à jour du catalogue';
    if (btn && btn.lastChild && btn.lastChild.nodeType === 3) btn.lastChild.textContent = ' Mettre à jour';
    const banner = $('drawer-edit-banner'); if (banner) banner.style.display = 'flex';
    dpLoadProduct(editId);
  } else {
    dpEditMode = false; dpEditId = null;
    if ($('drawer-title')) $('drawer-title').textContent = 'Nouveau produit';
    if ($('drawer-sub'))   $('drawer-sub').textContent   = 'Ajouter au catalogue TISANATURE';
    const banner = $('drawer-edit-banner'); if (banner) banner.style.display = 'none';
  }
  $('drawer-overlay')?.classList.add('on');
  $('product-drawer')?.classList.add('open');
  setTimeout(() => $('dp-name')?.focus(), 300);
}

function closeProductDrawer() {
  $('drawer-overlay')?.classList.remove('on');
  $('product-drawer')?.classList.remove('open');
  dpResetForm();
}

async function dpLoadProduct(id) {
  const data = await apiFetch(`${API}/products.php?action=get&id=${id}`);
  if (!data.success || !data.product) { toast('Produit introuvable', 'error'); return; }
  const p = data.product;
  if ($('dp-name'))     $('dp-name').value     = p.name        || '';
  if ($('dp-category'))    $('dp-category').value   = p.category    || 'epicerie';
  if ($('dp-subcategory')) $('dp-subcategory').value = p.subcategory || '';
  if ($('dp-desc'))        $('dp-desc').value        = p.description || '';
  if ($('dp-price'))    $('dp-price').value    = p.price       || '';
  if ($('dp-stock'))    $('dp-stock').value    = p.stock       ?? 0;
  if ($('dp-active'))   $('dp-active').checked   = !!p.is_active;
  if ($('dp-new'))      $('dp-new').checked      = !!p.is_new;
  if ($('dp-verified')) $('dp-verified').checked = !!p.is_verified;
  const editName = $('drawer-edit-name'); if (editName) editName.textContent = p.name;
  if (p.image) {
    const wrap = $('dp-current-img-wrap'), img = $('dp-current-img'), lbl = $('dp-current-img-lbl');
    if (wrap) wrap.style.display = 'flex';
    if (img)  img.src = SITE_BASE + '/' + p.image;
    if (lbl)  lbl.textContent = p.image;
  }
  dpOnCategoryChange(); dpOnPriceChange(); dpOnStockChange(); dpOnNameChange();
}

function dpResetForm() {
  dpFileObj = null; dpEditMode = false; dpEditId = null;
  ['dp-name', 'dp-price', 'dp-stock', 'dp-desc', 'dp-subcategory'].forEach(id => { const el = $(id); if (el) { el.value = ''; el.classList.remove('err'); } });
  if ($('dp-category'))     $('dp-category').value   = 'epicerie';
  if ($('dp-active'))       $('dp-active').checked   = true;
  if ($('dp-new'))          $('dp-new').checked      = false;
  if ($('dp-verified'))     $('dp-verified').checked = true;
  if ($('dp-price-val'))    $('dp-price-val').textContent  = '— FCFA';
  if ($('dp-stock-val'))    $('dp-stock-val').textContent  = '0';
  if ($('dp-stock-fill'))   $('dp-stock-fill').style.width = '0%';
  if ($('dp-slug-preview')) $('dp-slug-preview').textContent = '—';
  dpClearImage();
  const wrap = $('dp-current-img-wrap');   if (wrap)   wrap.style.display = 'none';
  const banner = $('drawer-edit-banner');  if (banner) banner.style.display = 'none';
  const btn = $('dp-save-btn');
  if (btn && btn.lastChild && btn.lastChild.nodeType === 3) btn.lastChild.textContent = ' Enregistrer le produit';
}

function dpOnCategoryChange() {
  const cat = $('dp-category')?.value;
  const isService = cat === 'services';
  const subRow = $('dp-subcat-row');
  if (subRow) subRow.style.display = (cat === 'cosmetiques') ? 'block' : 'none';
  if (cat !== 'cosmetiques' && $('dp-subcategory')) $('dp-subcategory').value = '';

  const row = $('dp-price-row'); if (row) row.style.opacity = isService ? '.4' : '1';
  const inp = $('dp-price');
  if (isService) { if (inp) { inp.value = '0'; inp.setAttribute('disabled', ''); } if ($('dp-price-val')) $('dp-price-val').textContent = 'Sur devis'; }
  else           { if (inp) inp.removeAttribute('disabled'); dpOnPriceChange(); }
}
function dpOnNameChange()  { const s = toSlug($('dp-name')?.value || ''); const el = $('dp-slug-preview'); if (el) el.textContent = s || '—'; }
function dpOnPriceChange() { const v = parseFloat($('dp-price')?.value) || 0; const el = $('dp-price-val'); if (el) el.textContent = v > 0 ? v.toLocaleString('fr-FR') + ' FCFA' : '— FCFA'; }
function dpOnStockChange() {
  const v = parseInt($('dp-stock')?.value) || 0;
  const fill = $('dp-stock-fill'), val = $('dp-stock-val');
  if (val)  val.textContent  = v;
  if (fill) { fill.style.width = Math.min(100, v) + '%'; fill.style.background = v === 0 ? 'var(--red)' : v < 5 ? 'var(--amber)' : 'var(--green3)'; }
}
function dpFileSelected(e) { const f = e.target.files[0]; if (f) dpShowPreview(f); }
function dpShowPreview(file) {
  if (file.size > 3 * 1024 * 1024) { toast('Image trop lourde (max 3 Mo)', 'error'); return; }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { toast('Format non supporté', 'error'); return; }
  dpFileObj = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const prev = $('dp-img-preview'), img = $('dp-preview-img'), name = $('dp-preview-name'), zone = $('dp-upload-zone');
    if (img)  img.src = ev.target.result;
    if (name) name.textContent = file.name;
    if (prev) prev.classList.add('show');
    if (zone) zone.style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function dpClearImage() {
  dpFileObj = null;
  const fi = $('dp-img-file'); if (fi) fi.value = '';
  const prev = $('dp-img-preview'), zone = $('dp-upload-zone');
  if (prev) prev.classList.remove('show');
  if (zone) zone.style.display = 'flex';
}
function dpDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  $('dp-upload-zone')?.classList.add('drag-over');
}
function dpDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  $('dp-upload-zone')?.classList.remove('drag-over');
}
function dpDropped(e) {
  e.preventDefault();
  e.stopPropagation();
  $('dp-upload-zone')?.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) dpShowPreview(f);
}

async function dpSaveProduct() {
  const name   = $('dp-name')?.value.trim();
  const cat    = $('dp-category')?.value;
  const sub    = $('dp-subcategory')?.value || '';
  const price  = parseFloat($('dp-price')?.value);
  const desc   = $('dp-desc')?.value.trim();
  const stock  = parseInt($('dp-stock')?.value)  || 0;
  const active   = $('dp-active')?.checked ? 1 : 0;
  const isNew    = $('dp-new')?.checked    ? 1 : 0;
  const verified = $('dp-verified')?.checked ? 1 : 0;
  let valid = true;
  if (!name)                          { $('dp-name')?.classList.add('err');  valid = false; } else $('dp-name')?.classList.remove('err');
  if (cat !== 'services' && (!price || price <= 0)) { $('dp-price')?.classList.add('err'); valid = false; } else $('dp-price')?.classList.remove('err');
  if (!valid) { toast('Remplissez les champs obligatoires', 'error'); return; }

  const btn = $('dp-save-btn'), origHTML = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;height:15px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 010 20"/></svg> Enregistrement…`; }

  const fd = new FormData();
  if (dpEditMode && dpEditId) fd.append('id', dpEditId);
  fd.append('name', name); fd.append('price', isNaN(price) ? 0 : price);
  fd.append('category', cat);
  fd.append('subcategory', sub);
  fd.append('description', desc || '');
  fd.append('stock', stock); fd.append('is_active', active); fd.append('is_new', isNew);
  fd.append('is_verified', verified);
  if (dpFileObj) fd.append('image', dpFileObj);

  const endpoint = dpEditMode ? `${API}/products.php?action=update` : `${API}/products.php?action=add`;
  const data = await apiFetch(endpoint, { method: 'POST', body: fd });
  if (data.success) { toast(data.message || (dpEditMode ? 'Produit mis à jour !' : 'Produit ajouté !'), 'success'); closeProductDrawer(); await loadProducts(); }
  else toast(data.message || 'Erreur serveur', 'error');
  if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
}

async function deleteProduct(id) {
  if (!confirm('Supprimer ce produit ? Cette action est irréversible.')) return;
  const data = await apiFetch(`${API}/products.php?action=delete`, { method: 'POST', body: JSON.stringify({ id }) });
  if (data.success) {
    toast('Produit supprimé', 'success');
    allProducts = allProducts.filter(p => p.id !== id);
    const card = $(`pcard-${id}`);
    if (card) { card.style.cssText += 'transition:opacity .2s,transform .2s;opacity:0;transform:scale(.92)'; setTimeout(() => card.remove(), 220); }
    else applyProductFilters();
  } else toast(data.message || 'Erreur', 'error');
}

/* ── CLIENTS ─────────────────────────────────────────────── */
async function loadClients() {
  const tbody = $('clients-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="td-empty">Chargement…</td></tr>';
  const data = await apiFetch(`${API}/clients.php?action=list`);
  if (!data.success) { toast(data.message || 'Erreur', 'error'); return; }
  allClients = data.clients || [];
  renderClients(allClients);
}
function renderClients(list) {
  const tbody = $('clients-tbody'), countEl = $('clients-count');
  if (countEl) countEl.textContent = `${list.length} client${list.length > 1 ? 's' : ''}`;
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="td-empty">Aucun client</td></tr>'; return; }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td><div class="client-avatar-row"><div class="client-avatar">${esc((c.client_name || c.customer_name || '?')[0].toUpperCase())}</div><span class="client-name">${esc(c.client_name || c.customer_name || '—')}</span></div></td>
      <td class="td-mono">${esc(c.client_phone || c.customer_phone || '—')}</td>
      <td class="items-cell">${esc(c.client_address || c.customer_address || '—')}</td>
      <td style="text-align:center;color:var(--cream);font-weight:600">${fmtNum(c.order_count || 0)}</td>
      <td class="td-mono td-green">${fmt(c.total_spent || 0)}</td>
    </tr>`).join('');
}
function searchClients(q) {
  if (!q) { renderClients(allClients); return; }
  const ql = q.toLowerCase();
  renderClients(allClients.filter(c => (c.client_name || c.customer_name || '').toLowerCase().includes(ql) || (c.client_phone || c.customer_phone || '').toLowerCase().includes(ql)));
}

/* ── MESSAGERIE ──────────────────────────────────────────── */
async function initMessages() {
  await loadConversations();
  stopMsgPolling();
  msgPollTimer = setInterval(async () => {
    await loadConversations();
    if (currentConvId) await msgLoadMessages(currentConvId);
  }, 5000);
}

async function loadConversations() {
  const data = await apiFetch(`${MSG_API}?action=conversations`);
  if (!data.success) return;
  const convs  = data.conversations || [];
  const list   = $('msg-conv-list'), cnt = $('msg-conv-count'), badge = $('nb-messages');
  const unread = convs.filter(c => c.unread_count > 0).length;
  if (cnt)   { cnt.textContent = convs.length; cnt.style.display = convs.length ? 'inline-flex' : 'none'; }
  if (badge) { badge.textContent = unread; badge.className = `nav-badge${unread > 0 ? ' show' : ''}`; }
  if (!list) return;
  if (!convs.length) { list.innerHTML = '<div style="padding:24px 16px;text-align:center;color:var(--text3);font-size:.78rem">Aucun message</div>'; return; }
  list.innerHTML = convs.map(c => {
    const isActive = currentConvId != null && String(c.id) === String(currentConvId);
    return `<div class="msg-conv-card ${c.unread_count > 0 ? 'unread' : ''} ${isActive ? 'active' : ''}"
         onclick="msgOpenConv(${c.id},'${esc(c.client_name)}','${esc(c.client_phone || '')}')">
      <div class="msg-conv-avatar">${esc((c.client_name || '?')[0].toUpperCase())}</div>
      <div style="flex:1;overflow:hidden;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:5px">
          <div class="msg-conv-name">${esc(c.client_name)}</div>
          <div class="msg-conv-time">${formatDate(c.last_message_at, 'short')}</div>
        </div>
        <div class="msg-conv-preview">${esc(c.last_message || '—')}</div>
      </div>
      ${c.unread_count > 0 ? '<div class="msg-unread-dot"></div>' : ''}
    </div>`;
  }).join('');
}

async function msgOpenConv(id, name, phone) {
  currentConvId = id;
  const empty = $('msg-empty-state'), hdr = $('msg-chat-hdr'), msgs = $('msg-chat-msgs'), reply = $('msg-chat-reply');
  if (empty) empty.style.display = 'none';
  if (hdr)   hdr.style.display   = 'flex';
  if (msgs)  msgs.style.display  = 'flex';
  if (reply) reply.style.display = 'block';
  const n = $('msg-chat-name');  if (n) n.textContent = name;
  const p = $('msg-chat-phone'); if (p) p.textContent = phone || 'Pas de téléphone';
  await msgLoadMessages(id);
  await apiFetch(`${MSG_API}?action=mark_read`, { method: 'POST', body: JSON.stringify({ id }) });
  await loadConversations();
}

async function msgLoadMessages(convId) {
  const data = await apiFetch(`${MSG_API}?action=conv&id=${convId}`);
  if (!data.success) return;
  const wrap = $('msg-chat-msgs');
  if (!wrap) return;
  const isAtBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 60;
  const msgs = data.messages || [];
  wrap.innerHTML = msgs.map(m => `
    <div style="display:flex;flex-direction:${m.sender === 'admin' ? 'row-reverse' : 'row'};margin-bottom:3px">
      <div class="msg-bubble ${m.sender === 'admin' ? 'msg-bubble-admin' : ''}">
        <div class="msg-bubble-text">${esc(m.content)}</div>
        <div class="msg-bubble-time">${formatDate(m.created_at, 'time')}</div>
      </div>
    </div>`).join('');
  requestAnimationFrame(() => { if (isAtBottom) wrap.scrollTop = wrap.scrollHeight; });
}

async function msgSendReply() {
  if (!currentConvId) return;
  const input   = $('msg-reply-input');
  const content = input?.value.trim();
  if (!content) return;
  const wrap = $('msg-chat-msgs');
  if (wrap) {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:row-reverse;margin-bottom:3px';
    div.innerHTML = `<div class="msg-bubble msg-bubble-admin"><div class="msg-bubble-text">${esc(content)}</div><div class="msg-bubble-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div>`;
    wrap.appendChild(div);
    requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
  }
  input.value = ''; input.style.height = 'auto';
  const data = await apiFetch(`${MSG_API}?action=reply`, { method: 'POST', body: JSON.stringify({ conversation_id: currentConvId, content }) });
  if (data.success) await msgLoadMessages(currentConvId);
  else toast('Erreur envoi message', 'error');
}

function stopMsgPolling() {
  if (msgPollTimer) { clearInterval(msgPollTimer); msgPollTimer = null; }
}

async function loadUnreadCount() {
  const data = await apiFetch(`${MSG_API}?action=unread_count`);
  if (!data.success) return;
  const n = data.count || 0;
  const badge = $('nb-messages');
  if (badge)        { badge.textContent = n; badge.className = `nav-badge${n > 0 ? ' show' : ''}`; }
  if ($('kpi-msgs')) $('kpi-msgs').textContent = fmtNum(n);
}

/* ── SETTINGS ────────────────────────────────────────────── */
async function initSettings() {
  const data = await apiFetch(`${API}/settings.php?action=get`);
  if (!data.success) return;
  const s = data.settings || {};
  if ($('set-site-name'))    $('set-site-name').value    = s.site_name    || 'TISANATURE';
  if ($('set-phone'))        $('set-phone').value        = s.phone        || '';
  if ($('set-delivery-fee')) $('set-delivery-fee').value = s.delivery_fee || 3000;
  if ($('set-whatsapp'))     $('set-whatsapp').value     = s.whatsapp     || '';
  if ($('set-instagram'))    $('set-instagram').value    = s.instagram    || '';
  if ($('set-address'))      $('set-address').value      = s.address      || '';
}

async function saveSettings(e) {
  e.preventDefault();
  const data = await apiFetch(`${API}/settings.php?action=save`, { method: 'POST', body: JSON.stringify({
    site_name:    $('set-site-name')?.value,
    phone:        $('set-phone')?.value,
    delivery_fee: $('set-delivery-fee')?.value,
    whatsapp:     $('set-whatsapp')?.value,
    instagram:    $('set-instagram')?.value,
    address:      $('set-address')?.value,
  })});
  toast(data.success ? 'Paramètres sauvegardés !' : (data.message || 'Erreur'), data.success ? 'success' : 'error');
}

async function changePassword(e) {
  e.preventDefault();
  const current = $('set-pass-current')?.value;
  const newPass = $('set-pass-new')?.value;
  const confirm = $('set-pass-confirm')?.value;
  if (newPass !== confirm)  { toast('Les mots de passe ne correspondent pas', 'error'); return; }
  if (newPass.length < 8)   { toast('Minimum 8 caractères', 'error'); return; }
  const data = await apiFetch(`${API}/auth.php?action=change_password`, { method: 'POST', body: JSON.stringify({ current_password: current, new_password: newPass }) });
  toast(data.success ? 'Mot de passe modifié !' : (data.message || 'Erreur'), data.success ? 'success' : 'error');
  if (data.success) e.target.reset();
}

/* ── MODAL ───────────────────────────────────────────────── */
function showModal(html) {
  const m = $('generic-modal'), b = $('generic-modal-body');
  if (!m) return;
  if (b) b.innerHTML = html;
  m.classList.add('on');
}
function closeModal() { $('generic-modal')?.classList.remove('on'); }

/* ── HELPERS ─────────────────────────────────────────────── */
function statusLabel(s) {
  return { new: 'En attente', nouvelle: 'En attente', confirmed: 'Confirmée', in_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée' }[s] || s || '—';
}
function normalizeDate(d) { return d ? String(d).replace(' ', 'T') : d; }
function formatDate(d, mode = 'full') {
  if (!d) return '—';
  const dt = new Date(normalizeDate(d));
  if (isNaN(dt.getTime())) return String(d);
  if (mode === 'time')  return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (mode === 'short') return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  $('login-form')?.addEventListener('submit', handleLogin);
  checkSession();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeProductDrawer(); closeModal(); }
  });
  window.addEventListener('resize', () => {
    if (currentPage === 'dashboard') drawRevenueChart();
  });
});