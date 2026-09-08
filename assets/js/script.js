/* ══════════════════════════════════════════════════════════════
   TISANATURE — script.js  (v6 — facture après livraison)
   PATCH : IDs épicerie uniformisés (epicerie-section/grid/count)
══════════════════════════════════════════════════════════════ */

'use strict';

(function initTNBase() {
  if (typeof window.__TN_SITE_BASE__ === 'string') return;
  var base = '';
  try {
    var nodes = document.querySelectorAll('script[src*="/assets/js/"]');
    for (var i = 0; i < nodes.length; i++) {
      var u = new URL(nodes[i].src);
      var p = u.pathname;
      var j = p.indexOf('/assets/js/');
      if (j !== -1) { base = p.slice(0, j); break; }
    }
  } catch (e) {}
  window.__TN_SITE_BASE__ = base;
})();

/* ══════════════════════════════════════════════════════════════
   CATALOGUE STATIQUE (fallback si l'API est inaccessible)
══════════════════════════════════════════════════════════════ */
const PRODUCTS_FALLBACK = [
  { name: 'Tisane Detox', price: 6500, img: 'images/detox.jpg', category: 'epicerie', description: 'Purifiez votre corps naturellement avec ce mélange détoxifiant aux plantes soigneusement sélectionnées.' },
  { name: 'Beauté Peau', price: 7500, img: 'images/logo_tisanatur.jpg', category: 'epicerie', description: 'Éclat et hydratation de l\'intérieur. Cette tisane combine des plantes riches en antioxydants.' },
  { name: 'Sommeil Doux', price: 7000, img: 'images/sommeil.png', category: 'epicerie', description: 'Pour des nuits paisibles et récupératrices. Formulée à base de plantes apaisantes.' },
  { name: 'Énergie Vitale', price: 6800, img: 'images/energie.png', category: 'epicerie', description: 'Boostez votre vitalité naturellement sans caféine excessive.' },
  { name: 'Lait Corps', price: 9500, img: 'images/lait.jpg', category: 'cosmetiques', description: 'Hydratation intense 24h. Formule légère à base de beurre de karité.' },
  { name: 'Savon Douceur', price: 3500, img: 'images/savon.jpg', category: 'cosmetiques', description: 'Savon artisanal à froid enrichi en glycérine naturelle.' },
  { name: 'Crème Cheveux', price: 8000, img: 'images/creme-cheveux.png', category: 'cosmetiques', description: 'Nutrition profonde et brillance retrouvée. Riche en protéines végétales.' },
  { name: 'Huile Corps', price: 11000, img: 'images/huile.png', category: 'cosmetiques', description: 'Huile précieuse multi-usages. Sèche rapidement, ne laisse pas de film gras.' },
  { name: 'Masque Visage', price: 6500, img: 'images/masque.png', category: 'cosmetiques', description: 'Éclat instantané pour votre visage. Masque argileux purifiant.' },
  { name: 'Sérum Anti-âge', price: 12500, img: 'images/serum.png', category: 'cosmetiques', description: 'Jeunesse et éclat retrouvés. Concentré actif en vitamine C naturelle.' },
  { name: 'Gommage Corps', price: 8500, img: 'images/gommage.png', category: 'cosmetiques', description: 'Exfoliation en profondeur pour une peau toute neuve.' },
  { name: 'Baume Lèvres', price: 3800, img: 'images/baume.png', category: 'cosmetiques', description: 'Protection et nutrition des lèvres toute la journée.' },
  { name: 'Conseils Bien-être', price: 0, img: 'images/conseil.png', category: 'services', description: 'Un accompagnement personnalisé adapté à vos besoins.' },
  { name: 'Commandes en Gros', price: 0, img: 'images/gros.png', category: 'services', description: 'Tarifs professionnels et avantages exclusifs.' },
  { name: 'Coffrets Cadeaux', price: 0, img: 'images/coffret.png', category: 'services', description: 'Des coffrets cadeaux uniques, composés sur-mesure.' },
];

/* ── Configuration ──────────────────────────────────────────── */
const DELIVERY = 3000;
const WHATSAPP_NUM = '221775671821';
const SITE_BASE = typeof window.__TN_SITE_BASE__ === 'string' ? window.__TN_SITE_BASE__ : '';
const API_BASE = SITE_BASE + '/api';

/* ── État global ────────────────────────────────────────────── */
let PRODUCTS = [];
let cart = loadCart();
let currentProduct = null;
let isSubmitting = false;

/* ── Utilitaires ────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('fr-FR') + ' FCFA';
const esc = str => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ══════════════════════════════════════════════════════════════
   CHARGEMENT PRODUITS DEPUIS L'API
══════════════════════════════════════════════════════════════ */
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products.php?action=public`);
    const data = await res.json();
    if (data.success && Array.isArray(data.products) && data.products.length > 0) {
      PRODUCTS = data.products.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        img: p.image ? (SITE_BASE + '/' + String(p.image).replace(/^\//, '')) : 'images/placeholder.jpg',
        category: p.category || 'epicerie',
        cat: p.category || 'epicerie',
        description: p.description || '',
        desc: p.description || '',
        is_new: !!p.is_new,
        stock: Number(p.stock) || 0,
        subcategory: p.subcategory || '',
      }));
    } else {
      console.warn('[TISANATURE] Produits API indisponibles, utilisation du catalogue statique.');
      PRODUCTS = PRODUCTS_FALLBACK.map(p => ({ ...p, cat: p.category, desc: p.description }));
    }
  } catch (err) {
    console.warn('[TISANATURE] Erreur chargement produits :', err.message);
    PRODUCTS = PRODUCTS_FALLBACK.map(p => ({ ...p, cat: p.category, desc: p.description }));
  }
  cart = reconcileCart(cart);
  render();
  updateHero();
  renderCart();
  updateBadge();
}

function getProductByName(name) {
  let p = PRODUCTS.find(x => x.name === name);
  if (!p && window.TISA_PALETTE) {
    const tp = window.TISA_PALETTE.find(x => x.name === name);
    if (tp) {
      p = { ...tp, category: 'tisanes', desc: tp.note, description: tp.note, is_new: tp.isNew, image: tp.img };
    }
  }
  return p;
}

function reconcileCart(savedCart) {
  return savedCart
    .map(item => {
      const found = getProductByName(item.name);
      return found && found.price > 0 ? { ...found, qty: Math.max(1, item.qty || 1) } : null;
    })
    .filter(Boolean);
}

/* ══════════════════════════════════════════════════════════════
   PANIER — Persistance
══════════════════════════════════════════════════════════════ */
function loadCart() {
  try { return JSON.parse(localStorage.getItem('tn_cart') || '[]'); }
  catch { return []; }
}

function save() {
  try { localStorage.setItem('tn_cart', JSON.stringify(cart.map(i => ({ name: i.name, qty: i.qty })))); }
  catch (e) { console.warn('[TISANATURE] Impossible de sauvegarder le panier :', e); }
}

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.innerHTML = msg;
  el.className = 'toast on'
    + (type === 'error' ? ' toast-error' : '')
    + (type === 'success' ? ' toast-success' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), type === 'success' ? 4000 : 3000);
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════════ */
function goTo(id) {
  const el = $(id);
  if (!el) return;
  // Temporarily enable smooth scroll for intentional navigation only
  document.documentElement.style.scrollBehavior = 'smooth';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => { document.documentElement.style.scrollBehavior = 'auto'; }, 800);
}

function whatsapp(msg) {
  const url = msg
    ? `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${WHATSAPP_NUM}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function toggleMenu() {
  const menu = $('nav-mobile');
  const burger = $('burger-btn');
  if (!menu || !burger) return;
  const isOpen = menu.classList.toggle('open');
  burger.classList.toggle('open', isOpen);
  burger.setAttribute('aria-expanded', String(isOpen));
}

window.addEventListener('scroll', () => {
  const nav = $('nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
function getLatestProduct() {
  const newProds = PRODUCTS.filter(p => p.is_new && p.price > 0);
  if (newProds.length) return newProds[newProds.length - 1];
  for (let i = PRODUCTS.length - 1; i >= 0; i--) {
    if (PRODUCTS[i].price > 0) return PRODUCTS[i];
  }
  return null;
}

function updateHero() {
  const p = getLatestProduct();
  if (!p) return;
  const cat = p.category || p.cat || 'epicerie';
  const catLabel = cat === 'epicerie' ? 'Produits Alimentaires · Nouveauté' : 'Cosmétiques · Nouveauté';
  const pillName = $('hero-pill-name'); if (pillName) pillName.textContent = p.name;
  const pillSub = $('hero-pill-sub'); if (pillSub) pillSub.textContent = catLabel;
  const pillPrice = $('hero-pill-price'); if (pillPrice) pillPrice.textContent = fmt(p.price);
  const img = $('hero-img');
  if (img && p.img) { img.src = p.img; img.alt = p.name; }
}

function scrollToNewProduct() {
  const p = getLatestProduct();
  if (!p) return;
  const cat = p.category || p.cat || 'epicerie';
  goTo(cat === 'epicerie' ? 'epicerie-section' : 'cosmetiques-section');
}

/* ══════════════════════════════════════════════════════════════
   RENDU PRODUITS
══════════════════════════════════════════════════════════════ */
function render() {
  const tg = $('epicerie-grid');      // ← renommé
  const cg = $('cosmetiques-grid');
  const sg = $('services-grid');
  if (tg) tg.innerHTML = '';
  if (cg) cg.innerHTML = '';
  if (sg) sg.innerHTML = '';

  const latest = getLatestProduct();
  let tc = 0, cc = 0;

  PRODUCTS.forEach(p => {
    const cat = p.category || p.cat || 'epicerie';
    const isLatest = latest && p.name === latest.name;
    if (cat === 'epicerie') { tc++; if (tg) tg.appendChild(makeCard(p, isLatest)); }
    else if (cat === 'cosmetiques') { cc++; if (cg) cg.appendChild(makeCard(p, isLatest)); }
    else if (cat === 'services') { if (sg) sg.appendChild(makeSvc(p)); }
  });

  const tcel = $('epicerie-count');    // ← renommé
  const ccel = $('cosmetiques-count');
  if (tcel) tcel.textContent = `${tc} produit${tc > 1 ? 's' : ''}`;
  if (ccel) ccel.textContent = `${cc} produit${cc > 1 ? 's' : ''}`;
  setTimeout(initReveal, 80);
}

window.filterCosmetiques = function(filter) {
  const tabs = document.querySelectorAll('.pf-tab');
  tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-filter') === filter));

  const cards = document.querySelectorAll('#cosmetiques-grid .pcard');
  cards.forEach(card => {
    if (filter === 'all') {
      card.style.display = '';
    } else {
      const sub = card.getAttribute('data-subcategory') || '';
      card.style.display = (sub === filter) ? '' : 'none';
    }
  });

  const sec = $('cosmetiques-section');
  if (sec) setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
};

function makeCard(p, isLatest) {
  const newBadge = (isLatest || p.is_new)
    ? `<span class="pcard-new-badge" aria-label="Nouveauté">NOUVEAUTÉ</span>` : '';
  const d = document.createElement('div');
  d.className = 'pcard reveal';
  d.setAttribute('role', 'listitem');
  if (p.subcategory) d.setAttribute('data-subcategory', p.subcategory);

  d.innerHTML = `
    <div class="pcard-img-section">
      <div class="pcard-badges">
        ${newBadge}
      </div>
      <div class="pcard-img-container">
        <img src="${esc(p.img || p.image || '')}" alt="${esc(p.name)}" loading="lazy"
             onload="this.parentElement.classList.add('loaded')"
             onerror="this.parentElement.classList.add('loaded');this.style.opacity='0'">
      </div>
    </div>
    <div class="pcard-body">
      <div class="pcard-name">${esc(p.name)}</div>
      <div class="pcard-price">${fmt(p.price)}</div>
      <div class="pcard-controls">
        <div class="pcard-qty-wrap">
          <button class="pcard-qty-btn" onclick="cardQty(event,'${esc(p.name)}',-1)" aria-label="Moins">&#x2212;</button>
          <span   class="pcard-qty-n"  data-qty="${esc(p.name)}">0</span>
          <button class="pcard-qty-btn" onclick="cardQty(event,'${esc(p.name)}',1)"  aria-label="Plus">+</button>
        </div>
        <button class="pcard-add" data-name="${esc(p.name)}"
                onclick="if(typeof openProductModal==='function') openProductModal(this.dataset.name)"
                aria-label="Voir le produit">&rarr;</button>
      </div>
    </div>`;
  return d;
}

function makeSvc(p) {
  const desc = p.description || p.desc || '';
  const icons = {
    'Conseils Bien-être': `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    'Commandes en Gros': `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`,
    'Coffrets Cadeaux': `<svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7m0-4a2.5 2.5 0 012.5 2.5V7H9.5V5.5A2.5 2.5 0 0112 3z"/></svg>`,
  };
  const svcs = PRODUCTS.filter(x => (x.category || x.cat) === 'services');
  const idx = svcs.indexOf(p);
  const fallbackIcons = [
    `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    `<svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/></svg>`,
    `<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/></svg>`,
  ];
  const icon = icons[p.name] || fallbackIcons[idx % fallbackIcons.length];
  const isFirst = idx === 0;
  const d = document.createElement('div');
  d.className = 'svc-card reveal' + (isFirst ? ' svc-active' : '');
  d.innerHTML = `
    <div class="svc-icon-pill">${icon}</div>
    <div class="svc-text-col">
      <div class="svc-name">${esc(p.name)}</div>
      <div class="svc-desc">${esc(desc)}</div>
    </div>`;
  return d;
}

/* ══════════════════════════════════════════════════════════════
   MODAL PRODUIT
══════════════════════════════════════════════════════════════ */
function cardQty(e, name, delta) {
  e.stopPropagation();
  const p = getProductByName(name);
  if (!p || p.price === 0) return;
  const ex = cart.find(x => x.name === name);
  if (delta > 0) {
    if (ex) ex.qty++;
    else cart.push({ ...p, qty: 1 });
    showToast(`<strong>${esc(name)}</strong> ajouté au panier`);
  } else {
    if (!ex || ex.qty <= 0) return;
    ex.qty--;
    if (ex.qty === 0) cart.splice(cart.indexOf(ex), 1);
  }
  save(); renderCart(); updateBadge(); updateCardQtyDisplays();
}

function updateCardQtyDisplays() {
  document.querySelectorAll('[data-qty]').forEach(el => {
    const name = el.dataset.qty;
    const item = cart.find(x => x.name === name);
    el.textContent = item ? item.qty : 0;
    el.style.color = item && item.qty > 0 ? 'var(--brand)' : 'var(--ink)';
  });
}

let _pmQty = 1;
function pmQty(delta) {
  _pmQty = Math.max(1, _pmQty + delta);
  const el = document.getElementById('pm-qty-n');
  if (el) el.textContent = _pmQty;
}

function openProductModal(name) {
  const p = getProductByName(name);
  if (!p) return;
  currentProduct = p;
  const cat = p.category || p.cat || 'epicerie';
  const desc = p.description || p.desc || '';
  const latest = getLatestProduct();
  const isLatest = latest && p.name === latest.name;
  let catLabel = 'Produits';
  let pmTagText = 'Produit';
  if (cat === 'epicerie') {
    catLabel = 'Produits Alimentaires · Bien-être';
    pmTagText = 'Prod. Alimentaire';
  } else if (cat === 'tisanes') {
    catLabel = 'Tisanes · Bien-être';
    pmTagText = 'Tisane';
  } else if (cat === 'cosmetiques') {
    catLabel = 'Cosmétiques · Beauté';
    pmTagText = 'Cosmétique';
  } else if (cat === 'services') {
    catLabel = 'Services';
    pmTagText = 'Service';
  }

  const pmImg = $('pm-img'); if (pmImg) { pmImg.src = p.img || p.image || ''; pmImg.alt = p.name; }
  const pmTag = $('pm-tag'); if (pmTag) pmTag.textContent = pmTagText;
  const pmCat = $('pm-cat'); if (pmCat) pmCat.textContent = catLabel;
  const pmName = $('pm-name'); if (pmName) pmName.textContent = p.name;
  const pmDesc = $('pm-desc'); if (pmDesc) pmDesc.textContent = desc;
  const pmPrice = $('pm-price'); if (pmPrice) pmPrice.textContent = fmt(p.price);
  const pmBadge = $('pm-badge'); if (pmBadge) pmBadge.style.display = (isLatest || p.is_new) ? 'inline-block' : 'none';

  _pmQty = 1;
  const pmQtyEl = $('pm-qty-n');
  if (pmQtyEl) pmQtyEl.textContent = 1;

  const modal = $('product-modal');
  if (modal) { modal.classList.add('on'); document.body.style.overflow = 'hidden'; }
}

function closeProductModal() {
  const modal = $('product-modal');
  if (modal) modal.classList.remove('on');
  document.body.style.overflow = '';
  currentProduct = null;
}

function addFromModal() {
  if (!currentProduct) return;
  const qty = _pmQty || 1;
  for (let i = 0; i < qty; i++) addCart(currentProduct.name, i === 0 ? $('pm-add-btn') : null);
  closeProductModal();
}

const productModal = $('product-modal');
if (productModal) {
  productModal.addEventListener('click', e => {
    if (e.target === productModal) closeProductModal();
  });
}

/* ══════════════════════════════════════════════════════════════
   PANIER
══════════════════════════════════════════════════════════════ */
function addCart(name, btnEl) {
  const p = getProductByName(name);
  if (!p || p.price === 0) return;
  const ex = cart.find(x => x.name === name);
  if (ex) ex.qty++;
  else cart.push({ ...p, qty: 1 });
  save(); renderCart(); updateBadge();
  showToast(`<strong>${esc(name)}</strong> ajouté au panier`);
  updateCardQtyDisplays();
  if (btnEl) {
    // On ne change plus le texte : le bouton reste uniquement une flèche.
    // Feedback via toast + micro-animation.
    if (btnEl._tnTimers) {
      clearTimeout(btnEl._tnTimers.t1);
      clearTimeout(btnEl._tnTimers.t2);
    }
    btnEl._tnTimers = {};

    btnEl.disabled = true;
    btnEl.classList.remove('tn-btn-adding', 'tn-btn-added');
    btnEl.classList.add('tn-btn-adding');

    btnEl._tnTimers.t1 = setTimeout(() => {
      btnEl.classList.remove('tn-btn-adding');
      btnEl.classList.add('tn-btn-added');
    }, 220);

    btnEl._tnTimers.t2 = setTimeout(() => {
      btnEl.classList.remove('tn-btn-added');
      btnEl.disabled = false;
    }, 950);
  }
}

function renderCart() {
  const body = $('cart-body');
  if (!body) return;
  const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = sub + (cart.length > 0 ? DELIVERY : 0);

  if (!cart.length) {
    body.innerHTML = `<div class="cart-empty"><p>Votre panier est vide</p></div>`;
  } else {
    body.innerHTML = '';
    cart.forEach((item, i) => {
      const d = document.createElement('div');
      d.className = 'cart-item';
      d.innerHTML = `
        <img src="${esc(item.img || item.image || '')}" alt="${esc(item.name)}" loading="lazy"
             onerror="this.style.opacity='0'">
        <div style="flex:1">
          <div class="ci-name">${esc(item.name)}</div>
          <div class="ci-price">${fmt(item.price)} / unité</div>
          <div class="ci-qty">
            <button class="qty-btn" onclick="qtyChange(${i},-1)" aria-label="Diminuer quantité">−</button>
            <span class="qty-n" aria-live="polite">${item.qty}</span>
            <button class="qty-btn" onclick="qtyChange(${i},1)"  aria-label="Augmenter quantité">+</button>
          </div>
        </div>`;
      body.appendChild(d);
    });
  }

  const cs = $('cart-subtotal'); if (cs) cs.textContent = fmt(sub);
  const cd = $('cart-delivery'); if (cd) cd.textContent = cart.length > 0 ? fmt(DELIVERY) : '—';
  const ct = $('cart-total'); if (ct) ct.textContent = fmt(cart.length > 0 ? total : 0);
}

function qtyChange(i, d) {
  if (!cart[i]) return;
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  save(); renderCart(); updateBadge(); updateCardQtyDisplays();
}

function updateBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const el = $('cart-count');
  if (el) {
    el.textContent = total;
    total > 0 ? el.classList.add('on') : el.classList.remove('on');
  }
  const sub = $('cart-hdr-sub');
  if (sub) sub.textContent = total === 0 ? 'Vide' : `${total} article${total > 1 ? 's' : ''}`;
}

function setFloatingWidgetsHidden(hidden) {
  const widgetIds = ['tn-chat-btn', 'tn-chat-win', 'ow-btn', 'ow-panel'];
  widgetIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (hidden) {
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    } else {
      el.style.visibility = '';
      el.style.pointerEvents = '';
    }
  });
}

function toggleCart() {
  const drawer = $('cart-drawer');
  const overlay = $('overlay');
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('open');
  if (overlay) overlay.classList.toggle('on', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
  setFloatingWidgetsHidden(isOpen);
}

/* ══════════════════════════════════════════════════════════════
   CHECKOUT
══════════════════════════════════════════════════════════════ */
function openCheckout() {
  if (!cart.length) { showToast('Votre panier est vide', 'error'); return; }
  const summary = $('checkout-summary');
  if (summary) {
    const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = sub + DELIVERY;
    let html = cart.map(item =>
      `<div class="checkout-summary-item">
        <span>${esc(item.name)} ×${item.qty}</span>
        <span>${fmt(item.price * item.qty)}</span>
      </div>`).join('');
    html += `<div class="checkout-summary-item"><span>Livraison</span><span>${fmt(DELIVERY)}</span></div>`;
    html += `<div class="checkout-summary-total"><span>Total</span><span>${fmt(total)}</span></div>`;
    summary.innerHTML = html;
  }
  const modal = $('checkout-modal');
  if (modal) { modal.classList.add('on'); document.body.style.overflow = 'hidden'; }
  setTimeout(() => { const inp = $('order-name'); if (inp) inp.focus(); }, 100);
}

async function confirmOrder(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const name = $('order-name')?.value.trim() ?? '';
  const address = $('order-address')?.value.trim() ?? '';
  const phone = $('order-phone')?.value.trim() ?? '';
  const note = $('order-note')?.value.trim() ?? '';

  let valid = true;
  [$('order-name'), $('order-address'), $('order-phone')].forEach(el => {
    if (!el) return;
    el.classList.remove('error');
    if (!el.value.trim()) { el.classList.add('error'); valid = false; }
  });
  if (!valid) { showToast('Veuillez remplir tous les champs obligatoires', 'error'); return; }

  const submitBtn = $('checkout-submit-btn');
  const origText = submitBtn?.textContent ?? 'Commander';
  isSubmitting = true;
  if (submitBtn) { submitBtn.textContent = 'Enregistrement…'; submitBtn.disabled = true; }

  const cartData = cart.map(i => ({ name: i.name, price: i.price, qty: i.qty }));

  try {
    const response = await fetch(`${API_BASE}/submit_order.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        note,
        items: cartData,
        products: cartData,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Erreur serveur (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Erreur inconnue');

    if (typeof window.owRegisterOrder === 'function' && data.order_ref && data.cancel_token) {
      window.owRegisterOrder(data.order_ref, data.cancel_token, phone);
    }

    cart = [];
    save(); renderCart(); updateBadge();

    $('checkout-modal')?.classList.remove('on');
    $('cart-drawer')?.classList.remove('open');
    $('overlay')?.classList.remove('on');
    document.body.style.overflow = '';
    setFloatingWidgetsHidden(false);

    showOrderConfirmation(data);

  } catch (err) {
    console.error('[TISANATURE] Erreur commande :', err);
    showToast(`Erreur : ${err.message}`, 'error');
  } finally {
    isSubmitting = false;
    if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════════════════
   CONFIRMATION
══════════════════════════════════════════════════════════════ */
function showOrderConfirmation(data) {
  if (!$('tn-confirm-modal')) {
    const style = document.createElement('style');
    style.textContent = `
      #tn-confirm-modal{position:fixed;inset:0;z-index:9500;background:rgba(8,18,12,0.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s}
      #tn-confirm-modal.on{opacity:1;pointer-events:all}
      #tn-confirm-box{background:#112018;border:1px solid rgba(255,255,255,0.12);border-radius:20px;width:100%;max-width:400px;padding:36px 28px;box-shadow:0 24px 64px rgba(0,0,0,.65);transform:translateY(28px);transition:transform .28s cubic-bezier(.22,1,.36,1);text-align:center}
      #tn-confirm-modal.on #tn-confirm-box{transform:none}
      .tnc-icon{width:76px;height:76px;border-radius:50%;margin:0 auto 18px;background:rgba(58,125,92,0.15);border:2px solid rgba(107,184,146,0.35);display:flex;align-items:center;justify-content:center;animation:tnc-pop .4s cubic-bezier(.34,1.56,.64,1) .1s both}
      @keyframes tnc-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
      .tnc-title{font-family:'Playfair Display',serif;font-size:1.35rem;color:#EDE8DC;margin-bottom:8px}
      .tnc-sub{font-size:.8rem;color:#9E9A91;margin-bottom:22px;line-height:1.65}
      .tnc-ref-box{background:rgba(58,125,92,0.1);border:1px solid rgba(107,184,122,.22);border-radius:10px;padding:14px 18px;margin-bottom:16px}
      .tnc-ref-label{font-size:.62rem;color:#636059;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
      .tnc-ref-val{font-family:'DM Mono',monospace;font-size:1.15rem;color:#6BB892;font-weight:700;letter-spacing:.05em}
      .tnc-total{font-size:.78rem;color:#9E9A91;margin-top:5px}
      .tnc-invoice-note{font-size:.72rem;color:rgba(107,184,146,0.65);margin-bottom:20px;padding:10px 14px;background:rgba(58,125,92,0.06);border:1px solid rgba(107,184,122,.12);border-radius:8px;line-height:1.65}
      .tnc-btns{display:flex;flex-direction:column;gap:9px}
      .tnc-btn-ghost{padding:11px 20px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;background:transparent;color:#9E9A91;font-family:'Karla',sans-serif;font-size:.82rem;transition:all .15s}
      .tnc-btn-ghost:hover{border-color:rgba(255,255,255,0.22);color:#DDD9CE}
    `;
    document.head.appendChild(style);
    const modal = document.createElement('div');
    modal.id = 'tn-confirm-modal';
    modal.innerHTML = `<div id="tn-confirm-box">
      <div class="tnc-icon">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3DD68C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="tnc-title">Commande confirmée !</div>
      <div class="tnc-sub">Votre commande a été enregistrée avec succès.<br>Nous vous contacterons sous peu pour la livraison.</div>
      <div class="tnc-ref-box">
        <div class="tnc-ref-label">Numéro de commande</div>
        <div class="tnc-ref-val" id="tnc-ref">—</div>
        <div class="tnc-total" id="tnc-total"></div>
      </div>
      <div class="tnc-invoice-note">
        🧾 Votre facture sera disponible dans votre <strong>espace client</strong> une fois la commande livrée.
      </div>
      <div class="tnc-btns">
        <button class="tnc-btn-ghost" onclick="document.getElementById('tn-confirm-modal').classList.remove('on');document.body.style.overflow=''">Fermer</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.classList.remove('on'); document.body.style.overflow = ''; }
    });
  }

  $('tnc-ref').textContent = data.order_ref || '—';
  $('tnc-total').textContent = data.total ? `Total : ${Number(data.total).toLocaleString('fr-FR')} FCFA` : '';
  $('tn-confirm-modal').classList.add('on');
  document.body.style.overflow = 'hidden';
}

/* ══════════════════════════════════════════════════════════════
   KEYBOARD & ACCESSIBILITY
══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeProductModal();
  const cm = $('checkout-modal'); if (cm?.classList.contains('on')) { cm.classList.remove('on'); document.body.style.overflow = ''; }
  const cfm = $('tn-confirm-modal'); if (cfm?.classList.contains('on')) { cfm.classList.remove('on'); document.body.style.overflow = ''; }
  const cd = $('cart-drawer'); if (cd?.classList.contains('open')) toggleCart();
});

const checkoutModal = $('checkout-modal');
if (checkoutModal) {
  checkoutModal.addEventListener('click', e => {
    if (e.target === checkoutModal) { checkoutModal.classList.remove('on'); document.body.style.overflow = ''; }
  });
}

/* ══════════════════════════════════════════════════════════════
   REVEAL ON SCROLL
══════════════════════════════════════════════════════════════ */
let revealObserver;
function initReveal() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('in'), i * 65);
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }
  document.querySelectorAll('.reveal:not(.in), .reveal-left:not(.in)').forEach(el => revealObserver.observe(el));
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
loadProducts();