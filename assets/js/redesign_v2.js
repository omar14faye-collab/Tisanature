/* ══════════════════════════════════════════════════════════════
   TISANATURE — redesign_v2.js  (v8)
   v8 : filtres cosmétiques gérés inline dans cosmetiques.html
══════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────
   PARTIE 2 — Carrousel tisanes + Panel palette
──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SITE_BASE = typeof window.__TN_SITE_BASE__ === 'string' ? window.__TN_SITE_BASE__ : '';

  /* ── Données palette ────────────────────────────────────
     Adapter img selon les fichiers disponibles dans /images/
  ── */
  const TISA_PALETTE = [
    { id: 1, name: 'Tisane Détox Verte', fam: 'detox', note: "Draine, purifie et revitalise l'organisme", price: 6500, img: 'images/hero-product.jpg', isNew: false },
    { id: 2, name: 'Énergie & Vitalité', fam: 'energie', note: 'Boost naturel durable sans caféine ajoutée', price: 6800, img: 'images/feuille1.png', isNew: true },
    { id: 3, name: 'Sommeil Doux', fam: 'sommeil', note: 'Favorise un endormissement naturel & réparateur', price: 7000, img: 'images/labo.png', isNew: false },
    { id: 4, name: 'Beauté Peau Lumière', fam: 'beaute', note: "Antioxydants & éclat de la peau de l'intérieur", price: 7500, img: 'images/hero-product.jpg', isNew: true },
    { id: 5, name: 'Confort Digestif', fam: 'digestion', note: 'Apaise après les repas, réduit les ballonnements', price: 6200, img: 'images/feuille1.png', isNew: false },
    { id: 6, name: 'Bouclier Immunité', fam: 'immunite', note: 'Renforce les défenses naturelles au quotidien', price: 7200, img: 'images/labo.png', isNew: true },
    { id: 7, name: 'Détox Minceur', fam: 'detox', note: 'Légèreté, drainage & silhouette affinée', price: 6500, img: 'images/hero-product.jpg', isNew: false },
    { id: 8, name: 'Matin Tonique', fam: 'energie', note: 'Réveil en douceur, concentration & tonus', price: 6800, img: 'images/feuille1.png', isNew: false },
    { id: 9, name: 'Nuit Profonde', fam: 'sommeil', note: 'Relaxation intense & récupération musculaire', price: 7400, img: 'images/labo.png', isNew: false },
    { id: 10, name: 'Rose & Collagène', fam: 'beaute', note: 'Teint unifié, fermeté & hydratation profonde', price: 7500, img: 'images/hero-product.jpg', isNew: false },
    { id: 11, name: 'Ventre Plat', fam: 'digestion', note: 'Transit fluide & confort intestinal durable', price: 6400, img: 'images/feuille1.png', isNew: true },
    { id: 12, name: 'Propolis & Gingembre', fam: 'immunite', note: 'Alliance puissante contre les infections saisonnières', price: 7800, img: 'images/labo.png', isNew: false },
  ];
  window.TISA_PALETTE = TISA_PALETTE;

  const FAM_BG = {
    detox: 'linear-gradient(140deg,#e4f2ea,#cce7d8)',
    energie: 'linear-gradient(140deg,#fff8e6,#faebc8)',
    sommeil: 'linear-gradient(140deg,#eceef8,#d8daf2)',
    beaute: 'linear-gradient(140deg,#fdf0f4,#f5dce8)',
    digestion: 'linear-gradient(140deg,#ebf5eb,#d4ebd6)',
    immunite: 'linear-gradient(140deg,#fff4ec,#fae2d0)',
  };

  const fmt = n => Number(n).toLocaleString('fr-FR') + ' FCFA';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ── Carrousel ── */
  function buildCarousel() {
    const track = document.getElementById('tisa-track');
    if (!track) return;
    /* Dupliquer pour boucle infinie CSS */
    [...TISA_PALETTE, ...TISA_PALETTE].forEach(p => {
      const c = document.createElement('div');
      c.className = 'tisa-card';
      c.title = 'Voir la gamme ' + p.fam;
      c.onclick = () => openTisaPanel(p.fam);
      c.innerHTML = `
        <div class="tisa-card-img" style="background:${FAM_BG[p.fam]}">
          <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='0'">
          <span class="tisa-card-badge">${cap(p.fam)}</span>
          ${p.isNew ? '<span class="tisa-card-new">Nouveau</span>' : ''}
        </div>
        <div class="tisa-card-body">
          <div class="tisa-card-name">${p.name}</div>
          <div class="tisa-card-note">${p.note}</div>
          <div class="tisa-card-price">${fmt(p.price)}</div>
        </div>`;
      track.appendChild(c);
    });
  }

  /* ── Grille palette dans le panel ── */
  function buildPalette(fam) {
    const grid = document.getElementById('tisa-palette-grid');
    if (!grid) return;
    const list = fam === 'all' ? TISA_PALETTE : TISA_PALETTE.filter(p => p.fam === fam);
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;font-family:Karla,sans-serif;font-size:.78rem;color:rgba(24,24,27,.28);padding:3rem 0">Aucun produit dans cette catégorie.</p>';
      return;
    }
    list.forEach(p => {
      const c = document.createElement('div');
      c.className = 'tisa-palette-card';
      c.setAttribute('data-fam', p.fam);
      c.innerHTML = `
        <div class="tisa-palette-img">
          <div class="tisa-palette-header">
            ${p.isNew ? '<span class="tisa-palette-new-badge">NOUVEAUTÉ</span>' : ''}
          </div>
          <div class="tisa-palette-img-wrap">
            <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='0'">
          </div>
        </div>
        <div class="tisa-palette-body">
          <div class="tisa-palette-name">${p.name}</div>
          <div class="tisa-palette-price">${fmt(p.price)}</div>
          <div class="tisa-palette-foot">
             <div class="pcard-qty-wrap">
              <button class="pcard-qty-btn" onclick="event.stopPropagation(); if(typeof cardQty==='function') cardQty(event,'${p.name.replace(/'/g, "\\'")}',-1)">&#x2212;</button>
              <span class="pcard-qty-n" data-qty="${p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}">0</span>
              <button class="pcard-qty-btn" onclick="event.stopPropagation(); if(typeof cardQty==='function') cardQty(event,'${p.name.replace(/'/g, "\\'")}',1)">+</button>
            </div>
            <button class="tisa-palette-btn" title="Ajouter au panier">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>`;
      c.querySelector('.tisa-palette-btn').addEventListener('click', e => {
        e.stopPropagation();
        addPaletteItem(p);
      });
      grid.appendChild(c);
    });
  }

  /* ── Ajouter au panier ── */
  function addPaletteItem(p) {
    if (typeof addCart === 'function') {
      addCart(p.name, null);
    } else if (typeof addToCart === 'function') {
      addToCart({ id: 'pal_' + p.id, name: p.name, price: p.price, image: p.img, category: 'epicerie' });
    } else {
      showToast('\u2713 ' + p.name + ' ajouté au panier');
    }
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.cssText = 'opacity:1;transform:translateY(0)';
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  }

  /* ── Ouvrir / fermer le panel ── */
  function openTisaPanel(fam) {
    const f = fam || 'all';
    buildPalette(f);
    document.querySelectorAll('.tisa-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.fam === f);
    });
    const panel = document.getElementById('tisa-panel');
    if (!panel) return;
    panel.classList.add('on');
    document.body.style.overflow = 'hidden';
  }

  function closeTisaPanel() {
    const panel = document.getElementById('tisa-panel');
    if (!panel) return;
    panel.classList.remove('on');
    document.body.style.overflow = '';
  }

  function filterPalette(btn) {
    document.querySelectorAll('.tisa-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildPalette(btn.dataset.fam);
  }

  /* ── Grille Tisanes (Dynamique - 4 max) ── */
  async function buildTisaneGrid() {
    const grid = document.getElementById('tisane-grid');
    if (!grid) return;

    try {
      const res = await fetch(SITE_BASE + '/api/products.php?action=public');
      const data = await res.json();

      if (!data.success) {
        grid.innerHTML = '<p style="padding:2rem;text-align:center;grid-column:1/-1;">Impossible de charger les tisanes.</p>';
        return;
      }

      const tisanes = data.products.filter(p => p.category === 'tisanes').slice(0, 4);

      if (!tisanes.length) {
        grid.innerHTML = '<p style="padding:2rem;text-align:center;grid-column:1/-1;">Aucune tisane disponible pour le moment.</p>';
        return;
      }

      const tcount = document.getElementById('tisanes-count');
      if (tcount) tcount.textContent = `${tisanes.length} produit${tisanes.length > 1 ? 's' : ''}`;

      grid.innerHTML = '';

      tisanes.forEach((p) => {
        const d = document.createElement('div');
        d.className = 'pcard reveal';
        d.innerHTML = `
          <div class="pcard-img-section">
            <div class="pcard-badges">
              ${p.is_new ? '<span class="pcard-new-badge">NOUVEAUTÉ</span>' : ''}
            </div>
            <div class="pcard-img-container">
              <img src="${SITE_BASE}/${p.image}" alt="${p.name.replace(/"/g, '&quot;')}" loading="lazy"
                   onload="this.parentElement.classList.add('loaded')"
                   onerror="this.parentElement.classList.add('loaded');this.style.opacity='0'">
            </div>
          </div>
          <div class="pcard-body">
            <div class="pcard-name">${p.name}</div>
            <div class="pcard-price">${Number(p.price || 0).toLocaleString('fr-FR')} FCFA</div>
            <div class="pcard-controls">
              <div class="pcard-qty-wrap">
                <button class="pcard-qty-btn" onclick="if(typeof cardQty==='function') cardQty(event,'${p.name.replace(/'/g, "\\'")}',-1)">&#x2212;</button>
                <span class="pcard-qty-n" data-qty="${p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}">0</span>
                <button class="pcard-qty-btn" onclick="if(typeof cardQty==='function') cardQty(event,'${p.name.replace(/'/g, "\\'")}',1)">+</button>
              </div>
              <button class="pcard-add" data-name="${p.name.replace(/"/g, '&quot;')}"
                      onclick="if(typeof openProductModal==='function') openProductModal(this.dataset.name)">&rarr;</button>
            </div>
          </div>
        `;
        grid.appendChild(d);
      });

      if (typeof initReveal === 'function') setTimeout(initReveal, 100);
      if (typeof updateCardQtyDisplays === 'function') updateCardQtyDisplays();

    } catch (err) {
      console.error('Erreur chargement Tisane Grid', err);
      grid.innerHTML = '<p style="padding:2rem;text-align:center;grid-column:1/-1;">Erreur de connexion.</p>';
    }
  }


  /* Exposer globalement (appelé depuis onclick dans le HTML) */
  window.openTisaPanel = openTisaPanel;
  window.closeTisaPanel = closeTisaPanel;
  window.filterPalette = filterPalette;

  /* Escape pour fermer */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTisaPanel(); });

  /* Init */
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => { buildCarousel(); buildTisaneGrid(); buildPalette('all'); });
  else {
    buildCarousel();
    buildTisaneGrid();
    buildPalette('all');
  }

})();

/* ────────────────────────────────────────────────────────────
   PARTIE 3 — Contrôles du Carrousel Élégant Tisane
──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('tisane-elegant-carousel');
  const prevBtn = document.getElementById('ec-prev');
  const nextBtn = document.getElementById('ec-next');

  if (track && prevBtn && nextBtn) {
    // La distance de défilement (correspond environ à une carte + l'écartement)
    // Recalculé au moment du clic pour s'adapter au responsive

    prevBtn.addEventListener('click', () => {
      const scrollAmount = track.querySelector('.elegant-slide').offsetWidth + 24;
      track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      const scrollAmount = track.querySelector('.elegant-slide').offsetWidth + 24;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
  }
});