import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Public project URL and anon key: safe to ship in the app. All access is controlled
// by row-level security and role checks inside the database functions.
const SB_URL = 'https://qvhwafbqipuulizvrgow.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aHdhZmJxaXB1dWxpenZyZ293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzAzNzAsImV4cCI6MjEwODk0NjM3MH0.CJbipAcj084NAHDkM7jaW6bmFndvNaDsimx7jRIbgFo';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
const $app = document.getElementById('app');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toFixed(2);
const moneyShort = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
const num = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));
const pad3 = (n) => '#' + String(n).padStart(3, '0');
const parseMoney = (s) => { const v = parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')); return isNaN(v) ? null : Math.round(v * 100) / 100; };
const bbDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Barbados' }).format(d);
const bbTime = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Barbados', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const prettyDate = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); };
const shiftDate = (ymd, days) => { const [y, m, d] = ymd.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + days, 12)); return t.toISOString().slice(0, 10); };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const ROLE_VIEWS = {
  admin: ['counter', 'kitchen', 'close', 'today', 'menu'],
  counter: ['counter', 'close'],
  kitchen: ['kitchen']
};
const TAB_LABEL = { counter: 'Counter', kitchen: 'Kitchen', close: 'Close', today: 'Today', menu: 'Admin' };
const ICON = {
  counter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18M5 7l1 13h12l1-13M9 11v5M15 11v5M8 7V4h8v3"/></svg>',
  kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16a8 8 0 0 1-16 0zM12 3v3M8 4v2M16 4v2"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
};

function errText(e) {
  const m = String((e && (e.message || e.error_description || e.msg)) || e || 'Something went wrong');
  const map = {
    NOT_ALLOWED: "Your account isn't allowed to do that.",
    NO_OPEN_SHIFT: 'Open a shift first.',
    SHIFT_ALREADY_OPEN: 'A shift is already open.',
    NOT_ENOUGH_CASH: 'Cash handed over is less than the total.',
    REASON_REQUIRED: 'Please give a reason.',
    EMPTY_ORDER: 'The order is empty.',
    BAD_COUNT: 'Enter the cash counted.',
    'Invalid login credentials': 'Wrong email or password.',
    'Email not confirmed': 'Please confirm your email first — check your inbox.'
  };
  for (const k in map) if (m.includes(k)) return map[k];
  if (m.includes('SOLD_OUT:')) return 'Sold out: ' + m.split('SOLD_OUT:')[1].trim();
  if (m.includes('NEED_TWO_SIDES:')) return 'Pick 2 sides for ' + m.split('NEED_TWO_SIDES:')[1].trim();
  if (m.includes('UNKNOWN_SIDE:')) return 'Side no longer on the menu: ' + m.split('UNKNOWN_SIDE:')[1].trim();
  if (m.includes('UNKNOWN_ITEM')) return 'An item is no longer on the menu. Remove it and try again.';
  return m;
}
const isNetworkErr = (e) => !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(String((e && e.message) || e));

// ---------- state ----------
const OUTBOX_KEY = 'bk-outbox-v1';
const FAILED_KEY = 'bk-failed-v1';
const loadJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

const S = {
  ready: false, session: null, me: null, recovering: false,
  view: 'counter', cats: [], items: [], staff: [],
  settings: { late_on: false, late_min: 8, default_float: 100 },
  shift: undefined, cart: [], sides: null,
  pay: { method: 'cash', tendered: null, other: false, custom: '' },
  tickets: [], seenTickets: new Set(), now: Date.now(),
  todayDate: null, today: null, todayOrders: [], voidFor: null, voidReason: '',
  closeForm: { counted: '', reason: '' }, floatInput: '',
  newItem: { name: '', price: '', cost: '', cat: 'grill', sides: false },
  newStaff: { email: '', name: '', role: 'counter' },
  removeFor: null, account: false, pw: '',
  auth: { mode: 'signin', email: '', password: '', msg: '', err: false },
  toast: null, busy: false, live: false, online: navigator.onLine,
  outbox: loadJSON(OUTBOX_KEY), failed: loadJSON(FAILED_KEY),
  activeSec: null, soundOn: false, wakeLock: null, installEvt: null
};

let toastTimer;
function toast(text, err = false) {
  clearTimeout(toastTimer);
  S.toast = { text, err };
  render();
  toastTimer = setTimeout(() => { S.toast = null; render(); }, err ? 5000 : 2800);
}

const itemById = (id) => S.items.find((i) => i.id === id);
const cartTotal = () => S.cart.reduce((s, l) => s + l.price * l.qty, 0);
const tenderedValue = () => (S.pay.other ? parseMoney(S.pay.custom) : S.pay.tendered);
const views = () => (S.me ? ROLE_VIEWS[S.me.role] || [] : []);

// ---------- rendering ----------
function render() {
  const ae = document.activeElement;
  const fid = ae && ae.id;
  let sel = null;
  try { if (fid && typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch { /* not a text input */ }
  const scrolls = {};
  document.querySelectorAll('[data-keep-scroll]').forEach((el) => { scrolls[el.id] = [el.scrollTop, el.scrollLeft]; });

  $app.innerHTML = view();
  $app.className = 'app' + (S.me && S.view === 'kitchen' ? ' kitchen' : '');

  for (const id in scrolls) { const el = document.getElementById(id); if (el) { el.scrollTop = scrolls[id][0]; el.scrollLeft = scrolls[id][1]; } }
  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ } } }
  }
}

function view() {
  if (!S.ready) return '<div class="splash">Loading…</div>';
  if (S.recovering) return newPasswordView();
  if (!S.session) return authView();
  if (!S.me) return notStaffView();
  const allowed = views();
  if (!allowed.includes(S.view) && !(S.view === 'pay' && allowed.includes('counter'))) S.view = allowed[0];
  let main;
  switch (S.view) {
    case 'counter': main = counterView(); break;
    case 'pay': main = payView(); break;
    case 'kitchen': main = kitchenView(); break;
    case 'close': main = closeView(); break;
    case 'today': main = todayView(); break;
    case 'menu': main = adminView(); break;
    default: main = '';
  }
  return main + (S.sides ? sidesSheet() : '') + (S.account ? accountSheet() : '') + tabsView() + toastView();
}

const signOutLink = () => '';
function accountSheet() {
  return `<div class="sheet-wrap" data-act="accountBackdrop"><section class="sheet" aria-label="Account">
    <div class="row"><h1>Account</h1><button class="icon-btn" style="background:var(--ground);color:var(--ink);" data-act="closeAccount" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="muted" style="margin:0;">Signed in as <b>${esc(S.session.user.email)}</b> (${esc(S.me.role)})</p>
    <label class="field">New password (8+ characters)<input class="input" id="f-pw" type="password" autocomplete="new-password" data-bind="pw" data-live value="${esc(S.pw)}"></label>
    <button class="btn" data-act="savePw" ${S.pw.length >= 8 && !S.busy ? '' : 'disabled'}>Change password</button>
    <button class="btn ghost" data-act="signOut">Sign out</button>
  </section></div>`;
}
const toastView = () => (S.toast ? `<div class="toast${S.toast.err ? ' err' : ''}" role="status">${esc(S.toast.text)}</div>` : '');
const livePill = () => {
  const pill = !S.online ? '<span class="pill off">● Offline</span>' : S.live ? '<span class="pill">● Live</span>' : '<span class="pill off">● Connecting</span>';
  return `<span style="display:flex;align-items:center;gap:8px;">${pill}<button class="icon-btn" style="width:40px;height:40px;" data-act="openAccount" aria-label="Account and sign out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></button></span>`;
};

function tabsView() {
  const v = views();
  if (v.length < 2) return '';
  const active = S.view === 'pay' ? 'counter' : S.view;
  const count = S.tickets.length;
  return `<nav class="tabs" style="grid-template-columns: repeat(${v.length}, minmax(0, 1fr));" aria-label="Screens">
    ${v.map((k) => `<button class="tab${k === active ? ' on' : ''}" data-act="go" data-arg="${k}" ${k === active ? 'aria-current="page"' : ''}>${ICON[k]}<span>${TAB_LABEL[k]}${k === 'kitchen' && count ? ` (${count})` : ''}</span></button>`).join('')}
  </nav>`;
}

// ---------- auth ----------
function authView() {
  const a = S.auth;
  const install = installButton();
  const titles = { signin: 'Sign in', signup: 'Create your password', forgot: 'Reset your password' };
  return `<div class="auth body">
    <div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Beach Kitchen</h1><p>Counter &amp; kitchen orders</p></div></div>
    <h2 style="margin:0;font-size:20px;font-weight:800;">${titles[a.mode]}</h2>
    ${a.mode === 'signup' ? '<p class="muted" style="margin:0;">First time here? Use the email on the staff list and choose a password (8+ characters). We\'ll email you a link to confirm it. If no email arrives, ask Mark to set up your login.</p>' : ''}
    ${a.msg ? `<div class="msg${a.err ? ' err' : ''}" role="status">${esc(a.msg)}</div>` : ''}
    <form data-submit="authSubmit" style="display:flex;flex-direction:column;gap:12px;">
      <label class="field">Email<input class="input" id="a-email" type="email" autocomplete="username" inputmode="email" data-bind="auth.email" value="${esc(a.email)}" required></label>
      ${a.mode !== 'forgot' ? `<label class="field">Password<input class="input" id="a-pass" type="password" autocomplete="${a.mode === 'signup' ? 'new-password' : 'current-password'}" minlength="${a.mode === 'signup' ? 8 : 1}" data-bind="auth.password" value="${esc(a.password)}" required></label>` : ''}
      <button class="btn" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Please wait…' : a.mode === 'signin' ? 'Sign in' : a.mode === 'signup' ? 'Create account' : 'Email me a reset link'}</button>
    </form>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
      ${a.mode !== 'signin' ? '<button class="link-btn" data-act="authMode" data-arg="signin">Back to sign in</button>' : ''}
      ${a.mode !== 'signup' ? '<button class="link-btn" data-act="authMode" data-arg="signup">First time here? Create your password</button>' : ''}
      ${a.mode !== 'forgot' ? '<button class="link-btn" data-act="authMode" data-arg="forgot">Forgot password?</button>' : ''}
    </div>
    ${install}
  </div>`;
}

function newPasswordView() {
  const a = S.auth;
  return `<div class="auth body">
    <div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Beach Kitchen</h1><p>Choose a new password</p></div></div>
    ${a.msg ? `<div class="msg${a.err ? ' err' : ''}">${esc(a.msg)}</div>` : ''}
    <form data-submit="setNewPassword" style="display:flex;flex-direction:column;gap:12px;">
      <label class="field">New password (8+ characters)<input class="input" id="a-newpass" type="password" autocomplete="new-password" minlength="8" data-bind="auth.password" value="${esc(a.password)}" required></label>
      <button class="btn" type="submit" ${S.busy ? 'disabled' : ''}>Save password</button>
    </form>
  </div>`;
}

function notStaffView() {
  return `<div class="auth body">
    <div class="brand"><img src="icons/icon-192.png" alt=""><div><h1>Beach Kitchen</h1><p>Not on the staff list yet</p></div></div>
    <div class="msg err">You're signed in as <b>${esc(S.session.user.email)}</b>, but this email isn't on the staff list. Ask Mark or Roxanne to add it under Admin → Staff, then tap Try again.</div>
    <button class="btn" data-act="retryMe">Try again</button>
    <button class="btn ghost" data-act="signOut">Sign out</button>
  </div>`;
}

function installButton() {
  if (isStandalone) return '';
  if (S.installEvt) return '<button class="btn ghost" data-act="install">Install the app on this phone</button>';
  if (isIOS) return '<p class="small muted" style="margin:0;">To install on iPhone: tap the Share button, then “Add to Home Screen”.</p>';
  return '';
}

// ---------- counter ----------
function openShiftView() {
  const canOpen = S.me.role !== 'kitchen';
  return `<header class="top"><div class="top-row"><h1>Counter</h1>${livePill()}</div><p>No shift open</p></header>
  <div class="body"><div class="pad">
    <div class="card">
      <h2>Open today's shift</h2>
      <p class="muted" style="margin:0;">Count the cash in the drawer before the first sale. This is the starting float.</p>
      <label class="field">Starting float ($)<input class="input big" id="f-float" inputmode="decimal" data-bind="floatInput" value="${esc(S.floatInput)}" placeholder="${esc(num(S.settings.default_float))}"></label>
      <button class="btn" data-act="openShift" ${canOpen && !S.busy ? '' : 'disabled'}>Open shift</button>
    </div>
  </div></div>`;
}

function counterView() {
  if (S.shift === undefined) return '<div class="splash">Loading…</div>';
  if (!S.shift) return openShiftView();
  const cats = S.cats.filter((c) => S.items.some((i) => i.category_id === c.id));
  if (!S.activeSec && cats[0]) S.activeSec = cats[0].id;
  const pending = S.outbox.length;
  const banners = [
    pending ? `<div class="banner">${pending} order${pending > 1 ? 's' : ''} saved on this phone, waiting for internet. Tell the kitchen by voice.</div>` : '',
    ...S.failed.map((f, i) => `<div class="banner">A saved order (${esc(f.summary)}, ${money(f.total)}) could not be sent: ${esc(f.reason)} <button class="link-btn" data-act="dismissFailed" data-arg="${i}">Dismiss</button></div>`)
  ].join('');
  const total = cartTotal();
  return `<header class="top"><div class="top-row"><h1>Counter</h1>${livePill()}</div>
    <p>Shift open · ${esc(S.me.name)}</p></header>
  <nav class="secnav" id="sec-nav" data-keep-scroll aria-label="Menu sections">
    ${cats.map((c) => `<button class="chip${c.id === S.activeSec ? ' on' : ''}" id="chip-${c.id}" data-act="jump" data-arg="${c.id}">${esc(c.label)}</button>`).join('')}
  </nav>
  <div class="body menu" id="menu-scroll" data-keep-scroll>
    ${banners ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">${banners}</div>` : ''}
    ${cats.map((c) => `<h2 id="sec-${c.id}">${esc(c.label)}</h2><div class="grid">${S.items.filter((i) => i.category_id === c.id).map(itemButton).join('')}</div>`).join('')}
  </div>
  <section class="cart" aria-label="This order">
    ${S.cart.length ? `
      <div class="row"><p class="label">This order</p><button class="link-btn" style="color:var(--danger)" data-act="clearCart">Clear</button></div>
      <div class="cart-lines" id="cart-lines" data-keep-scroll>${S.cart.map(cartLine).join('')}</div>
      <button class="btn paybar" data-act="goPay"><span>Pay</span><span>${money(total)}</span></button>`
    : '<p class="muted" style="margin:4px 0;">Tap items to start an order.</p>'}
  </section>`;
}

function itemButton(it) {
  const inCart = S.cart.filter((l) => l.item_id === it.id).reduce((s, l) => s + l.qty, 0);
  const cls = !it.available ? ' out' : inCart ? ' in' : '';
  const sub = !it.available ? 'Sold out' : `$${num(it.price)}${it.has_sides ? ' · 2 sides' : ''}${inCart ? ' · ×' + inCart : ''}`;
  return `<button class="item${cls}" data-act="tapItem" data-arg="${it.id}" ${it.available ? '' : 'disabled aria-disabled="true"'}><b>${esc(it.name)}</b><span>${sub}</span></button>`;
}

function cartLine(l) {
  const detail = l.sides && l.sides.length ? l.sides.join(' · ') + (l.note ? ` · “${l.note}”` : '') : (l.note ? `“${l.note}”` : '');
  return `<div class="cline">
    <span class="nm"><b>${esc(l.name)}</b>${detail ? `<span class="small muted">${esc(detail)}</span>` : ''}${l.has_sides ? `<button class="link-btn" data-act="editLine" data-arg="${l.key}">Change sides</button>` : ''}</span>
    <span class="stepper"><button data-act="lineMinus" data-arg="${l.key}" aria-label="One less ${esc(l.name)}">−</button><span>${l.qty}</span><button data-act="linePlus" data-arg="${l.key}" aria-label="One more ${esc(l.name)}">+</button></span>
    <span class="pr">$${num(l.price * l.qty)}</span>
  </div>`;
}

function sidesSheet() {
  const sd = S.sides;
  const it = itemById(sd.item_id);
  if (!it) return '';
  const sideItems = S.items.filter((i) => i.category_id === 'sides');
  const ready = sd.picked.length === 2;
  return `<div class="sheet-wrap" data-act="sheetBackdrop"><section class="sheet" aria-label="Choose sides for ${esc(it.name)}">
    <div class="row" style="align-items:flex-start;">
      <div><h1>${esc(it.name)} · $${num(it.price)}</h1><p class="muted" style="margin:4px 0 0;">Choose 2 sides — the same side twice is fine</p></div>
      <button class="icon-btn" style="background:var(--ground);color:var(--ink);" data-act="closeSides" aria-label="Cancel"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="slots"><span class="slot${sd.picked[0] ? ' on' : ''}">1 · ${esc(sd.picked[0] || 'choose')}</span><span class="slot${sd.picked[1] ? ' on' : ''}">2 · ${esc(sd.picked[1] || 'choose')}</span></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${sideItems.map((s) => { const n = sd.picked.filter((p) => p === s.name).length; return `<button class="sideopt${n ? ' on' : ''}" data-act="pickSide" data-arg="${esc(s.name)}" ${s.available ? '' : 'disabled'}><span>${esc(s.name)}${s.available ? '' : ' (sold out)'}</span><em>${n ? '✓ ' + n : ''}</em></button>`; }).join('')}
    </div>
    <label class="field">Note for kitchen (optional)<input class="input" id="f-note" data-bind="sides.note" value="${esc(sd.note)}" maxlength="200" placeholder="e.g. no sauce, extra crispy"></label>
    <button class="btn" data-act="confirmSides" ${ready ? '' : 'disabled'}>${ready ? (sd.editKey ? 'Update order' : 'Add to order') : `Pick ${2 - sd.picked.length} more side${2 - sd.picked.length === 1 ? '' : 's'}`}</button>
  </section></div>`;
}

// ---------- pay ----------
function payView() {
  const total = cartTotal();
  const p = S.pay;
  const isCash = p.method === 'cash';
  const quick = [['Exact', total]];
  [20, 50, 100, 200].forEach((v) => { if (v > total && quick.length < 3) quick.push(['$' + v, v]); });
  const t = tenderedValue();
  const short = t !== null && t < total;
  const ok = S.cart.length && (!isCash || (t !== null && t >= total)) && !S.busy;
  return `<header class="top"><div class="top-row" style="justify-content:flex-start;">
      <button class="icon-btn" data-act="go" data-arg="counter" aria-label="Back to order"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <h1>Pay</h1></div></header>
  <div class="body"><div class="pad">
    <section class="card" aria-label="Order summary">
      ${S.cart.map((l) => `<div class="row"><span><b>${l.qty}×</b> ${esc(l.name)}${l.sides && l.sides.length ? `<br><span class="small muted">${esc(l.sides.join(' · '))}</span>` : ''}</span><b>$${num(l.price * l.qty)}</b></div>`).join('')}
      <div class="row" style="border-top:1px solid var(--line);padding-top:8px;font-size:22px;font-weight:800;"><span>Total</span><span>${money(total)}</span></div>
    </section>
    <div class="seg" role="radiogroup" aria-label="Payment method">
      <button class="opt${isCash ? ' on' : ''}" role="radio" aria-checked="${isCash}" data-act="method" data-arg="cash">Cash</button>
      <button class="opt${!isCash ? ' on' : ''}" role="radio" aria-checked="${!isCash}" data-act="method" data-arg="card">Card</button>
    </div>
    ${isCash ? `
      <p class="label">Cash handed over</p>
      <div class="tenders">
        ${quick.map(([label, v]) => `<button class="tender${!p.other && p.tendered === v ? ' on' : ''}" data-act="tender" data-arg="${v}">${label}</button>`).join('')}
        <button class="tender${p.other ? ' on' : ''}" data-act="tenderOther">Other</button>
      </div>
      ${p.other ? `<label class="field">Amount handed over<input class="input big" id="f-custom" inputmode="decimal" data-bind="pay.custom" data-live value="${esc(p.custom)}" placeholder="e.g. 65"></label>` : ''}
      <div class="change${short ? ' short' : ''}"><span>${short ? 'Not enough — still owed' : 'Change to give'}</span><span>${t === null ? '—' : money(Math.abs(t - total))}</span></div>`
    : `<div class="card" style="font-size:16px;">Take <b>${money(total)}</b> on the bank card machine. When it's approved, tap the button below.</div>`}
  </div></div>
  <div class="foot"><button class="btn" data-act="submitOrder" ${ok ? '' : 'disabled'}>${S.busy ? 'Sending…' : ok ? 'Paid — send to kitchen' : isCash ? 'Tap the cash handed over' : 'Paid — send to kitchen'}</button></div>`;
}

// ---------- kitchen ----------
function kitchenView() {
  const late = S.settings.late_on ? S.settings.late_min : null;
  const solo = views().length < 2;
  return `<header class="top" style="border-bottom:1px solid #263537;"><div class="top-row"><h1>Kitchen</h1>${livePill()}</div>
    <div class="top-row"><p>${S.tickets.length ? `${S.tickets.length} waiting · oldest first` : 'Nothing waiting'}</p>
      <span style="display:flex;gap:12px;">
        <button class="link-btn" data-act="toggleSound">${S.soundOn ? 'Sound on' : 'Turn sound on'}</button>
        ${'wakeLock' in navigator ? `<button class="link-btn" data-act="toggleWake">${S.wakeLock ? 'Screen stays on' : 'Keep screen on'}</button>` : ''}
      </span></div>
  </header>
  <div class="body" id="kitchen-scroll" data-keep-scroll><div class="pad">
    ${S.tickets.length ? S.tickets.map((o) => {
      const mins = Math.floor((S.now - new Date(o.created_at).getTime()) / 60000);
      const isLate = late !== null && mins >= late;
      const isNew = mins < 1;
      return `<article class="ticket${isLate ? ' late' : ''}">
        <div class="th"><b>${pad3(o.number)}${isNew ? '<span class="new-badge">NEW</span>' : ''}</b><span>${mins < 1 ? 'just now' : mins + ' min'}</span></div>
        <div class="tb">
          ${(o.order_lines || []).map((l) => `<p class="ln">${l.qty}× ${esc(l.name)}</p>${l.sides && l.sides.length ? `<p class="sub">+ ${esc(l.sides.join(' · + '))}</p>` : ''}${l.note ? `<p class="note">Note: ${esc(l.note)}</p>` : ''}`).join('')}
          <button class="btn dark" style="margin-top:6px;" data-act="done" data-arg="${o.id}">Done — ready to collect</button>
        </div></article>`;
    }).join('') : '<p class="empty">All caught up. New orders appear here.</p>'}
  </div></div>`;
}

// ---------- close shift ----------
function closeView() {
  const sh = S.shift;
  if (sh === undefined) return '<div class="splash">Loading…</div>';
  if (!sh) {
    return `<header class="top"><div class="top-row"><h1>Close shift</h1>${livePill()}</div><div class="top-row"><p>No shift open</p>${signOutLink()}</div></header>
    <div class="body"><div class="pad"><div class="card"><p style="margin:0;">There's no open shift. Open one from the Counter screen.</p>
    ${views().includes('today') ? '<button class="btn ghost" data-act="go" data-arg="today">See today</button>' : ''}</div></div></div>`;
  }
  const counted = parseMoney(S.closeForm.counted);
  const diff = counted === null ? null : Math.round((counted - Number(sh.expected_cash)) * 100) / 100;
  const needReason = diff !== null && diff !== 0;
  const can = counted !== null && (!needReason || S.closeForm.reason.trim()) && !S.busy && S.me.role !== 'kitchen';
  return `<header class="top"><div class="top-row"><h1>Close shift</h1>${livePill()}</div><div class="top-row"><p>Opened ${bbTime(sh.opened_at)} by ${esc(sh.opened_by)}</p>${signOutLink()}</div></header>
  <div class="body"><div class="pad">
    <section class="card" aria-label="Expected cash">
      <div class="row"><span>Starting float</span><b>${money(sh.opening_float)}</b></div>
      <div class="row"><span>Cash sales (${sh.cash_orders} orders)</span><b>${money(sh.cash_sales)}</b></div>
      <div class="row" style="border-top:1px solid var(--line);padding-top:8px;font-size:19px;font-weight:800;"><span>Should be in drawer</span><span>${money(sh.expected_cash)}</span></div>
    </section>
    <label class="field">Cash counted in drawer<input class="input big" id="f-counted" inputmode="decimal" data-bind="closeForm.counted" data-live value="${esc(S.closeForm.counted)}" placeholder="Type the amount"></label>
    ${diff !== null ? `<div class="diff ${diff === 0 ? 'ok' : 'bad'}"><span>${diff === 0 ? 'Balanced' : diff < 0 ? 'Short by' : 'Over by'}</span><b>${money(Math.abs(diff))}</b></div>` : ''}
    ${needReason ? `<label class="field">Reason (needed if over or short)<input class="input" id="f-reason" data-bind="closeForm.reason" data-live value="${esc(S.closeForm.reason)}" placeholder="e.g. wrong change on order #022"></label>` : ''}
    <div class="row small muted"><span>Card sales (check against the bank machine)</span><b style="color:var(--ink)">${money(sh.card_sales)}</b></div>
    <div class="card"><h2>This shift's orders</h2><p class="small muted" style="margin:0;">Void an order here if it was cancelled or rung up by mistake. Voids are recorded with your name and reason.</p>
      ${(S.shiftOrders || []).length ? `<div class="olist">${orderRows(S.shiftOrders)}</div>` : '<p class="muted" style="margin:0;">No orders yet this shift.</p>'}</div>
  </div></div>
  <div class="foot"><button class="btn" data-act="closeShift" ${can ? '' : 'disabled'}>Close shift</button></div>`;
}

// ---------- today ----------
function todayView() {
  const d = S.todayDate || bbDate();
  const t = S.today;
  const isToday = d === bbDate();
  const maxHourVal = t && t.by_hour.length ? Math.max(...t.by_hour.map((h) => h.orders)) : 1;
  const gap = t ? t.cash_gap : null;
  const margin = t && t.takings ? t.takings - t.food_cost : 0;
  const isAdmin = S.me.role === 'admin';
  return `<header class="top"><div class="top-row"><h1>${isToday ? 'Today' : 'Day report'}</h1>${livePill()}</div>
    <div class="top-row" style="justify-content:flex-start;gap:10px;">
      <button class="icon-btn" data-act="dayShift" data-arg="-1" aria-label="Previous day"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <b style="font-size:16px;">${prettyDate(d)}</b>
      <button class="icon-btn" data-act="dayShift" data-arg="1" aria-label="Next day" ${isToday ? 'disabled style="opacity:.4"' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    </div></header>
  <div class="body" id="today-scroll" data-keep-scroll><div class="pad">
    ${!t ? '<p class="muted">Loading…</p>' : `
    <div class="card" style="gap:2px;"><span class="muted" style="font-weight:600;">Takings</span><span class="big">${money(t.takings)}</span>
      <span class="small muted">${t.orders} orders${t.orders ? ' · average ' + money(t.takings / t.orders) : ''}${t.voids ? ` · ${t.voids} voided (${money(t.void_total)})` : ''}</span></div>
    <div class="tiles">
      <div class="tile"><span>Cash</span><b>${moneyShort(t.cash)}</b></div>
      <div class="tile"><span>Card</span><b>${moneyShort(t.card)}</b></div>
      <div class="tile${gap ? ' bad' : ''}"><span>Cash gap</span><b>${gap === null ? 'not closed' : gap === 0 ? '$0' : (gap < 0 ? '−' : '+') + money(Math.abs(gap))}</b></div>
    </div>
    ${t.food_cost > 0 ? `<div class="card"><div class="row"><span>Food cost (from item costs)</span><b>${money(t.food_cost)}</b></div><div class="row"><span>Gross margin</span><b>${money(margin)} · ${Math.round((margin / t.takings) * 100)}%</b></div></div>` : ''}
    ${t.by_hour.length ? `<div class="card"><h2>Orders by hour</h2><div class="bars">${t.by_hour.map((h) => `<div class="bar"><i style="height:${Math.max(4, Math.round((h.orders / maxHourVal) * 72))}px"></i><small>${h.hour % 12 || 12}${h.hour < 12 ? 'a' : 'p'}</small></div>`).join('')}</div></div>` : ''}
    ${t.best.length ? `<div class="card"><h2>Best sellers</h2>${t.best.map((b) => `<div class="row"><span>${esc(b.name)}</span><b>${b.qty} · ${moneyShort(b.value)}</b></div>`).join('')}</div>` : ''}
    <div class="card"><h2>Orders</h2>${S.todayOrders.length ? `<div class="olist">${orderRows(S.todayOrders)}</div>` : '<p class="muted" style="margin:0;">No orders yet.</p>'}</div>`}
    <div class="card"><div class="row"><span class="small muted">Signed in as ${esc(S.session.user.email)}</span><button class="link-btn" data-act="openAccount">Account</button></div>${installButton()}</div>
  </div></div>`;
}

// ---------- admin (menu, settings, staff) ----------
function adminView() {
  const n = S.newItem;
  const canAdd = n.name.trim() && parseMoney(n.price) !== null;
  return `<header class="top"><div class="top-row"><h1>Admin</h1>${livePill()}</div><p>Menu, settings and staff · changes reach every phone at once</p></header>
  <div class="body" id="admin-scroll" data-keep-scroll><div class="pad">
    <section class="card" aria-label="Settings">
      <h2>Settings</h2>
      <div class="row"><span>Highlight late tickets in orange</span><button class="switch${S.settings.late_on ? ' on' : ''}" role="switch" aria-checked="${S.settings.late_on}" data-act="toggleLate">${S.settings.late_on ? 'On' : 'Off'}</button></div>
      ${S.settings.late_on ? `<div class="row"><span class="muted">Late after</span><span class="stepper"><button data-act="lateStep" data-arg="-1" aria-label="One minute less">−</button><span style="min-width:56px;">${S.settings.late_min} min</span><button data-act="lateStep" data-arg="1" aria-label="One minute more">+</button></span></div>` : ''}
      <div class="row"><span>Usual starting float</span><span class="money-in">$<input class="input mini" id="s-float" inputmode="decimal" value="${esc(num(S.settings.default_float))}" data-change="saveFloat" aria-label="Usual starting float"></span></div>
    </section>

    <section class="card" aria-label="Add an item">
      <h2>Add a menu item</h2>
      <div style="display:flex;gap:8px;">
        <label class="field" style="flex:1 1 auto;">Name<input class="input" id="n-name" data-bind="newItem.name" data-live value="${esc(n.name)}" placeholder="e.g. Flying Fish Cutter"></label>
      </div>
      <div style="display:flex;gap:8px;">
        <label class="field" style="flex:1;">Price $<input class="input" id="n-price" inputmode="decimal" data-bind="newItem.price" data-live value="${esc(n.price)}" placeholder="0"></label>
        <label class="field" style="flex:1;">Ingredient cost $<input class="input" id="n-cost" inputmode="decimal" data-bind="newItem.cost" value="${esc(n.cost)}" placeholder="optional"></label>
      </div>
      <div class="field">Section<div class="chips" role="radiogroup" aria-label="Section">${S.cats.map((c) => `<button class="chip${c.id === n.cat ? ' on' : ''}" role="radio" aria-checked="${c.id === n.cat}" data-act="newCat" data-arg="${c.id}">${esc(c.label)}</button>`).join('')}</div></div>
      <div class="row"><span>Comes with 2 sides</span><button class="switch${n.sides ? ' on' : ''}" role="switch" aria-checked="${n.sides}" data-act="newSides">${n.sides ? 'Yes' : 'No'}</button></div>
      <button class="btn" data-act="addItem" ${canAdd && !S.busy ? '' : 'disabled'}>Add to menu</button>
    </section>

    ${S.cats.map((c) => `<section style="display:flex;flex-direction:column;gap:8px;" aria-label="${esc(c.label)}">
      <p class="label">${esc(c.label)}</p>
      ${S.items.filter((i) => i.category_id === c.id).map((i) => `<div class="mrow${i.available ? '' : ' off'}">
        <span class="nm"><b>${esc(i.name)}</b><span>${i.has_sides ? '2 sides · ' : ''}${i.available ? 'On sale' : 'Sold out today'}</span>
          ${S.removeFor === i.id ? `<span style="display:flex;gap:10px;"><button class="link-btn" style="color:var(--danger)" data-act="removeConfirm" data-arg="${i.id}">Yes, remove</button><button class="link-btn" data-act="removeCancel">Keep</button></span>` : `<button class="link-btn" style="color:var(--ink-2);font-weight:600;" data-act="removeStart" data-arg="${i.id}">Remove from menu</button>`}
        </span>
        <span style="display:flex;flex-direction:column;gap:4px;">
          <span class="money-in" title="Price">$<input class="input mini" id="p-${i.id}" inputmode="decimal" value="${esc(num(i.price))}" data-change="savePrice" data-arg="${i.id}" aria-label="Price of ${esc(i.name)}"></span>
          <span class="money-in small muted" title="Ingredient cost">cost<input class="input mini" style="font-weight:600;" id="c-${i.id}" inputmode="decimal" value="${esc(num(i.cost))}" data-change="saveCost" data-arg="${i.id}" aria-label="Ingredient cost of ${esc(i.name)}"></span>
        </span>
        <button class="switch${i.available ? '' : ' on'}" style="min-width:76px;" data-act="toggleAvail" data-arg="${i.id}">${i.available ? 'Sold out' : 'Back on'}</button>
      </div>`).join('')}
    </section>`).join('')}

    <section class="card" aria-label="Staff">
      <h2>Staff who can sign in</h2>
      ${S.staff.map((p) => `<div class="row"><span><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.email)} · ${p.role}</span></span>${p.email !== S.me.email ? `<button class="link-btn" style="color:var(--danger)" data-act="removeStaff" data-arg="${esc(p.email)}">Remove</button>` : '<span class="small muted">you</span>'}</div>`).join('')}
      <p class="small muted" style="margin:0;">Add someone, then they open the app, tap “First time here?” and create a password with that email.</p>
      <label class="field">Email<input class="input" id="st-email" type="email" inputmode="email" data-bind="newStaff.email" data-live value="${esc(S.newStaff.email)}"></label>
      <label class="field">Name<input class="input" id="st-name" data-bind="newStaff.name" data-live value="${esc(S.newStaff.name)}"></label>
      <div class="field">Role<div class="chips" role="radiogroup" aria-label="Role">${[['counter', 'Counter'], ['kitchen', 'Kitchen only'], ['admin', 'Admin']].map(([k, l]) => `<button class="chip${S.newStaff.role === k ? ' on' : ''}" role="radio" aria-checked="${S.newStaff.role === k}" data-act="staffRole" data-arg="${k}">${l}</button>`).join('')}</div></div>
      <button class="btn" data-act="addStaff" ${S.newStaff.email.includes('@') && S.newStaff.name.trim() ? '' : 'disabled'}>Add staff member</button>
    </section>
  </div></div>`;
}

// ---------- data ----------
async function loadMe() {
  const email = (S.session?.user?.email || '').toLowerCase();
  const { data } = await sb.from('staff').select('*').eq('email', email).maybeSingle();
  S.me = data || null;
}
async function loadMenu() {
  const [c, i, s] = await Promise.all([
    sb.from('categories').select('*').order('sort'),
    sb.from('menu_items').select('*').eq('active', true).order('sort').order('name'),
    sb.from('settings').select('*').eq('id', 1).maybeSingle()
  ]);
  if (!c.error) S.cats = c.data;
  if (!i.error) S.items = i.data.map((x) => ({ ...x, price: Number(x.price), cost: Number(x.cost) }));
  if (!s.error && s.data) S.settings = { ...s.data, default_float: Number(s.data.default_float) };
}
async function loadStaff() {
  if (S.me?.role !== 'admin') return;
  const { data } = await sb.from('staff').select('*').order('name');
  S.staff = data || [];
}
async function loadShift() {
  const { data, error } = await sb.rpc('current_shift');
  if (error) return;
  S.shift = data || null;
  if (S.shift && S.me && S.me.role !== 'kitchen') {
    const r = await sb.from('orders').select('id, number, created_at, total, payment_method, status, void_reason')
      .eq('shift_id', S.shift.id).order('created_at', { ascending: false }).limit(200);
    if (!r.error) S.shiftOrders = r.data;
  } else S.shiftOrders = [];
}
function orderRows(list) {
  const canVoid = S.me && ['admin', 'counter'].includes(S.me.role);
  return list.map((o) => `
      <div class="orow${o.status === 'void' ? ' void' : ''}"><span><b>${pad3(o.number)}</b> · ${bbTime(o.created_at)} · ${o.payment_method}${o.status === 'void' && o.void_reason ? ` · void: ${esc(o.void_reason)}` : ''}</span>
        <span style="display:flex;align-items:center;gap:8px;"><b>${money(o.total)}</b>${canVoid && o.status !== 'void' ? `<button class="link-btn" style="color:var(--danger)" data-act="voidStart" data-arg="${o.id}">Void</button>` : ''}</span></div>
      ${S.voidFor === o.id ? `<div style="display:flex;gap:8px;"><input class="input" id="f-void" data-bind="voidReason" value="${esc(S.voidReason)}" placeholder="Reason, e.g. customer cancelled"><button class="btn warn sm" data-act="voidConfirm" data-arg="${o.id}">Void</button></div>` : ''}`).join('');
}
async function loadTickets() {
  const { data, error } = await sb.from('orders')
    .select('id, number, created_at, order_lines(line_no, name, qty, sides, note)')
    .eq('status', 'new').order('created_at');
  if (error) return;
  const fresh = data.map((o) => ({ ...o, order_lines: (o.order_lines || []).sort((a, b) => a.line_no - b.line_no) }));
  const newOnes = fresh.filter((o) => !S.seenTickets.has(o.id));
  fresh.forEach((o) => S.seenTickets.add(o.id));
  if (S.ticketsLoaded && newOnes.length && S.view === 'kitchen') beep();
  S.ticketsLoaded = true;
  S.tickets = fresh;
}
async function loadToday() {
  const d = S.todayDate || bbDate();
  const [sum, list] = await Promise.all([
    sb.rpc('day_summary', { p_date: d }),
    sb.from('orders').select('id, number, created_at, total, payment_method, status, void_reason').eq('business_date', d).order('created_at', { ascending: false }).limit(100)
  ]);
  if (!sum.error && sum.data) {
    const t = sum.data;
    S.today = { ...t, takings: Number(t.takings), cash: Number(t.cash), card: Number(t.card), void_total: Number(t.void_total), food_cost: Number(t.food_cost), cash_gap: t.cash_gap === null ? null : Number(t.cash_gap), best: t.best || [], by_hour: t.by_hour || [] };
  }
  if (!list.error) S.todayOrders = list.data;
}

let refreshTimer;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const jobs = [loadTickets(), loadShift()];
    if (S.view === 'today') jobs.push(loadToday());
    await Promise.all(jobs);
    render();
  }, 250);
}

function subscribe() {
  if (S.channel) sb.removeChannel(S.channel);
  S.channel = sb.channel('bk-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, async () => { await loadMenu(); render(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async () => { await loadMenu(); render(); })
    .subscribe((status) => { S.live = status === 'SUBSCRIBED'; render(); });
}

async function boot() {
  await Promise.all([loadMe()]);
  if (!S.me) { render(); return; }
  await Promise.all([loadMenu(), loadShift(), loadTickets(), loadStaff()]);
  const v = views();
  if (!v.includes(S.view)) S.view = v[0];
  subscribe();
  flushOutbox();
  render();
}

// ---------- offline queue ----------
let flushing = false;
async function flushOutbox() {
  if (flushing || !S.outbox.length || !navigator.onLine || !S.me) return;
  flushing = true;
  try {
    while (S.outbox.length) {
      const o = S.outbox[0];
      const { data, error } = await sb.rpc('place_order', o.payload);
      if (error) {
        if (isNetworkErr(error)) break;
        S.failed.push({ summary: o.summary, total: o.total, reason: errText(error) });
        saveJSON(FAILED_KEY, S.failed);
      } else {
        toast(`Saved order sent to the kitchen as ${pad3(data.number)}`);
      }
      S.outbox.shift();
      saveJSON(OUTBOX_KEY, S.outbox);
    }
  } finally { flushing = false; render(); }
}

// ---------- sound & screen ----------
let audioCtx;
function beep() {
  if (!S.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((delay) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + 0.2);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + delay); o.stop(audioCtx.currentTime + delay + 0.22);
    });
  } catch { /* audio unavailable */ }
  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

// ---------- scroll spy ----------
let jumpUntil = 0;
function setActiveSec(id) {
  if (!id || id === S.activeSec) return;
  S.activeSec = id;
  document.querySelectorAll('#sec-nav .chip').forEach((c) => c.classList.toggle('on', c.id === 'chip-' + id));
  const nav = document.getElementById('sec-nav'); const chip = document.getElementById('chip-' + id);
  if (nav && chip) nav.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: 'smooth' });
}
function onMenuScroll() {
  if (Date.now() < jumpUntil) return;
  const box = document.getElementById('menu-scroll');
  if (!box) return;
  const heads = [...box.querySelectorAll('h2[id^="sec-"]')];
  if (!heads.length) return;
  let active = heads[0].id.slice(4);
  if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) active = heads[heads.length - 1].id.slice(4);
  else heads.forEach((h) => { if (h.offsetTop - box.offsetTop - box.scrollTop <= 48) active = h.id.slice(4); });
  setActiveSec(active);
}

// ---------- actions ----------
const ACT = {
  go: async (v) => {
    S.view = v;
    if (v === 'today') { S.today = null; render(); await loadToday(); }
    if (v === 'close' || v === 'counter') { await loadShift(); }
    if (v === 'kitchen') { await loadTickets(); }
    if (v === 'menu') { await loadStaff(); }
    render();
  },
  // auth
  authMode: (m) => { S.auth.mode = m; S.auth.msg = ''; render(); },
  authSubmit: async () => {
    const a = S.auth; S.busy = true; a.msg = ''; render();
    try {
      const email = a.email.trim().toLowerCase();
      if (a.mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password: a.password });
        if (error) throw error;
        a.password = '';
      } else if (a.mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password: a.password, options: { emailRedirectTo: APP_URL } });
        if (error) throw error;
        a.password = '';
        if (!data.session) { a.mode = 'signin'; a.msg = 'Check your email and tap the confirmation link. Then come back and sign in.'; a.err = false; }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
        if (error) throw error;
        a.msg = 'If that email is registered, a reset link is on its way.'; a.err = false;
      }
    } catch (e) { a.msg = errText(e); a.err = true; }
    S.busy = false; render();
  },
  setNewPassword: async () => {
    S.busy = true; render();
    const { error } = await sb.auth.updateUser({ password: S.auth.password });
    S.busy = false;
    if (error) { S.auth.msg = errText(error); S.auth.err = true; render(); return; }
    S.auth.password = ''; S.recovering = false; S.auth.msg = '';
    await boot(); toast('Password saved');
  },
  signOut: async () => { S.account = false; await sb.auth.signOut(); S.me = null; S.session = null; S.cart = []; render(); },
  openAccount: () => { S.account = true; S.pw = ''; render(); },
  closeAccount: () => { S.account = false; S.pw = ''; render(); },
  accountBackdrop: (_, el, e) => { if (e.target === el) { S.account = false; S.pw = ''; render(); } },
  savePw: async () => {
    if (S.pw.length < 8) return;
    S.busy = true; render();
    const { error } = await sb.auth.updateUser({ password: S.pw });
    S.busy = false;
    if (error) { toast(errText(error), true); return; }
    S.pw = ''; S.account = false; toast('Password changed');
  },
  retryMe: async () => { await boot(); },
  install: async () => { if (!S.installEvt) return; S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; render(); },

  // counter
  openShift: async () => {
    const f = S.floatInput.trim() === '' ? S.settings.default_float : parseMoney(S.floatInput);
    if (f === null) { toast('Enter the starting float', true); return; }
    S.busy = true; render();
    const { error } = await sb.rpc('open_shift', { p_float: f });
    S.busy = false;
    if (error) { toast(errText(error), true); await loadShift(); render(); return; }
    S.floatInput = ''; await loadShift(); toast('Shift open — ready for orders');
  },
  jump: (id) => {
    jumpUntil = Date.now() + 700;
    setActiveSec(id);
    const box = document.getElementById('menu-scroll'); const h = document.getElementById('sec-' + id);
    if (box && h) box.scrollTo({ top: Math.max(0, h.offsetTop - box.offsetTop - 4), behavior: 'smooth' });
  },
  tapItem: (id) => {
    const it = itemById(id);
    if (!it || !it.available) return;
    if (it.has_sides) { S.sides = { item_id: id, picked: [], note: '', editKey: null }; render(); return; }
    const line = S.cart.find((l) => l.item_id === id && !l.has_sides);
    if (line) line.qty += 1;
    else S.cart.push({ key: crypto.randomUUID(), item_id: id, name: it.name, price: it.price, qty: 1, has_sides: false, sides: [], note: '' });
    render();
  },
  pickSide: (name) => { const p = S.sides.picked; S.sides.picked = p.length >= 2 ? [name] : p.concat([name]); render(); },
  closeSides: () => { S.sides = null; render(); },
  sheetBackdrop: (_, el, e) => { if (e.target === el) { S.sides = null; render(); } },
  confirmSides: () => {
    const sd = S.sides; const it = itemById(sd.item_id);
    if (!it || sd.picked.length !== 2) return;
    const note = sd.note.trim();
    if (sd.editKey) {
      const l = S.cart.find((x) => x.key === sd.editKey);
      if (l) { l.sides = sd.picked.slice(); l.note = note; }
    } else {
      S.cart.push({ key: crypto.randomUUID(), item_id: it.id, name: it.name, price: it.price, qty: 1, has_sides: true, sides: sd.picked.slice(), note });
    }
    S.sides = null; render();
  },
  editLine: (key) => { const l = S.cart.find((x) => x.key === key); if (!l) return; S.sides = { item_id: l.item_id, picked: l.sides.slice(), note: l.note, editKey: key }; render(); },
  linePlus: (key) => { const l = S.cart.find((x) => x.key === key); if (l && l.qty < 99) l.qty += 1; render(); },
  lineMinus: (key) => { const l = S.cart.find((x) => x.key === key); if (!l) return; l.qty -= 1; if (l.qty <= 0) S.cart = S.cart.filter((x) => x.key !== key); render(); },
  clearCart: () => { S.cart = []; render(); },
  goPay: () => { S.pay = { method: 'cash', tendered: null, other: false, custom: '' }; S.view = 'pay'; render(); },
  method: (m) => { S.pay.method = m; if (m === 'card') { S.pay.tendered = null; S.pay.other = false; S.pay.custom = ''; } render(); },
  tender: (v) => { S.pay.tendered = Number(v); S.pay.other = false; render(); },
  tenderOther: () => { S.pay.other = true; S.pay.tendered = null; render(); setTimeout(() => document.getElementById('f-custom')?.focus(), 0); },
  submitOrder: async () => {
    const total = cartTotal(); const isCash = S.pay.method === 'cash'; const t = tenderedValue();
    if (!S.cart.length || (isCash && (t === null || t < total)) || S.busy) return;
    const payload = {
      p_id: crypto.randomUUID(), p_method: S.pay.method, p_tendered: isCash ? t : null,
      p_lines: S.cart.map((l) => ({ item_id: l.item_id, qty: l.qty, sides: l.sides, note: l.note }))
    };
    const summary = S.cart.map((l) => `${l.qty}× ${l.name}`).join(', ');
    S.busy = true; render();
    const { data, error } = await sb.rpc('place_order', payload);
    S.busy = false;
    if (error && isNetworkErr(error)) {
      S.outbox.push({ payload, total, summary, at: Date.now() }); saveJSON(OUTBOX_KEY, S.outbox);
      S.cart = []; S.view = 'counter';
      toast('No internet — order saved on this phone and will send automatically. Tell the kitchen by voice.', true);
      return;
    }
    if (error) { toast(errText(error), true); render(); return; }
    S.cart = []; S.view = 'counter';
    toast(`Order ${pad3(data.number)} sent to kitchen · ${money(data.total)}${isCash && t > total ? ` · change ${money(t - total)}` : ''}`);
    loadShift().then(render);
  },
  dismissFailed: (i) => { S.failed.splice(Number(i), 1); saveJSON(FAILED_KEY, S.failed); render(); },

  // kitchen
  done: async (id) => {
    const before = S.tickets; S.tickets = S.tickets.filter((o) => o.id !== id); render();
    const { error } = await sb.rpc('mark_done', { p_id: id });
    if (error) { S.tickets = before; toast(errText(error), true); render(); }
  },
  toggleSound: () => { S.soundOn = !S.soundOn; if (S.soundOn) { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); beep(); } render(); },
  toggleWake: async () => {
    try {
      if (S.wakeLock) { await S.wakeLock.release(); S.wakeLock = null; }
      else { S.wakeLock = await navigator.wakeLock.request('screen'); S.wakeLock.addEventListener('release', () => { S.wakeLock = null; render(); }); }
    } catch { toast("This phone won't keep the screen on — change its auto-lock setting instead", true); }
    render();
  },

  // close
  closeShift: async () => {
    const c = parseMoney(S.closeForm.counted);
    if (c === null) return;
    S.busy = true; render();
    const { data, error } = await sb.rpc('close_shift', { p_counted: c, p_reason: S.closeForm.reason });
    S.busy = false;
    if (error) { toast(errText(error), true); render(); return; }
    S.closeForm = { counted: '', reason: '' };
    await loadShift();
    const d = Number(data.difference);
    toast(d === 0 ? 'Shift closed · cash balanced' : `Shift closed · ${d < 0 ? 'short' : 'over'} ${money(Math.abs(d))}`);
    if (views().includes('today')) ACT.go('today'); else render();
  },

  // today
  dayShift: async (n) => {
    const cur = S.todayDate || bbDate();
    const next = shiftDate(cur, Number(n));
    if (next > bbDate()) return;
    S.todayDate = next === bbDate() ? null : next; S.today = null; S.voidFor = null; render();
    await loadToday(); render();
  },
  voidStart: (id) => { S.voidFor = S.voidFor === id ? null : id; S.voidReason = ''; render(); setTimeout(() => document.getElementById('f-void')?.focus(), 0); },
  voidConfirm: async (id) => {
    if (!S.voidReason.trim()) { toast('Give a reason for the void', true); return; }
    const { error } = await sb.rpc('void_order', { p_id: id, p_reason: S.voidReason });
    if (error) { toast(errText(error), true); return; }
    S.voidFor = null; S.voidReason = ''; await Promise.all([loadToday(), loadTickets(), loadShift()]); toast('Order voided'); render();
  },

  // admin
  toggleLate: async () => { await saveSettings({ late_on: !S.settings.late_on }); },
  lateStep: async (n) => { await saveSettings({ late_min: Math.min(60, Math.max(1, S.settings.late_min + Number(n))) }); },
  saveFloat: async (_, el) => { const v = parseMoney(el.value); if (v === null) { render(); return; } await saveSettings({ default_float: v }); },
  newCat: (c) => { S.newItem.cat = c; render(); },
  newSides: () => { S.newItem.sides = !S.newItem.sides; render(); },
  addItem: async () => {
    const n = S.newItem; const price = parseMoney(n.price); const cost = parseMoney(n.cost) ?? 0;
    if (!n.name.trim() || price === null) return;
    const sort = Math.max(0, ...S.items.filter((i) => i.category_id === n.cat).map((i) => i.sort)) + 1;
    S.busy = true; render();
    const { error } = await sb.from('menu_items').insert({ category_id: n.cat, name: n.name.trim(), price, cost, has_sides: n.sides, sort });
    S.busy = false;
    if (error) { toast(errText(error), true); render(); return; }
    toast(`${n.name.trim()} added to the menu`);
    S.newItem = { name: '', price: '', cost: '', cat: n.cat, sides: false };
    await loadMenu(); render();
  },
  savePrice: async (id, el) => { const v = parseMoney(el.value); if (v === null) { render(); return; } await updateItem(id, { price: v }, 'Price saved'); },
  saveCost: async (id, el) => { const v = parseMoney(el.value); if (v === null) { render(); return; } await updateItem(id, { cost: v }, 'Cost saved'); },
  toggleAvail: async (id) => { const it = itemById(id); if (it) await updateItem(id, { available: !it.available }, it.available ? `${it.name} marked sold out` : `${it.name} back on sale`); },
  removeStart: (id) => { S.removeFor = id; render(); },
  removeCancel: () => { S.removeFor = null; render(); },
  removeConfirm: async (id) => { S.removeFor = null; await updateItem(id, { active: false }, 'Removed from the menu'); },
  staffRole: (r) => { S.newStaff.role = r; render(); },
  addStaff: async () => {
    const st = S.newStaff; const email = st.email.trim().toLowerCase();
    const { error } = await sb.from('staff').insert({ email, name: st.name.trim(), role: st.role });
    if (error) { toast(error.code === '23505' ? 'That email is already on the list' : errText(error), true); return; }
    S.newStaff = { email: '', name: '', role: 'counter' };
    await loadStaff(); toast(`${email} added. They can now create a password in the app.`);
  },
  removeStaff: async (email) => {
    const { error } = await sb.from('staff').delete().eq('email', email);
    if (error) { toast(errText(error), true); return; }
    await loadStaff(); toast(`${email} removed`);
  }
};

async function saveSettings(patch) {
  const { error } = await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) { toast(errText(error), true); return; }
  Object.assign(S.settings, patch); render();
}
async function updateItem(id, patch, msg) {
  const { error } = await sb.from('menu_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast(errText(error), true); await loadMenu(); render(); return; }
  await loadMenu(); toast(msg);
}

// ---------- events ----------
function setPath(path, val) { const parts = path.split('.'); let o = S; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = val; }
$app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = ACT[b.dataset.act];
  if (fn) fn(b.dataset.arg, b, e);
});
$app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind) { setPath(t.dataset.bind, t.value); if ('live' in t.dataset) render(); }
});
$app.addEventListener('change', (e) => { const t = e.target; if (t.dataset.change && ACT[t.dataset.change]) ACT[t.dataset.change](t.dataset.arg, t, e); });
$app.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.change) e.target.blur(); });
$app.addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; if (f.dataset.submit && ACT[f.dataset.submit]) ACT[f.dataset.submit](f.dataset.arg, f, e); });
$app.addEventListener('scroll', (e) => { if (e.target.id === 'menu-scroll') onMenuScroll(); }, true);

window.addEventListener('online', () => { S.online = true; render(); flushOutbox(); refreshSoon(); });
window.addEventListener('offline', () => { S.online = false; render(); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; render(); });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.me) {
    refreshSoon(); flushOutbox();
    if (S.wantWake && !S.wakeLock && 'wakeLock' in navigator) { try { S.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ } }
  }
});
setInterval(() => { S.now = Date.now(); if (S.me && S.view === 'kitchen') render(); }, 15000);
setInterval(() => { if (S.me) { flushOutbox(); if (S.view === 'kitchen' && !S.live) refreshSoon(); } }, 20000);

sb.auth.onAuthStateChange((event, session) => {
  S.session = session;
  if (event === 'PASSWORD_RECOVERY') { S.recovering = true; S.auth.msg = ''; render(); return; }
  if (event === 'SIGNED_IN' && !S.recovering) { setTimeout(() => boot(), 0); }
  if (event === 'SIGNED_OUT') { S.me = null; if (S.channel) { sb.removeChannel(S.channel); S.channel = null; } render(); }
});

(async () => {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.ready = true;
  if (S.session && !S.recovering) await boot(); else render();
})();

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  // When a new version of the app takes over, reload once so the new code runs.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || S.cart.length || S.busy) return;
    reloaded = true; location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
      })
      .catch(() => { /* offline shell unavailable */ });
  });
}
