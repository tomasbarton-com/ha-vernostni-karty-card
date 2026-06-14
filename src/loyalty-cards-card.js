// loyalty-cards-card.js — Lovelace card for ha-vernostni-karty integration
// All store/category data comes from the integration via WebSocket.

const BARCODE_TYPES = [
  'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E',
  'CODE_128', 'CODE_39', 'ITF',
  'QR_CODE', 'DATA_MATRIX', 'PDF_417', 'AZTEC',
];

const JSBARCODE_FORMAT = {
  EAN_13: 'EAN13', EAN_8: 'EAN8', UPC_A: 'UPC', UPC_E: 'UPCE',
  CODE_128: 'CODE128', CODE_39: 'CODE39', ITF: 'ITF14',
};

const DEFAULT_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c62828', '#00838f', '#37474f', '#5d4037',
];

const FALLBACK_CATEGORY_LABELS = {
  groceries: 'Potraviny', drugstore: 'Drogerie', pharmacy: 'Lékárna',
  diy: 'Hobby & Nástroje', electronics: 'Elektronika', sport: 'Sport',
  fashion: 'Móda', fastfood: 'Fastfood', toys: 'Hračkářství', other: 'Ostatní',
};

// ── Script loader ─────────────────────────────────────────────────────────────

const _scriptCache = {};
function loadScript(src) {
  if (!_scriptCache[src]) {
    _scriptCache[src] = new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  return _scriptCache[src];
}

function loadJsBarcode() {
  return loadScript('https://unpkg.com/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
}
function loadQrCode() {
  return loadScript('https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js');
}
function loadScanner() {
  return loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = /* css */`
:host { display: block; }

.card-root {
  background: var(--ha-card-background, var(--card-background-color, #fff));
  border-radius: var(--ha-card-border-radius, 12px);
  box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.1));
  overflow: hidden;
  font-family: var(--primary-font-family, Roboto, sans-serif);
  position: relative;
}

/* ── Header ── */
.header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
}
.header-title { flex: 1; font-size: 18px; font-weight: 500; color: var(--primary-text-color, #212121); }
.header-actions { display: flex; gap: 4px; }

/* ── Buttons ── */
.btn-icon {
  width: 36px; height: 36px; border-radius: 50%;
  background: none; border: none; cursor: pointer;
  color: var(--secondary-text-color, #757575);
  display: flex; align-items: center; justify-content: center;
  transition: background .1s;
}
.btn-icon:hover { background: var(--secondary-background-color, #f5f5f5); }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
  font-size: 14px; font-weight: 500; transition: filter .1s;
}
.btn:hover { filter: brightness(.92); }
.btn-primary { background: var(--primary-color, #1976d2); color: #fff; }
.btn-secondary { background: var(--secondary-background-color, #f0f0f0); color: var(--primary-text-color, #212121); }
.btn-danger { background: #e53935; color: #fff; }

/* ── Store grid ── */
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px; padding: 16px;
}
.store-tile {
  border-radius: 12px; padding: 14px 10px;
  cursor: pointer; display: flex; flex-direction: column;
  align-items: center; gap: 8px; color: #fff;
  transition: transform .15s, box-shadow .15s;
  min-height: 105px; position: relative;
}
.store-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.2); }
.tile-logo {
  width: 48px; height: 48px; border-radius: 8px; object-fit: contain;
  background: rgba(255,255,255,.15);
}
.tile-initials {
  width: 48px; height: 48px; border-radius: 8px;
  background: rgba(255,255,255,.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700;
}
.tile-name { font-size: 13px; font-weight: 500; text-align: center; word-break: break-word; }
.tile-count { font-size: 11px; opacity: .75; }

/* ── Card list ── */
.card-list { padding: 4px 0; }
.card-item {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px; cursor: pointer;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
  transition: background .1s;
}
.card-item:last-child { border-bottom: none; }
.card-item:hover { background: var(--secondary-background-color, #f5f5f5); }
.card-item-icon {
  width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0;
  background: var(--primary-color, #1976d2);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 18px;
}
.card-item-info { flex: 1; overflow: hidden; }
.card-item-name { font-size: 15px; font-weight: 500; color: var(--primary-text-color, #212121); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-item-sub { font-size: 12px; color: var(--secondary-text-color, #757575); font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-item-arrow { color: var(--secondary-text-color, #bdbdbd); flex-shrink: 0; }

/* ── Card detail ── */
.card-detail { padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.barcode-container {
  background: #fff; border-radius: 10px; padding: 16px;
  width: 100%; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  min-height: 120px; box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.barcode-container canvas, .barcode-container svg { max-width: 100%; }
.barcode-value { font-family: monospace; font-size: 15px; color: var(--secondary-text-color, #757575); letter-spacing: .05em; }
.card-notes {
  width: 100%; font-size: 14px; color: var(--primary-text-color, #212121);
  background: var(--secondary-background-color, #f5f5f5);
  border-radius: 8px; padding: 12px; box-sizing: border-box;
}

/* ── FAB ── */
.fab {
  position: absolute; bottom: 16px; right: 16px;
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--primary-color, #1976d2); color: #fff;
  border: none; cursor: pointer; font-size: 26px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(0,0,0,.28);
  transition: transform .15s;
}
.fab:hover { transform: scale(1.07); }
.content-wrapper { position: relative; min-height: 80px; padding-bottom: 72px; }

/* ── Empty / loading ── */
.empty-state { text-align: center; padding: 40px 16px; color: var(--secondary-text-color, #9e9e9e); }
.empty-state .icon { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-state p { margin: 0 0 14px; font-size: 14px; }
.loading { display: flex; align-items: center; justify-content: center; padding: 40px; gap: 12px; color: var(--secondary-text-color, #9e9e9e); font-size: 14px; }
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { width: 22px; height: 22px; border: 3px solid var(--divider-color, #e0e0e0); border-top-color: var(--primary-color, #1976d2); border-radius: 50%; animation: spin .7s linear infinite; }

/* ── Error ── */
.error-banner { background: #ffebee; color: #b71c1c; padding: 12px 16px; font-size: 13px; margin: 12px; border-radius: 8px; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.45);
  display: flex; align-items: flex-end; justify-content: center;
  animation: fadeIn .15s;
}
@keyframes fadeIn { from { opacity: 0; } }
.modal-sheet {
  background: var(--ha-card-background, #fff);
  border-radius: 18px 18px 0 0; width: 100%; max-width: 500px;
  max-height: 88vh; overflow-y: auto;
  box-shadow: 0 -4px 28px rgba(0,0,0,.18);
  animation: slideUp .2s;
}
@keyframes slideUp { from { transform: translateY(60px); opacity: 0; } }
.modal-header {
  display: flex; align-items: center; gap: 8px; padding: 16px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
  position: sticky; top: 0; background: var(--ha-card-background, #fff); z-index: 1;
}
.modal-title { flex: 1; font-size: 17px; font-weight: 500; }
.modal-body { padding: 16px; }
.modal-footer {
  display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px;
  border-top: 1px solid var(--divider-color, #e0e0e0);
  position: sticky; bottom: 0; background: var(--ha-card-background, #fff);
}

/* ── Form ── */
.form-field { margin-bottom: 16px; }
.form-label { display: block; font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #757575); margin-bottom: 5px; }
.form-input {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px;
  padding: 10px 12px; font-size: 14px;
  color: var(--primary-text-color, #212121);
  background: var(--secondary-background-color, #f9f9f9);
  transition: border-color .15s;
  font-family: inherit;
}
.form-input:focus { outline: none; border-color: var(--primary-color, #1976d2); background: #fff; }
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23757575' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center;
  padding-right: 32px; cursor: pointer;
}

/* ── Catalog picker ── */
.catalog-category { margin-bottom: 14px; }
.catalog-cat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--secondary-text-color, #9e9e9e); margin-bottom: 6px; }
.catalog-items { display: flex; flex-wrap: wrap; gap: 7px; }
.catalog-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid var(--divider-color, #e0e0e0);
  border-radius: 20px; cursor: pointer; font-size: 13px;
  transition: all .1s; user-select: none;
}
.catalog-chip:hover { border-color: var(--primary-color, #1976d2); color: var(--primary-color, #1976d2); }
.catalog-chip.selected { background: var(--primary-color, #1976d2); color: #fff; border-color: var(--primary-color, #1976d2); }
.catalog-chip img { width: 18px; height: 18px; border-radius: 3px; object-fit: contain; }

/* ── Color picker ── */
.color-row { display: flex; gap: 8px; flex-wrap: wrap; }
.color-swatch {
  width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: transform .1s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.selected { border-color: var(--primary-text-color, #212121); transform: scale(1.15); }

/* ── Logo section ── */
.logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.logo-preview { width: 60px; height: 60px; border-radius: 10px; object-fit: contain; border: 1px solid var(--divider-color, #e0e0e0); }
.logo-initials-preview {
  width: 60px; height: 60px; border-radius: 10px;
  background: var(--primary-color, #1976d2);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 700; color: #fff;
}

/* ── Locations ── */
.location-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--divider-color, #e0e0e0); }
.location-info { flex: 1; font-size: 13px; }
.location-label { font-weight: 500; margin-bottom: 2px; }
.location-coords { font-family: monospace; font-size: 11px; color: var(--secondary-text-color, #9e9e9e); }
.input-row { display: flex; gap: 8px; }
.input-row .form-input { flex: 1; }

/* ── Scanner ── */
.scanner-wrap { margin-top: 8px; border-radius: 8px; overflow: hidden; background: #000; aspect-ratio: 1; }
`;

// ── Card class ────────────────────────────────────────────────────────────────

class LoyaltyCardsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._catalog = null; // { stores, category_labels }
    this._data = null;    // { stores, settings }
    this._config = {};
    this._view = { type: 'list' }; // list | store | card
    this._modal = null;
    this._modalData = {};
    this._unsub = null;
    this._initialized = false;
    this._error = null;
    this._scanner = null;
    this._scannerEl = null; // light-DOM element for scanner
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && !this._initialized) {
      this._initialized = true;
      this._init();
    }
  }

  // ── Init ──

  async _init() {
    this._renderLoading();
    try {
      await Promise.all([this._loadCatalog(), this._loadData()]);
      this._subscribeEvents();
    } catch (e) {
      this._error = e.message || 'Nelze se připojit k integraci loyalty_cards.';
    }
    this._render();
  }

  async _loadCatalog() {
    try {
      this._catalog = await this._hass.callWS({ type: 'loyalty_cards/get_catalog' });
    } catch (e) {
      console.warn('[loyalty-cards-card] get_catalog failed, using empty catalog', e);
      this._catalog = { stores: [], category_labels: {} };
    }
  }

  async _loadData() {
    this._data = await this._hass.callWS({ type: 'loyalty_cards/get_data' });
  }

  _subscribeEvents() {
    this._unsub = this._hass.connection.subscribeEvents(async () => {
      try { await this._loadData(); } catch {}
      this._render();
    }, 'loyalty_cards_updated');
  }

  disconnectedCallback() {
    if (this._unsub) { this._unsub.then(fn => fn()).catch(() => {}); this._unsub = null; }
    this._destroyScanner();
  }

  // ── Services ──

  _callService(service, data) {
    return this._hass.callService('loyalty_cards', service, data);
  }

  // ── Rendering ──

  _renderLoading() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="card-root"><div class="loading"><div class="spinner"></div>Načítám…</div></div>`;
  }

  _render() {
    this._destroyScanner();
    const modal = this._modal;
    const modalData = { ...this._modalData };
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="card-root">${this._buildView()}</div>`;
    this._bindRootEvents();
    if (this._view.type === 'card') this._renderBarcode();
    if (modal) {
      this._modal = modal;
      this._modalData = modalData;
      this._mountModal();
    }
  }

  _buildView() {
    if (this._error) return `<div class="error-banner">⚠️ ${this._error}</div>`;
    if (this._view.type === 'list') return this._buildList();
    if (this._view.type === 'store') return this._buildStoreDetail();
    if (this._view.type === 'card') return this._buildCardDetail();
    return '';
  }

  // ── List view ──

  _buildList() {
    const stores = this._data?.stores || [];
    const inner = stores.length === 0
      ? `<div class="empty-state"><span class="icon">🏪</span><p>Zatím žádné obchody.<br>Přidej první věrnostní kartu.</p></div>`
      : `<div class="store-grid">${stores.map(s => this._buildTile(s)).join('')}</div>`;

    return `
      <div class="header">
        <span class="header-title">Věrnostní karty</span>
        <div class="header-actions">
          <button class="btn-icon" data-action="open-settings" title="Nastavení">${ICON.settings}</button>
        </div>
      </div>
      <div class="content-wrapper">
        ${inner}
        <button class="fab" data-action="open-add-store" title="Přidat obchod">＋</button>
      </div>`;
  }

  _buildTile(store) {
    const count = (store.cards || []).length;
    const color = store.tile_color || '#1976d2';
    const plural = count === 1 ? 'karta' : count < 5 ? 'karty' : 'karet';
    const logo = store.logo_url
      ? `<img class="tile-logo" src="${store.logo_url}" alt="${esc(store.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const initials = `<div class="tile-initials" style="${store.logo_url ? 'display:none' : ''}">${store.name[0].toUpperCase()}</div>`;
    return `<div class="store-tile" data-action="open-store" data-id="${store.id}" style="background:${color}">
      ${logo}${initials}
      <span class="tile-name">${esc(store.name)}</span>
      <span class="tile-count">${count} ${plural}</span>
    </div>`;
  }

  // ── Store detail ──

  _buildStoreDetail() {
    const store = this._findStore(this._view.storeId);
    if (!store) return this._buildList();
    const cards = store.cards || [];
    const inner = cards.length === 0
      ? `<div class="empty-state"><span class="icon">💳</span><p>Žádné karty.<br>Přidej první kartu.</p></div>`
      : `<div class="card-list">${cards.map(c => this._buildCardItem(c)).join('')}</div>`;

    return `
      <div class="header">
        <button class="btn-icon" data-action="back">${ICON.back}</button>
        <span class="header-title">${esc(store.name)}</span>
        <div class="header-actions">
          <button class="btn-icon" data-action="open-locations" title="Lokace">${ICON.location}</button>
          <button class="btn-icon" data-action="open-edit-store" title="Upravit">${ICON.edit}</button>
        </div>
      </div>
      <div class="content-wrapper">
        ${inner}
        <button class="fab" data-action="open-add-card" title="Přidat kartu">＋</button>
      </div>`;
  }

  _buildCardItem(card) {
    return `<div class="card-item" data-action="open-card" data-id="${card.id}">
      <div class="card-item-icon">${card.name[0].toUpperCase()}</div>
      <div class="card-item-info">
        <div class="card-item-name">${esc(card.name)}</div>
        <div class="card-item-sub">${card.barcode_type || ''} · ${card.barcode}</div>
      </div>
      <span class="card-item-arrow">${ICON.chevron}</span>
    </div>`;
  }

  // ── Card detail ──

  _buildCardDetail() {
    const { card } = this._findStoreAndCard();
    if (!card) return this._buildStoreDetail();
    return `
      <div class="header">
        <button class="btn-icon" data-action="back">${ICON.back}</button>
        <span class="header-title">${esc(card.name)}</span>
        <div class="header-actions">
          <button class="btn-icon" data-action="open-edit-card" title="Upravit">${ICON.edit}</button>
        </div>
      </div>
      <div class="card-detail">
        <div class="barcode-container" id="barcode-container"><div class="spinner"></div></div>
        <div class="barcode-value">${card.barcode}</div>
        ${card.notes ? `<div class="card-notes">${esc(card.notes)}</div>` : ''}
      </div>`;
  }

  // ── Barcode rendering ──

  async _renderBarcode() {
    const { card } = this._findStoreAndCard();
    if (!card) return;
    const container = this.shadowRoot.getElementById('barcode-container');
    if (!container) return;
    container.innerHTML = '';

    const { barcode, barcode_type } = card;
    const fmt = barcode_type || 'CODE_128';

    try {
      if (JSBARCODE_FORMAT[fmt]) {
        await loadJsBarcode();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        container.appendChild(svg);
        // eslint-disable-next-line no-undef
        JsBarcode(svg, barcode, { format: JSBARCODE_FORMAT[fmt], displayValue: false, width: 2, height: 80, margin: 8 });
      } else if (fmt === 'QR_CODE') {
        await loadQrCode();
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        // eslint-disable-next-line no-undef
        await QRCode.toCanvas(canvas, barcode, { width: 220, margin: 2 });
      } else {
        // DATA_MATRIX, PDF_417, AZTEC — fallback to QR representation
        await loadQrCode();
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        const note = document.createElement('div');
        note.style.cssText = 'font-size:11px;color:#9e9e9e;margin-top:6px;text-align:center';
        note.textContent = `Zobrazeno jako QR (formát: ${fmt})`;
        container.appendChild(note);
        // eslint-disable-next-line no-undef
        await QRCode.toCanvas(canvas, barcode, { width: 200, margin: 2 });
      }
    } catch (e) {
      container.innerHTML = `<div style="color:#c62828;font-size:13px;text-align:center">Nelze vykreslit čárový kód:<br>${e.message}</div>`;
    }
  }

  // ── Events ──

  _bindRootEvents() {
    this.shadowRoot.querySelector('.card-root')?.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      this._handleAction(el.dataset.action, el);
    });
  }

  _handleAction(action, el) {
    switch (action) {
      case 'open-store':
        this._view = { type: 'store', storeId: el.dataset.id };
        return this._render();
      case 'open-card':
        this._view = { ...this._view, type: 'card', cardId: el.dataset.id };
        return this._render();
      case 'back':
        if (this._view.type === 'card') this._view = { type: 'store', storeId: this._view.storeId };
        else this._view = { type: 'list' };
        return this._render();
      case 'open-add-store':
        this._modalData = { color: DEFAULT_COLORS[0] };
        return this._openModal('add-store');
      case 'open-edit-store':
        return this._openModal('edit-store');
      case 'open-add-card':
        return this._openModal('add-card');
      case 'open-edit-card':
        return this._openModal('edit-card');
      case 'open-locations':
        return this._openModal('locations');
      case 'open-settings':
        return this._openModal('settings');
    }
  }

  // ── Modal ──

  _openModal(name) {
    this._modal = name;
    this._mountModal();
  }

  _mountModal() {
    const existing = this.shadowRoot.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = this._buildModal(this._modal);
    this.shadowRoot.querySelector('.card-root').appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeModal(); });
    this._bindModalEvents(overlay);
    setTimeout(() => overlay.querySelector('input, select, textarea')?.focus(), 60);
  }

  _closeModal() {
    this._modal = null;
    this._modalData = {};
    this._destroyScanner();
    this.shadowRoot.querySelector('.modal-overlay')?.remove();
  }

  _buildModal(name) {
    if (name === 'add-store')  return this._modalAddStore();
    if (name === 'edit-store') return this._modalEditStore();
    if (name === 'add-card')   return this._modalAddCard();
    if (name === 'edit-card')  return this._modalEditCard();
    if (name === 'logo')       return this._modalLogo();
    if (name === 'locations')  return this._modalLocations();
    if (name === 'settings')   return this._modalSettings();
    return '';
  }

  _bindModalEvents(overlay) {
    // Action buttons
    overlay.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el || el.classList.contains('catalog-chip')) return;
      this._handleModalAction(el.dataset.action, el, overlay);
    });

    // Catalog chip selection
    overlay.querySelectorAll('.catalog-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.catalog-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const nameInput = overlay.querySelector('#store-name');
        const catSelect = overlay.querySelector('#store-category');
        if (nameInput) nameInput.value = chip.dataset.name || '';
        if (catSelect) catSelect.value = chip.dataset.category || 'other';
        this._modalData.storeKey = chip.dataset.key || null;
        this._modalData.color = this._modalData.color || DEFAULT_COLORS[0];
      });
    });

    // Color swatches
    overlay.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        overlay.querySelector('#store-color-value').value = sw.dataset.color;
      });
    });

    // Catalog search
    overlay.querySelector('#catalog-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      overlay.querySelectorAll('.catalog-chip').forEach(chip => {
        chip.style.display = chip.dataset.name?.toLowerCase().includes(q) ? '' : 'none';
      });
      overlay.querySelectorAll('.catalog-category').forEach(cat => {
        const anyVisible = [...cat.querySelectorAll('.catalog-chip')].some(c => c.style.display !== 'none');
        cat.style.display = anyVisible ? '' : 'none';
      });
    });

    // Logo file preview
    overlay.querySelector('#logo-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = overlay.querySelector('#logo-preview');
        if (img?.tagName === 'IMG') img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async _handleModalAction(action, el, overlay) {
    switch (action) {
      case 'close-modal': return this._closeModal();
      case 'open-logo-modal': this._modal = 'logo'; return this._mountModal();
      case 'save-add-store':   return this._doAddStore(overlay);
      case 'save-edit-store':  return this._doEditStore(overlay);
      case 'delete-store':     return this._doDeleteStore();
      case 'save-add-card':    return this._doAddCard(overlay);
      case 'save-edit-card':   return this._doEditCard(overlay);
      case 'delete-card':      return this._doDeleteCard();
      case 'download-logo':    return this._doDownloadLogo(overlay);
      case 'upload-logo':      return this._doUploadLogo(overlay);
      case 'delete-logo':      return this._doDeleteLogo();
      case 'add-location':     return this._doAddLocation(overlay);
      case 'delete-location':  return this._doDeleteLocation(parseInt(el.dataset.idx), overlay);
      case 'save-settings':    return this._doSaveSettings(overlay);
      case 'start-scan':       return this._startScan(overlay);
      case 'stop-scan':        return this._stopScan(overlay);
    }
  }

  // ── Modal builders ──

  _modalAddStore() {
    const catalog = this._catalog || { stores: [], category_labels: {} };
    const labels = Object.keys(catalog.category_labels).length
      ? catalog.category_labels : FALLBACK_CATEGORY_LABELS;

    const byCategory = {};
    for (const s of catalog.stores) {
      if (!byCategory[s.category]) byCategory[s.category] = [];
      byCategory[s.category].push(s);
    }

    const catalogHTML = Object.entries(byCategory).map(([cat, stores]) => `
      <div class="catalog-category">
        <div class="catalog-cat-label">${labels[cat] || cat}</div>
        <div class="catalog-items">${stores.map(s => `
          <div class="catalog-chip" data-key="${s.key}" data-name="${esc(s.name)}" data-category="${s.category}">
            ${s.logo_url ? `<img src="${s.logo_url}" onerror="this.style.display='none'">` : ''}
            ${esc(s.name)}
          </div>`).join('')}
        </div>
      </div>`).join('');

    const curColor = this._modalData.color || DEFAULT_COLORS[0];

    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Přidat obchod</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        ${catalogHTML ? `
          <div class="form-field">
            <label class="form-label">Vybrat z katalogu</label>
            <input class="form-input" id="catalog-search" placeholder="Hledat obchod…" type="search" autocomplete="off">
          </div>
          ${catalogHTML}
          <hr style="margin:14px 0;border:none;border-top:1px solid var(--divider-color,#e0e0e0)">
        ` : ''}
        <div class="form-field">
          <label class="form-label">Název obchodu *</label>
          <input class="form-input" id="store-name" placeholder="Název">
        </div>
        <div class="form-field">
          <label class="form-label">Kategorie</label>
          <select class="form-input form-select" id="store-category">${this._catOptions('other')}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Barva dlaždice</label>
          <div class="color-row">${this._colorSwatches(curColor)}</div>
          <input type="hidden" id="store-color-value" value="${curColor}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" data-action="save-add-store">Přidat</button>
      </div>
    </div>`;
  }

  _modalEditStore() {
    const store = this._findStore(this._view.storeId);
    if (!store) return '';
    const curColor = store.tile_color || DEFAULT_COLORS[0];
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Upravit obchod</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="logo-row">
          ${store.logo_url
            ? `<img id="logo-preview" class="logo-preview" src="${store.logo_url}" alt="${esc(store.name)}">`
            : `<div id="logo-preview" class="logo-initials-preview">${store.name[0].toUpperCase()}</div>`}
          <button class="btn btn-secondary" data-action="open-logo-modal">Změnit logo</button>
        </div>
        <div class="form-field">
          <label class="form-label">Název *</label>
          <input class="form-input" id="store-name" value="${esc(store.name)}">
        </div>
        <div class="form-field">
          <label class="form-label">Kategorie</label>
          <select class="form-input form-select" id="store-category">${this._catOptions(store.category)}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Barva dlaždice</label>
          <div class="color-row">${this._colorSwatches(curColor)}</div>
          <input type="hidden" id="store-color-value" value="${curColor}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" data-action="delete-store">Smazat</button>
        <button class="btn btn-secondary" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" data-action="save-edit-store">Uložit</button>
      </div>
    </div>`;
  }

  _modalAddCard() {
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Přidat kartu</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label class="form-label">Název karty *</label>
          <input class="form-input" id="card-name" placeholder="Moje karta">
        </div>
        <div class="form-field">
          <label class="form-label">Číslo / kód *</label>
          <div class="input-row">
            <input class="form-input" id="card-barcode" placeholder="1234567890123">
            <button class="btn btn-secondary" data-action="start-scan" style="flex-shrink:0">📷</button>
          </div>
          <div id="scan-area" style="display:none">
            <div class="scanner-wrap" id="scan-container"></div>
            <button class="btn btn-secondary" data-action="stop-scan" style="width:100%;margin-top:8px">Zastavit skener</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Typ čárového kódu</label>
          <select class="form-input form-select" id="card-type">
            ${BARCODE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Poznámky</label>
          <textarea class="form-input" id="card-notes" rows="3" placeholder="Volitelné poznámky…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" data-action="save-add-card">Přidat</button>
      </div>
    </div>`;
  }

  _modalEditCard() {
    const { card } = this._findStoreAndCard();
    if (!card) return '';
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Upravit kartu</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label class="form-label">Název *</label>
          <input class="form-input" id="card-name" value="${esc(card.name)}">
        </div>
        <div class="form-field">
          <label class="form-label">Číslo / kód *</label>
          <input class="form-input" id="card-barcode" value="${card.barcode}">
        </div>
        <div class="form-field">
          <label class="form-label">Typ čárového kódu</label>
          <select class="form-input form-select" id="card-type">
            ${BARCODE_TYPES.map(t => `<option value="${t}" ${t === card.barcode_type ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Poznámky</label>
          <textarea class="form-input" id="card-notes" rows="3">${esc(card.notes || '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" data-action="delete-card">Smazat</button>
        <button class="btn btn-secondary" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" data-action="save-edit-card">Uložit</button>
      </div>
    </div>`;
  }

  _modalLogo() {
    const store = this._findStore(this._view.storeId);
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Logo obchodu</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="logo-row">
          ${store?.logo_url
            ? `<img id="logo-preview" class="logo-preview" src="${store.logo_url}">`
            : `<div id="logo-preview" class="logo-initials-preview">${(store?.name || '?')[0].toUpperCase()}</div>`}
        </div>
        <div class="form-field">
          <label class="form-label">Stáhnout z URL</label>
          <div class="input-row">
            <input class="form-input" id="logo-url" placeholder="https://…">
            <button class="btn btn-secondary" data-action="download-logo" style="flex-shrink:0">Stáhnout</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Nahrát soubor</label>
          <input type="file" accept="image/*" id="logo-file" class="form-input">
        </div>
        ${store?.logo_url
          ? `<button class="btn btn-danger" data-action="delete-logo" style="width:100%;margin-bottom:8px">Smazat logo</button>`
          : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zavřít</button>
        <button class="btn btn-primary" data-action="upload-logo">Nahrát soubor</button>
      </div>
    </div>`;
  }

  _modalLocations() {
    const store = this._findStore(this._view.storeId);
    const locs = store?.locations || [];
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Lokace – ${esc(store?.name || '')}</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        ${locs.length === 0
          ? `<div class="empty-state"><p>Žádné lokace.</p></div>`
          : locs.map((loc, i) => `
            <div class="location-item">
              <div class="location-info">
                <div class="location-label">${esc(loc.label || `Lokace ${i + 1}`)}</div>
                <div class="location-coords">${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} · ${loc.radius_m || 300} m</div>
              </div>
              <button class="btn-icon" data-action="delete-location" data-idx="${i}" title="Smazat">${ICON.trash}</button>
            </div>`).join('')}
        <hr style="border:none;border-top:1px solid var(--divider-color,#e0e0e0);margin:14px 0">
        <div class="form-field">
          <label class="form-label">Přidat lokaci</label>
          <input class="form-input" id="loc-label" placeholder="Název (např. Praha centrum)" style="margin-bottom:8px">
          <div class="input-row" style="margin-bottom:8px">
            <input class="form-input" id="loc-lat" placeholder="Zeměpisná šířka" type="number" step="0.00001">
            <input class="form-input" id="loc-lon" placeholder="Zeměpisná délka" type="number" step="0.00001">
          </div>
          <input class="form-input" id="loc-radius" placeholder="Poloměr v metrech (výchozí: 300)" type="number" min="50" max="5000">
        </div>
        <button class="btn btn-primary" data-action="add-location" style="width:100%">Přidat lokaci</button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zavřít</button>
      </div>
    </div>`;
  }

  _modalSettings() {
    const s = this._data?.settings || {};
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Nastavení</span>
        <button class="btn-icon" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label class="form-label">Device trackery (oddělené čárkou)</label>
          <input class="form-input" id="s-trackers" value="${esc((s.device_trackers || []).join(', '))}" placeholder="device_tracker.telefon">
        </div>
        <div class="form-field">
          <label class="form-label">Poloměr upozornění (m)</label>
          <input class="form-input" id="s-proximity" type="number" min="50" max="5000" value="${s.global_proximity_m || 300}">
        </div>
        <div class="form-field">
          <label class="form-label">Prodleva upozornění (min)</label>
          <input class="form-input" id="s-dwell" type="number" min="1" max="120" value="${s.notification_dwell_minutes || 7}">
        </div>
        <div class="form-field" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="s-notif" ${s.notifications_enabled !== false ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer">
          <label for="s-notif" class="form-label" style="margin:0;cursor:pointer">Upozornění povolena</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" data-action="save-settings">Uložit</button>
      </div>
    </div>`;
  }

  // ── Service calls ──

  async _doAddStore(overlay) {
    const name = overlay.querySelector('#store-name')?.value?.trim();
    if (!name) return alert('Zadej název obchodu.');
    const category = overlay.querySelector('#store-category')?.value || 'other';
    const color = overlay.querySelector('#store-color-value')?.value || DEFAULT_COLORS[0];
    const data = { name, category, tile_color: color };
    if (this._modalData.storeKey) data.store_key = this._modalData.storeKey;
    await this._callService('add_store', data);
    this._closeModal();
  }

  async _doEditStore(overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store) return;
    const name = overlay.querySelector('#store-name')?.value?.trim();
    if (!name) return alert('Zadej název.');
    await this._callService('update_store', {
      store_id: store.id,
      name,
      category: overlay.querySelector('#store-category')?.value,
      tile_color: overlay.querySelector('#store-color-value')?.value,
    });
    this._closeModal();
  }

  async _doDeleteStore() {
    const store = this._findStore(this._view.storeId);
    if (!store || !confirm(`Smazat obchod "${store.name}" a všechny jeho karty?`)) return;
    await this._callService('delete_store', { store_id: store.id });
    this._view = { type: 'list' };
    this._closeModal();
    await this._loadData();
    this._render();
  }

  async _doAddCard(overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store) return;
    const name = overlay.querySelector('#card-name')?.value?.trim();
    const barcode = overlay.querySelector('#card-barcode')?.value?.trim();
    if (!name || !barcode) return alert('Vyplň název a kód karty.');
    await this._callService('add_card', {
      store_id: store.id, name, barcode,
      barcode_type: overlay.querySelector('#card-type')?.value || 'CODE_128',
      notes: overlay.querySelector('#card-notes')?.value || '',
    });
    this._closeModal();
  }

  async _doEditCard(overlay) {
    const { card } = this._findStoreAndCard();
    if (!card) return;
    const name = overlay.querySelector('#card-name')?.value?.trim();
    const barcode = overlay.querySelector('#card-barcode')?.value?.trim();
    if (!name || !barcode) return alert('Vyplň název a kód karty.');
    await this._callService('update_card', {
      card_id: card.id, name, barcode,
      barcode_type: overlay.querySelector('#card-type')?.value || card.barcode_type,
      notes: overlay.querySelector('#card-notes')?.value || '',
    });
    this._closeModal();
  }

  async _doDeleteCard() {
    const { card } = this._findStoreAndCard();
    if (!card || !confirm(`Smazat kartu "${card.name}"?`)) return;
    await this._callService('delete_card', { card_id: card.id });
    this._view = { type: 'store', storeId: this._view.storeId };
    this._closeModal();
    await this._loadData();
    this._render();
  }

  async _doDownloadLogo(overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store) return;
    const url = overlay.querySelector('#logo-url')?.value?.trim();
    if (!url) return alert('Zadej URL loga.');
    await this._callService('download_logo', { store_id: store.id, url });
    this._closeModal();
  }

  async _doUploadLogo(overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store) return;
    const file = overlay.querySelector('#logo-file')?.files?.[0];
    if (!file) return alert('Vyber soubor.');
    const data_url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    await this._callService('upload_logo', { store_id: store.id, data_url });
    this._closeModal();
  }

  async _doDeleteLogo() {
    const store = this._findStore(this._view.storeId);
    if (!store || !confirm('Smazat logo tohoto obchodu?')) return;
    await this._callService('delete_logo', { store_id: store.id });
    this._closeModal();
  }

  async _doAddLocation(overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store) return;
    const lat = parseFloat(overlay.querySelector('#loc-lat')?.value);
    const lon = parseFloat(overlay.querySelector('#loc-lon')?.value);
    if (isNaN(lat) || isNaN(lon)) return alert('Zadej platné souřadnice.');
    await this._callService('add_location', {
      store_id: store.id, lat, lon,
      radius_m: parseInt(overlay.querySelector('#loc-radius')?.value) || 300,
      label: overlay.querySelector('#loc-label')?.value?.trim() || '',
    });
    await this._loadData();
    this._openModal('locations');
  }

  async _doDeleteLocation(idx, overlay) {
    const store = this._findStore(this._view.storeId);
    if (!store || !confirm('Smazat tuto lokaci?')) return;
    await this._callService('delete_location', { store_id: store.id, location_index: idx });
    await this._loadData();
    this._openModal('locations');
  }

  async _doSaveSettings(overlay) {
    const trackers = (overlay.querySelector('#s-trackers')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    await this._callService('update_settings', {
      device_trackers: trackers,
      global_proximity_m: parseInt(overlay.querySelector('#s-proximity')?.value) || 300,
      notification_dwell_minutes: parseInt(overlay.querySelector('#s-dwell')?.value) || 7,
      notifications_enabled: overlay.querySelector('#s-notif')?.checked ?? true,
    });
    this._closeModal();
  }

  // ── Scanner ──

  async _startScan(overlay) {
    const scanArea = overlay.querySelector('#scan-area');
    if (!scanArea) return;
    scanArea.style.display = '';
    try {
      await loadScanner();

      // html5-qrcode needs a real DOM element (not shadow DOM)
      // We host it in light DOM and overlay it on the shadow container
      const shadow = overlay.querySelector('#scan-container');
      const rect = shadow?.getBoundingClientRect();

      const host = document.createElement('div');
      host.id = `lcc-scanner-${Date.now()}`;
      host.style.cssText = `position:fixed;z-index:99999;background:#000;border-radius:8px;overflow:hidden;
        top:${rect?.top || 100}px;left:${rect?.left || 0}px;width:${rect?.width || 300}px;height:${rect?.width || 300}px`;
      document.body.appendChild(host);
      this._scannerEl = host;

      // eslint-disable-next-line no-undef
      const scanner = new Html5Qrcode(host.id);
      this._scanner = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        decoded => {
          const input = overlay.querySelector('#card-barcode');
          if (input) input.value = decoded;
          this._stopScan(overlay);
        }
      );
    } catch (e) {
      console.error('[loyalty-cards-card] scanner error', e);
      scanArea.innerHTML = `<div style="padding:10px;color:#c62828;font-size:13px">Skener nelze spustit: ${e.message}</div>`;
    }
  }

  async _stopScan(overlay) {
    await this._destroyScanner();
    const scanArea = overlay?.querySelector('#scan-area');
    if (scanArea) scanArea.style.display = 'none';
  }

  async _destroyScanner() {
    if (this._scanner) {
      try { await this._scanner.stop(); } catch {}
      this._scanner = null;
    }
    if (this._scannerEl) {
      this._scannerEl.remove();
      this._scannerEl = null;
    }
  }

  // ── Helpers ──

  _findStore(id) {
    return this._data?.stores?.find(s => s.id === id) || null;
  }

  _findStoreAndCard() {
    const store = this._findStore(this._view.storeId);
    const card = store?.cards?.find(c => c.id === this._view.cardId) || null;
    return { store, card };
  }

  _catOptions(selected) {
    const labels = Object.keys(this._catalog?.category_labels || {}).length
      ? this._catalog.category_labels : FALLBACK_CATEGORY_LABELS;
    return Object.entries(labels)
      .map(([k, v]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${v}</option>`)
      .join('');
  }

  _colorSwatches(selected) {
    return DEFAULT_COLORS.map(c =>
      `<div class="color-swatch ${c === selected ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>`
    ).join('');
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICON = {
  back: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  edit: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>`,
  location: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.92c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.15-1.68a.5.5 0 00.11-.61l-2.04-3.53a.5.5 0 00-.59-.22l-2.54 1.02a7.4 7.4 0 00-1.67-.97l-.38-2.7A.49.49 0 0014 2h-4a.49.49 0 00-.49.42l-.38 2.7c-.61.25-1.17.59-1.67.97L4.92 5.07a.49.49 0 00-.59.22L2.29 8.82a.49.49 0 00.11.61L4.55 11.1c-.04.33-.07.66-.07 1s.03.66.07.97l-2.15 1.7a.49.49 0 00-.11.61l2.04 3.53c.11.22.36.3.59.22l2.53-1.02c.5.38 1.06.71 1.67.97l.38 2.7c.07.27.29.45.56.45h4c.27 0 .49-.18.55-.45l.38-2.7c.61-.26 1.17-.59 1.67-.97l2.53 1.02c.23.08.48 0 .59-.22l2.04-3.53a.49.49 0 00-.11-.61l-2.15-1.7z"/></svg>`,
  chevron: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.42z"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z"/></svg>`,
};

// ── Util ──────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Register ──────────────────────────────────────────────────────────────────

customElements.define('loyalty-cards-card', LoyaltyCardsCard);
