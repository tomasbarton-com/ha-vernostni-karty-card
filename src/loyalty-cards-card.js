// loyalty-cards-card.js — Věrnostní karty Lovelace karta

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

// ── External libs ─────────────────────────────────────────────────────────────

const _scripts = {};
function loadScript(src) {
  if (!_scripts[src]) {
    _scripts[src] = new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error(`Failed: ${src}`));
      document.head.appendChild(s);
    });
  }
  return _scripts[src];
}
const loadJsBarcode = () => loadScript('https://unpkg.com/jsbarcode@3.11.6/dist/JsBarcode.all.min.js');
const loadQrCode    = () => loadScript('https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js');
const loadScanner   = () => loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function getLogoUrl(store) {
  // Support both new (logo_url from integration) and old (logo key → local path) formats
  return store.logo_url
    || store.logo_path
    || (store.store_key ? `/local/loyalty-cards/logos/${store.store_key}.png` : null)
    || (store.logo      ? `/local/loyalty-cards/logos/${store.logo}.png`      : null);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICON = {
  plus:     `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.92c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.15-1.68a.5.5 0 00.11-.61l-2.04-3.53a.5.5 0 00-.59-.22l-2.54 1.02a7.4 7.4 0 00-1.67-.97l-.38-2.7A.49.49 0 0014 2h-4a.49.49 0 00-.49.42l-.38 2.7c-.61.25-1.17.59-1.67.97L4.92 5.07a.49.49 0 00-.59.22L2.29 8.82a.49.49 0 00.11.61L4.55 11.1c-.04.33-.07.66-.07 1s.03.66.07.97l-2.15 1.7a.49.49 0 00-.11.61l2.04 3.53c.11.22.36.3.59.22l2.53-1.02c.5.38 1.06.71 1.67.97l.38 2.7c.07.27.29.45.56.45h4c.27 0 .49-.18.55-.45l.38-2.7c.61-.26 1.17-.59 1.67-.97l2.53 1.02c.23.08.48 0 .59-.22l2.04-3.53a.49.49 0 00-.11-.61l-2.15-1.7z"/></svg>`,
  edit:     `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>`,
  trash:    `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z"/></svg>`,
  close:    `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  location: `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  image:    `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`,
};

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
  display: flex; align-items: center;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
  gap: 4px;
}
.header-title { flex: 1; font-size: 17px; font-weight: 500; color: var(--primary-text-color, #212121); }
.btn-icon {
  width: 36px; height: 36px; border-radius: 50%; background: none; border: none;
  cursor: pointer; color: var(--secondary-text-color, #757575);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: background .1s;
}
.btn-icon:hover { background: var(--secondary-background-color, #f0f0f0); }
.btn-icon.accent { color: var(--primary-color, #1976d2); }

/* ── Store grid ── */
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px; padding: 12px;
}
.empty-state {
  text-align: center; padding: 36px 16px;
  color: var(--secondary-text-color, #9e9e9e); font-size: 14px;
}
.empty-state .icon { font-size: 40px; display: block; margin-bottom: 8px; }

/* ── Tile ── */
.store-tile {
  border-radius: 10px; padding: 8px 6px 10px;
  cursor: pointer; position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  min-height: 82px; color: #fff;
  transition: transform .15s, box-shadow .15s, opacity .15s;
  user-select: none;
}
.store-tile:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,.22); }
.store-tile.no-cards { opacity: 0.48; }

.tile-logo {
  width: 36px; height: 36px; border-radius: 6px; object-fit: contain;
  background: rgba(255,255,255,.15); margin-top: 14px;
}
.tile-initials {
  width: 36px; height: 36px; border-radius: 6px;
  background: rgba(255,255,255,.22);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 700; margin-top: 14px;
}
.tile-name {
  font-size: 11px; font-weight: 500; text-align: center;
  word-break: break-word; line-height: 1.3;
  max-width: 100%;
}

/* Badges on tile */
.tile-count-badge {
  position: absolute; top: 4px; left: 5px;
  background: rgba(0,0,0,.30); color: #fff;
  border-radius: 9px; font-size: 10px; font-weight: 700;
  padding: 1px 5px; min-width: 16px; text-align: center; line-height: 16px;
}
.tile-menu-btn {
  position: absolute; top: 3px; right: 3px;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(0,0,0,.22); border: none; cursor: pointer;
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 13px; line-height: 1; padding: 0;
  transition: background .1s;
}
.tile-menu-btn:hover { background: rgba(0,0,0,.42); }

/* ── Modals ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.46);
  display: flex; align-items: flex-end; justify-content: center;
}
.modal-sheet {
  background: var(--ha-card-background, #fff);
  border-radius: 18px 18px 0 0; width: 100%; max-width: 500px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: 0 -4px 28px rgba(0,0,0,.18);
  display: flex; flex-direction: column;
}
.modal-sheet.sheet-menu { max-height: 60vh; border-radius: 18px 18px 0 0; }

.modal-header {
  display: flex; align-items: center; gap: 8px; padding: 14px 14px 12px;
  border-bottom: 1px solid var(--divider-color, #e0e0e0);
  flex-shrink: 0;
}
.modal-store-logo { width: 32px; height: 32px; border-radius: 6px; object-fit: contain; }
.modal-store-initials {
  width: 32px; height: 32px; border-radius: 6px;
  background: var(--primary-color, #1976d2);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.modal-title { flex: 1; font-size: 16px; font-weight: 500; color: var(--primary-text-color, #212121); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.modal-body { padding: 16px; flex: 1; overflow-y: auto; }
.modal-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--divider-color, #e0e0e0);
  flex-shrink: 0; background: var(--ha-card-background, #fff);
}

/* ── Tabs ── */
.tabs {
  display: flex; overflow-x: auto; border-bottom: 1px solid var(--divider-color, #e0e0e0);
  flex-shrink: 0; scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }
.tab {
  padding: 10px 16px; font-size: 13px; font-weight: 500; cursor: pointer;
  color: var(--secondary-text-color, #757575); white-space: nowrap; border: none;
  background: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color .1s, border-color .1s;
}
.tab.active { color: var(--primary-color, #1976d2); border-bottom-color: var(--primary-color, #1976d2); }
.tab:hover:not(.active) { color: var(--primary-text-color, #212121); }

/* ── Barcode view ── */
.barcode-view { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.barcode-wrap {
  background: #fff; border-radius: 10px; padding: 14px 10px;
  width: 100%; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; min-height: 100px;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.barcode-wrap canvas, .barcode-wrap svg { max-width: 100%; }
.barcode-value { font-family: monospace; font-size: 14px; color: var(--secondary-text-color, #757575); }
.card-notes {
  width: 100%; font-size: 13px; color: var(--primary-text-color, #212121);
  background: var(--secondary-background-color, #f5f5f5);
  border-radius: 8px; padding: 10px 12px; box-sizing: border-box;
}
.card-name-label { font-size: 12px; color: var(--secondary-text-color, #9e9e9e); align-self: flex-start; }

/* ── Menu sheet ── */
.menu-item {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px; cursor: pointer; font-size: 15px;
  color: var(--primary-text-color, #212121);
  border-bottom: 1px solid var(--divider-color, #f0f0f0);
  transition: background .1s;
}
.menu-item:hover { background: var(--secondary-background-color, #f5f5f5); }
.menu-item:last-child { border-bottom: none; }
.menu-item.danger { color: #e53935; }
.menu-item svg { flex-shrink: 0; color: var(--secondary-text-color, #9e9e9e); }
.menu-item.danger svg { color: #e53935; }

/* ── Forms ── */
.form-field { margin-bottom: 14px; }
.form-label { display: block; font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #757575); margin-bottom: 5px; }
.form-input {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px;
  padding: 10px 12px; font-size: 14px; color: var(--primary-text-color, #212121);
  background: var(--secondary-background-color, #f9f9f9);
  transition: border-color .15s; font-family: inherit;
}
.form-input:focus { outline: none; border-color: var(--primary-color, #1976d2); background: #fff; }
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23757575' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; cursor: pointer;
}
.input-row { display: flex; gap: 8px; }
.input-row .form-input { flex: 1; }

/* ── Catalog picker ── */
.catalog-category { margin-bottom: 14px; }
.catalog-cat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--secondary-text-color, #9e9e9e); margin-bottom: 6px; }
.catalog-items { display: flex; flex-wrap: wrap; gap: 6px; }
.catalog-chip {
  display: flex; align-items: center; gap: 6px; padding: 5px 10px;
  border: 1px solid var(--divider-color, #e0e0e0); border-radius: 20px;
  cursor: pointer; font-size: 13px; transition: all .1s; user-select: none;
}
.catalog-chip:hover { border-color: var(--primary-color, #1976d2); color: var(--primary-color, #1976d2); }
.catalog-chip.selected { background: var(--primary-color, #1976d2); color: #fff; border-color: var(--primary-color, #1976d2); }
.catalog-chip img { width: 16px; height: 16px; border-radius: 3px; object-fit: contain; }

/* ── Color picker ── */
.color-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.color-swatch {
  width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: transform .1s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.selected { border-color: var(--primary-text-color, #212121); transform: scale(1.15); }

/* ── Logo ── */
.logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.logo-preview { width: 56px; height: 56px; border-radius: 10px; object-fit: contain; border: 1px solid var(--divider-color, #e0e0e0); }
.logo-initials-preview {
  width: 56px; height: 56px; border-radius: 10px;
  background: var(--primary-color, #1976d2);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; color: #fff;
}

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
  font-size: 14px; font-weight: 500; transition: filter .1s; font-family: inherit;
}
.btn:hover { filter: brightness(.9); }
.btn-primary { background: var(--primary-color, #1976d2); color: #fff; }
.btn-secondary { background: var(--secondary-background-color, #efefef); color: var(--primary-text-color, #212121); }
.btn-danger { background: #e53935; color: #fff; }
.btn-full { width: 100%; justify-content: center; border-radius: 8px; padding: 11px; margin-bottom: 8px; }

/* ── Locations ── */
.location-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--divider-color, #e0e0e0); }
.location-info { flex: 1; font-size: 13px; }
.location-name { font-weight: 500; }
.location-coords { font-family: monospace; font-size: 11px; color: var(--secondary-text-color, #9e9e9e); }

/* ── Loading / Error ── */
.loading { display: flex; align-items: center; justify-content: center; padding: 36px; gap: 12px; color: var(--secondary-text-color, #9e9e9e); font-size: 14px; }
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { width: 22px; height: 22px; border: 3px solid var(--divider-color, #e0e0e0); border-top-color: var(--primary-color, #1976d2); border-radius: 50%; animation: spin .7s linear infinite; }
.error-banner { background: #ffebee; color: #b71c1c; padding: 12px 16px; font-size: 13px; margin: 12px; border-radius: 8px; }

/* ── Scanner ── */
.scanner-wrap { margin-top: 8px; border-radius: 8px; overflow: hidden; background: #000; aspect-ratio: 1; }
`;

// ── Card element ──────────────────────────────────────────────────────────────

class LoyaltyCardsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass        = null;
    this._catalog     = null;
    this._data        = null;
    this._config      = {};
    this._modal       = null;   // current modal name
    this._md          = {};     // modal data
    this._unsub       = null;
    this._initialized = false;
    this._error       = null;
    this._scanner     = null;
    this._scannerEl   = null;
  }

  setConfig(config) { this._config = config || {}; }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && !this._initialized) { this._initialized = true; this._init(); }
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
    } catch {
      this._catalog = { stores: [], category_labels: {} };
    }
  }

  async _loadData() {
    this._data = await this._hass.callWS({ type: 'loyalty_cards/get_data' });
  }

  _subscribeEvents() {
    this._unsub = this._hass.connection.subscribeEvents(async () => {
      try { await this._loadData(); } catch {}
      const modal = this._modal;
      const md    = { ...this._md };
      this._render();
      if (modal) { this._modal = modal; this._md = md; this._mountModal(); }
    }, 'loyalty_cards_updated');
  }

  disconnectedCallback() {
    this._unsub?.then(fn => fn()).catch(() => {});
    this._unsub = null;
    this._destroyScanner();
  }

  _callService(service, data) {
    return this._hass.callService('loyalty_cards', service, data);
  }

  // ── Main render ──

  _renderLoading() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <div class="card-root"><div class="loading"><div class="spinner"></div>Načítám…</div></div>`;
  }

  _render() {
    this._destroyScanner();
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="card-root">${this._buildGrid()}</div>`;
    this._bindRootEvents();
  }

  _buildGrid() {
    if (this._error) return `<div class="error-banner">⚠️ ${this._error}</div>`;
    const stores = this._data?.stores || [];

    const inner = stores.length === 0
      ? `<div class="empty-state"><span class="icon">🏪</span>Zatím žádné věrnostní karty.<br>Přidej první pomocí + výše.</div>`
      : `<div class="store-grid">${stores.map(s => this._buildTile(s)).join('')}</div>`;

    return `
      <div class="header">
        <span class="header-title">Věrnostní karty</span>
        <button class="btn-icon accent" data-action="open-add-store" title="Přidat obchod">${ICON.plus}</button>
        <button class="btn-icon" data-action="open-settings" title="Nastavení">${ICON.settings}</button>
      </div>
      ${inner}`;
  }

  _buildTile(store) {
    const cards   = store.cards || [];
    const count   = cards.length;
    const color   = store.tile_color || '#1976d2';
    const logo    = getLogoUrl(store);
    const noCards = count === 0;

    const logoEl = logo
      ? `<img class="tile-logo" src="${logo}" alt="${esc(store.name)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const initialsEl = `<div class="tile-initials" style="${logo ? 'display:none' : ''}">${store.name[0].toUpperCase()}</div>`;
    const countBadge = count > 0
      ? `<div class="tile-count-badge">${count}</div>`
      : '';

    return `
      <div class="store-tile${noCards ? ' no-cards' : ''}" data-action="open-barcode" data-id="${store.id}" style="background:${color}">
        ${countBadge}
        <button class="tile-menu-btn" data-action="open-tile-menu" data-id="${store.id}" title="Možnosti">⋮</button>
        ${logoEl}${initialsEl}
        <span class="tile-name">${esc(store.name)}</span>
      </div>`;
  }

  // ── Root event binding ──

  _bindRootEvents() {
    this.shadowRoot.querySelector('.card-root')?.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      e.stopPropagation();
      const id = el.dataset.id;
      switch (el.dataset.action) {
        case 'open-barcode':    return this._openBarcode(id);
        case 'open-tile-menu':  return this._openModal('tile-menu',  { storeId: id });
        case 'open-add-store':  return this._openModal('add-store',  { color: DEFAULT_COLORS[0] });
        case 'open-settings':   return this._openModal('settings',   {});
      }
    });
  }

  _openBarcode(storeId) {
    const store = this._findStore(storeId);
    if (!store) return;
    const cards = store.cards || [];
    if (cards.length === 0) {
      // No cards yet — open add-card modal directly
      return this._openModal('add-card', { storeId });
    }
    this._openModal('barcode', { storeId, tabIdx: 0 });
  }

  // ── Modal system ──

  _openModal(name, data = {}) {
    this._modal = name;
    this._md    = data;
    this._mountModal();
  }

  _mountModal() {
    this.shadowRoot.querySelector('.modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = this._buildModal(this._modal);
    this.shadowRoot.querySelector('.card-root').appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeModal(); });
    this._bindModalEvents(overlay);

    if (this._modal === 'barcode') {
      this._renderBarcodeInModal(overlay);
    }

    setTimeout(() => overlay.querySelector('input:not([type=hidden]), select, textarea')?.focus(), 60);
  }

  _closeModal() {
    this._modal = null;
    this._md    = {};
    this._destroyScanner();
    this.shadowRoot.querySelector('.modal-overlay')?.remove();
  }

  _buildModal(name) {
    if (name === 'barcode')    return this._modalBarcode();
    if (name === 'tile-menu')  return this._modalTileMenu();
    if (name === 'add-store')  return this._modalAddStore();
    if (name === 'edit-store') return this._modalEditStore();
    if (name === 'add-card')   return this._modalAddCard();
    if (name === 'edit-card')  return this._modalEditCard();
    if (name === 'logo')       return this._modalLogo();
    if (name === 'locations')  return this._modalLocations();
    if (name === 'settings')   return this._modalSettings();
    return '';
  }

  // ── Barcode popup ──

  _modalBarcode() {
    const store   = this._findStore(this._md.storeId);
    if (!store) return '';
    const cards   = store.cards || [];
    const tabIdx  = this._md.tabIdx ?? 0;
    const card    = cards[tabIdx];
    const logo    = getLogoUrl(store);
    const logoEl  = logo
      ? `<img class="modal-store-logo" src="${logo}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const initialsEl = `<div class="modal-store-initials" style="${logo ? 'display:none' : ''}">${store.name[0].toUpperCase()}</div>`;

    const tabs = cards.length > 1
      ? `<div class="tabs">${cards.map((c, i) =>
          `<button class="tab${i === tabIdx ? ' active' : ''}" data-action="switch-tab" data-idx="${i}">${esc(c.name)}</button>`
        ).join('')}</div>`
      : '';

    return `<div class="modal-sheet">
      <div class="modal-header">
        ${logoEl}${initialsEl}
        <span class="modal-title">${esc(store.name)}</span>
        <button class="btn-icon accent" data-action="open-add-card-from-barcode" title="Přidat kartu">${ICON.plus}</button>
        <button class="btn-icon" data-action="open-store-menu-from-barcode" title="Možnosti">⋮</button>
        <button class="btn-icon" data-action="close-modal" title="Zavřít">${ICON.close}</button>
      </div>
      ${tabs}
      <div class="barcode-view">
        <div class="card-name-label">${card ? esc(card.name) : ''}</div>
        <div class="barcode-wrap" id="barcode-container"><div class="spinner"></div></div>
        <div class="barcode-value">${card ? card.barcode : ''}</div>
        ${card?.notes ? `<div class="card-notes">${esc(card.notes)}</div>` : ''}
      </div>
      ${card ? `<div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="open-edit-card-from-barcode">${ICON.edit} Upravit</button>
        <button class="btn btn-danger" data-action="delete-card-from-barcode">${ICON.trash}</button>
      </div>` : ''}
    </div>`;
  }

  // ── Tile menu (⋮) ──

  _modalTileMenu() {
    const store = this._findStore(this._md.storeId);
    if (!store) return '';
    const logo   = getLogoUrl(store);
    const logoEl = logo
      ? `<img class="modal-store-logo" src="${logo}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const initialsEl = `<div class="modal-store-initials" style="${logo ? 'display:none' : ''}">${store.name[0].toUpperCase()}</div>`;

    return `<div class="modal-sheet sheet-menu">
      <div class="modal-header">
        ${logoEl}${initialsEl}
        <span class="modal-title">${esc(store.name)}</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="menu-item" data-action="menu-add-card">${ICON.plus} Přidat kartu</div>
      <div class="menu-item" data-action="menu-edit-store">${ICON.edit} Upravit obchod</div>
      <div class="menu-item" data-action="menu-logo">${ICON.image} Správa loga</div>
      <div class="menu-item" data-action="menu-locations">${ICON.location} Lokace</div>
      <div class="menu-item danger" data-action="menu-delete-store">${ICON.trash} Smazat obchod</div>
    </div>`;
  }

  // ── Add store ──

  _modalAddStore() {
    const catalog = this._catalog || { stores: [], category_labels: {} };
    const labels  = Object.keys(catalog.category_labels).length ? catalog.category_labels : FALLBACK_CATEGORY_LABELS;
    const byCategory = {};
    for (const s of catalog.stores) {
      (byCategory[s.category] = byCategory[s.category] || []).push(s);
    }
    const catalogHTML = Object.entries(byCategory).map(([cat, stores]) => `
      <div class="catalog-category">
        <div class="catalog-cat-label">${labels[cat] || cat}</div>
        <div class="catalog-items">${stores.map(s => {
          const logo = getLogoUrl(s);
          return `<div class="catalog-chip" data-key="${s.key}" data-name="${esc(s.name)}" data-category="${s.category}">
            ${logo ? `<img src="${logo}" onerror="this.style.display='none'">` : ''}
            ${esc(s.name)}</div>`;
        }).join('')}</div>
      </div>`).join('');
    const curColor = this._md.color || DEFAULT_COLORS[0];

    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Přidat obchod</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="modal-body">
        ${catalogHTML ? `<div class="form-field">
          <label class="form-label">Vybrat z katalogu</label>
          <input class="form-input" id="catalog-search" placeholder="Hledat…" type="search" autocomplete="off">
        </div>${catalogHTML}<hr style="margin:12px 0;border:none;border-top:1px solid var(--divider-color,#e0e0e0)">` : ''}
        <div class="form-field">
          <label class="form-label">Název *</label>
          <input class="form-input" id="store-name" placeholder="Název obchodu">
        </div>
        <div class="form-field">
          <label class="form-label">Kategorie</label>
          <select class="form-input form-select" id="store-category">${this._catOptions('other')}</select>
        </div>
        <div class="form-field">
          <label class="form-label">Barva dlaždice</label>
          <div class="color-row">${this._colorSwatches(curColor)}</div>
          <input type="hidden" id="store-color" value="${curColor}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" style="flex:1" data-action="save-add-store">Přidat</button>
      </div>
    </div>`;
  }

  // ── Edit store ──

  _modalEditStore() {
    const store = this._findStore(this._md.storeId);
    if (!store) return '';
    const logo    = getLogoUrl(store);
    const curColor = store.tile_color || DEFAULT_COLORS[0];
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Upravit obchod</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="modal-body">
        <div class="logo-row">
          ${logo
            ? `<img class="logo-preview" src="${logo}" alt="${esc(store.name)}">`
            : `<div class="logo-initials-preview">${store.name[0].toUpperCase()}</div>`}
          <button class="btn btn-secondary" data-action="open-logo-from-edit">Změnit logo</button>
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
          <input type="hidden" id="store-color" value="${curColor}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" style="flex:1" data-action="save-edit-store">Uložit</button>
      </div>
    </div>`;
  }

  // ── Add card ──

  _modalAddCard() {
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Přidat kartu</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
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
            <button class="btn btn-secondary" data-action="start-scan">📷</button>
          </div>
          <div id="scan-area" style="display:none">
            <div class="scanner-wrap" id="scan-container"></div>
            <button class="btn btn-secondary btn-full" data-action="stop-scan" style="margin-top:8px">Zastavit skener</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Typ čárového kódu</label>
          <select class="form-input form-select" id="card-type">
            ${BARCODE_TYPES.map(t => `<option value="${t}"${t==='EAN_13'?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Poznámky</label>
          <textarea class="form-input" id="card-notes" rows="2" placeholder="Volitelné…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" style="flex:1" data-action="save-add-card">Přidat</button>
      </div>
    </div>`;
  }

  // ── Edit card ──

  _modalEditCard() {
    const store = this._findStore(this._md.storeId);
    const card  = store?.cards?.find(c => c.id === this._md.cardId);
    if (!card) return '';
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Upravit kartu</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
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
            ${BARCODE_TYPES.map(t => `<option value="${t}"${t===card.barcode_type?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Poznámky</label>
          <textarea class="form-input" id="card-notes" rows="2">${esc(card.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" style="flex:1" data-action="save-edit-card">Uložit</button>
      </div>
    </div>`;
  }

  // ── Logo ──

  _modalLogo() {
    const store = this._findStore(this._md.storeId);
    const logo  = getLogoUrl(store);
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Logo — ${esc(store?.name||'')}</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="modal-body">
        <div class="logo-row">
          ${logo
            ? `<img id="logo-preview" class="logo-preview" src="${logo}">`
            : `<div id="logo-preview" class="logo-initials-preview">${(store?.name||'?')[0].toUpperCase()}</div>`}
        </div>
        <div class="form-field">
          <label class="form-label">Stáhnout z URL</label>
          <div class="input-row">
            <input class="form-input" id="logo-url" placeholder="https://…">
            <button class="btn btn-secondary" data-action="download-logo">Stáhnout</button>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Nahrát soubor</label>
          <input type="file" accept="image/*" id="logo-file" class="form-input">
        </div>
        ${logo ? `<button class="btn btn-danger btn-full" data-action="delete-logo">Smazat logo</button>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zavřít</button>
        <button class="btn btn-primary" style="flex:1" data-action="upload-logo">Nahrát soubor</button>
      </div>
    </div>`;
  }

  // ── Locations ──

  _modalLocations() {
    const store = this._findStore(this._md.storeId);
    const locs  = store?.locations || [];
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Lokace — ${esc(store?.name||'')}</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="modal-body">
        ${locs.map((loc, i) => `
          <div class="location-item">
            <div class="location-info">
              <div class="location-name">${esc(loc.label || `Lokace ${i+1}`)}</div>
              <div class="location-coords">${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} · ${loc.radius_m||300} m</div>
            </div>
            <button class="btn-icon" data-action="delete-location" data-idx="${i}">${ICON.trash}</button>
          </div>`).join('')}
        ${locs.length === 0 ? `<p style="color:var(--secondary-text-color);font-size:13px">Žádné lokace.</p>` : ''}
        <hr style="border:none;border-top:1px solid var(--divider-color,#e0e0e0);margin:12px 0">
        <div class="form-field">
          <label class="form-label">Přidat lokaci</label>
          <input class="form-input" id="loc-label" placeholder="Název" style="margin-bottom:8px">
          <div class="input-row" style="margin-bottom:8px">
            <input class="form-input" id="loc-lat" placeholder="Lat" type="number" step="0.00001">
            <input class="form-input" id="loc-lon" placeholder="Lon" type="number" step="0.00001">
          </div>
          <input class="form-input" id="loc-radius" placeholder="Poloměr v metrech (výchozí 300)" type="number">
        </div>
        <button class="btn btn-primary btn-full" data-action="add-location">Přidat lokaci</button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Zavřít</button>
      </div>
    </div>`;
  }

  // ── Settings ──

  _modalSettings() {
    const s = this._data?.settings || {};
    return `<div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Nastavení</span>
        <button class="btn-icon" data-action="close-modal">${ICON.close}</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label class="form-label">Device trackery (oddělené čárkou)</label>
          <input class="form-input" id="s-trackers" value="${esc((s.device_trackers||[]).join(', '))}" placeholder="device_tracker.telefon">
        </div>
        <div class="form-field">
          <label class="form-label">Poloměr upozornění (m)</label>
          <input class="form-input" id="s-proximity" type="number" min="50" max="5000" value="${s.global_proximity_m||300}">
        </div>
        <div class="form-field">
          <label class="form-label">Prodleva upozornění (min)</label>
          <input class="form-input" id="s-dwell" type="number" min="1" max="120" value="${s.notification_dwell_minutes||7}">
        </div>
        <div class="form-field" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="s-notif" ${s.notifications_enabled!==false?'checked':''} style="width:18px;height:18px;cursor:pointer">
          <label for="s-notif" class="form-label" style="margin:0;cursor:pointer">Upozornění povolena</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" data-action="close-modal">Zrušit</button>
        <button class="btn btn-primary" style="flex:1" data-action="save-settings">Uložit</button>
      </div>
    </div>`;
  }

  // ── Modal event binding ──

  _bindModalEvents(overlay) {
    overlay.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el || el.classList.contains('catalog-chip')) return;
      e.stopPropagation();
      this._handleModalAction(el.dataset.action, el, overlay);
    });

    // Catalog chip selection
    overlay.querySelectorAll('.catalog-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.catalog-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const n = overlay.querySelector('#store-name');
        const c = overlay.querySelector('#store-category');
        if (n) n.value = chip.dataset.name || '';
        if (c) c.value = chip.dataset.category || 'other';
        this._md.storeKey = chip.dataset.key || null;
      });
    });

    // Catalog search filter
    overlay.querySelector('#catalog-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      overlay.querySelectorAll('.catalog-chip').forEach(ch => {
        ch.style.display = ch.dataset.name?.toLowerCase().includes(q) ? '' : 'none';
      });
      overlay.querySelectorAll('.catalog-category').forEach(cat => {
        cat.style.display = [...cat.querySelectorAll('.catalog-chip')].some(c => c.style.display !== 'none') ? '' : 'none';
      });
    });

    // Color swatches
    overlay.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        overlay.querySelector('#store-color').value = sw.dataset.color;
      });
    });

    // Logo file preview
    overlay.querySelector('#logo-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = ev => {
        const img = overlay.querySelector('#logo-preview');
        if (img?.tagName === 'IMG') img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    });
  }

  async _handleModalAction(action, el, overlay) {
    switch (action) {
      case 'close-modal': return this._closeModal();

      // Barcode popup actions
      case 'switch-tab':
        this._md.tabIdx = parseInt(el.dataset.idx);
        this._mountModal();
        return;
      case 'open-add-card-from-barcode':
        return this._openModal('add-card', { storeId: this._md.storeId });
      case 'open-store-menu-from-barcode':
        return this._openModal('tile-menu', { storeId: this._md.storeId });
      case 'open-edit-card-from-barcode': {
        const store = this._findStore(this._md.storeId);
        const card  = store?.cards?.[this._md.tabIdx ?? 0];
        if (card) this._openModal('edit-card', { storeId: this._md.storeId, cardId: card.id });
        return;
      }
      case 'delete-card-from-barcode': {
        const store = this._findStore(this._md.storeId);
        const card  = store?.cards?.[this._md.tabIdx ?? 0];
        if (card) await this._doDeleteCard(this._md.storeId, card);
        return;
      }

      // Tile menu actions
      case 'menu-add-card':
        return this._openModal('add-card', { storeId: this._md.storeId });
      case 'menu-edit-store':
        return this._openModal('edit-store', { storeId: this._md.storeId });
      case 'menu-logo':
        return this._openModal('logo', { storeId: this._md.storeId });
      case 'menu-locations':
        return this._openModal('locations', { storeId: this._md.storeId });
      case 'menu-delete-store':
        return this._doDeleteStore(this._md.storeId);

      // Edit store actions
      case 'open-logo-from-edit':
        return this._openModal('logo', { storeId: this._md.storeId });
      case 'save-edit-store':
        return this._doEditStore(overlay);

      // Add/save actions
      case 'save-add-store':  return this._doAddStore(overlay);
      case 'save-add-card':   return this._doAddCard(overlay);
      case 'save-edit-card':  return this._doEditCard(overlay);

      // Logo
      case 'download-logo':   return this._doDownloadLogo(overlay);
      case 'upload-logo':     return this._doUploadLogo(overlay);
      case 'delete-logo':     return this._doDeleteLogo();

      // Locations
      case 'add-location':    return this._doAddLocation(overlay);
      case 'delete-location': return this._doDeleteLocation(parseInt(el.dataset.idx));

      // Settings
      case 'save-settings':   return this._doSaveSettings(overlay);

      // Scanner
      case 'start-scan':      return this._startScan(overlay);
      case 'stop-scan':       return this._stopScan(overlay);
    }
  }

  // ── Barcode rendering ──

  async _renderBarcodeInModal(overlay) {
    const store  = this._findStore(this._md.storeId);
    const cards  = store?.cards || [];
    const card   = cards[this._md.tabIdx ?? 0];
    if (!card) return;

    const container = overlay.querySelector('#barcode-container');
    if (!container) return;
    container.innerHTML = '';

    const fmt = card.barcode_type || 'CODE_128';

    try {
      if (JSBARCODE_FORMAT[fmt]) {
        await loadJsBarcode();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        container.appendChild(svg);
        // eslint-disable-next-line no-undef
        JsBarcode(svg, card.barcode, { format: JSBARCODE_FORMAT[fmt], displayValue: false, width: 2, height: 80, margin: 6 });
      } else {
        await loadQrCode();
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        // eslint-disable-next-line no-undef
        await QRCode.toCanvas(canvas, card.barcode, { width: 200, margin: 2 });
        if (fmt !== 'QR_CODE') {
          const note = document.createElement('div');
          note.style.cssText = 'font-size:11px;color:#9e9e9e;margin-top:4px;text-align:center';
          note.textContent = `(zobrazeno jako QR — formát ${fmt})`;
          container.appendChild(note);
        }
      }
    } catch (e) {
      container.innerHTML = `<div style="color:#c62828;font-size:13px;text-align:center">Nelze vykreslit: ${e.message}</div>`;
    }
  }

  // ── Service calls ──

  async _doAddStore(overlay) {
    const name = overlay.querySelector('#store-name')?.value?.trim();
    if (!name) return alert('Zadej název obchodu.');
    const data = {
      name,
      category:   overlay.querySelector('#store-category')?.value || 'other',
      tile_color: overlay.querySelector('#store-color')?.value || DEFAULT_COLORS[0],
    };
    if (this._md.storeKey) data.store_key = this._md.storeKey;
    await this._callService('add_store', data);
    this._closeModal();
  }

  async _doEditStore(overlay) {
    const store = this._findStore(this._md.storeId);
    if (!store) return;
    const name = overlay.querySelector('#store-name')?.value?.trim();
    if (!name) return alert('Zadej název.');
    await this._callService('update_store', {
      store_id:   store.id,
      name,
      category:   overlay.querySelector('#store-category')?.value,
      tile_color: overlay.querySelector('#store-color')?.value,
    });
    this._closeModal();
  }

  async _doDeleteStore(storeId) {
    const store = this._findStore(storeId);
    if (!store || !confirm(`Smazat obchod "${store.name}" a všechny jeho karty?`)) return;
    await this._callService('delete_store', { store_id: store.id });
    this._closeModal();
    await this._loadData();
    this._render();
  }

  async _doAddCard(overlay) {
    const storeId = this._md.storeId;
    if (!storeId) return;
    const name    = overlay.querySelector('#card-name')?.value?.trim();
    const barcode = overlay.querySelector('#card-barcode')?.value?.trim();
    if (!name || !barcode) return alert('Vyplň název a kód karty.');
    await this._callService('add_card', {
      store_id:     storeId,
      name, barcode,
      barcode_type: overlay.querySelector('#card-type')?.value || 'CODE_128',
      notes:        overlay.querySelector('#card-notes')?.value || '',
    });
    // After adding, open barcode popup for this store
    this._closeModal();
    await this._loadData();
    this._render();
    this._openBarcode(storeId);
  }

  async _doEditCard(overlay) {
    const storeId = this._md.storeId;
    const cardId  = this._md.cardId;
    const name    = overlay.querySelector('#card-name')?.value?.trim();
    const barcode = overlay.querySelector('#card-barcode')?.value?.trim();
    if (!name || !barcode) return alert('Vyplň název a kód karty.');
    await this._callService('update_card', {
      card_id:      cardId,
      name, barcode,
      barcode_type: overlay.querySelector('#card-type')?.value,
      notes:        overlay.querySelector('#card-notes')?.value || '',
    });
    this._closeModal();
    await this._loadData();
    this._render();
    // Reopen barcode popup
    this._openBarcode(storeId);
  }

  async _doDeleteCard(storeId, card) {
    if (!confirm(`Smazat kartu "${card.name}"?`)) return;
    await this._callService('delete_card', { card_id: card.id });
    this._closeModal();
    await this._loadData();
    this._render();
    const store = this._findStore(storeId);
    if ((store?.cards || []).length > 0) this._openBarcode(storeId);
  }

  async _doDownloadLogo(overlay) {
    const store = this._findStore(this._md.storeId);
    if (!store) return;
    const url = overlay.querySelector('#logo-url')?.value?.trim();
    if (!url) return alert('Zadej URL loga.');
    await this._callService('download_logo', { store_id: store.id, url });
    this._closeModal();
  }

  async _doUploadLogo(overlay) {
    const store = this._findStore(this._md.storeId);
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
    const store = this._findStore(this._md.storeId);
    if (!store || !confirm('Smazat logo?')) return;
    await this._callService('delete_logo', { store_id: store.id });
    this._closeModal();
  }

  async _doAddLocation(overlay) {
    const store = this._findStore(this._md.storeId);
    if (!store) return;
    const lat = parseFloat(overlay.querySelector('#loc-lat')?.value);
    const lon = parseFloat(overlay.querySelector('#loc-lon')?.value);
    if (isNaN(lat) || isNaN(lon)) return alert('Zadej platné souřadnice.');
    await this._callService('add_location', {
      store_id: store.id, lat, lon,
      radius_m: parseInt(overlay.querySelector('#loc-radius')?.value) || 300,
      label:    overlay.querySelector('#loc-label')?.value?.trim() || '',
    });
    await this._loadData();
    this._openModal('locations', { storeId: store.id });
  }

  async _doDeleteLocation(idx) {
    const store = this._findStore(this._md.storeId);
    if (!store || !confirm('Smazat lokaci?')) return;
    await this._callService('delete_location', { store_id: store.id, location_index: idx });
    await this._loadData();
    this._openModal('locations', { storeId: store.id });
  }

  async _doSaveSettings(overlay) {
    const trackers = (overlay.querySelector('#s-trackers')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    await this._callService('update_settings', {
      device_trackers:              trackers,
      global_proximity_m:           parseInt(overlay.querySelector('#s-proximity')?.value) || 300,
      notification_dwell_minutes:   parseInt(overlay.querySelector('#s-dwell')?.value) || 7,
      notifications_enabled:        overlay.querySelector('#s-notif')?.checked ?? true,
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
      const shadowEl = overlay.querySelector('#scan-container');
      const rect = shadowEl?.getBoundingClientRect() || { top: 100, left: 0, width: 300 };

      const host = document.createElement('div');
      host.id = `lcc-scan-${Date.now()}`;
      host.style.cssText = `position:fixed;z-index:99999;background:#000;border-radius:8px;overflow:hidden;
        top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.width}px`;
      document.body.appendChild(host);
      this._scannerEl = host;

      // eslint-disable-next-line no-undef
      const scanner = new Html5Qrcode(host.id);
      this._scanner = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        decoded => {
          const input = overlay.querySelector('#card-barcode');
          if (input) input.value = decoded;
          this._stopScan(overlay);
        }
      );
    } catch (e) {
      scanArea.innerHTML = `<div style="padding:10px;color:#c62828;font-size:13px">Skener nelze spustit: ${e.message}</div>`;
    }
  }

  async _stopScan(overlay) {
    await this._destroyScanner();
    const sa = overlay?.querySelector('#scan-area');
    if (sa) sa.style.display = 'none';
  }

  async _destroyScanner() {
    if (this._scanner) { try { await this._scanner.stop(); } catch {} this._scanner = null; }
    if (this._scannerEl) { this._scannerEl.remove(); this._scannerEl = null; }
  }

  // ── Helpers ──

  _findStore(id) {
    return this._data?.stores?.find(s => s.id === id) || null;
  }

  _catOptions(selected) {
    const labels = Object.keys(this._catalog?.category_labels||{}).length
      ? this._catalog.category_labels : FALLBACK_CATEGORY_LABELS;
    return Object.entries(labels)
      .map(([k, v]) => `<option value="${k}"${k===selected?' selected':''}>${v}</option>`)
      .join('');
  }

  _colorSwatches(selected) {
    return DEFAULT_COLORS.map(c =>
      `<div class="color-swatch${c===selected?' selected':''}" data-color="${c}" style="background:${c}"></div>`
    ).join('');
  }
}

customElements.define('loyalty-cards-card', LoyaltyCardsCard);
