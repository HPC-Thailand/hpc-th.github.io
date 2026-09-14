/* ============================================================
   HPC Thailand — shared core
   i18n, theme, site chrome, data loading
   ============================================================ */

/** Site root, derived from this script's own URL (works at / and /systems/ alike). */
export const ROOT = new URL('../../', import.meta.url).href;

export const SITE = {
  repo: 'HPC-Thailand/hpc-th.github.io',
  repoUrl: 'https://github.com/HPC-Thailand/hpc-th.github.io',
  domain: 'hpc.in.th',
};

/* ---------------------------------------------------------------- language */

const LANGS = ['th', 'en'];
const LANG_KEY = 'hpcth.lang';

export function detectLang() {
  const fromQuery = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromQuery)) return fromQuery;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en';
}

export let lang = detectLang();

const langListeners = new Set();

/** Register a callback fired whenever the language changes. Runs immediately too. */
export function onLangChange(fn) {
  langListeners.add(fn);
  fn(lang);
  return () => langListeners.delete(fn);
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  document.documentElement.lang = next;
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === next));
  });
  applyI18n();
  langListeners.forEach((fn) => fn(next));
}

/** Pick the right string out of a `{th, en}` object; tolerates plain strings. */
export function pick(value, l = lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[l] ?? value.en ?? value.th ?? '';
}

/* ---------------------------------------------------------------- ui strings */

let UI = {};

export async function loadUI() {
  UI = await loadJSON('data/ui.json');
  return UI;
}

/** `t('nav.timeline')` → localised string. Supports `{n}` style placeholders. */
export function t(path, vars) {
  const node = path.split('.').reduce((o, k) => (o == null ? o : o[k]), UI);
  let out = pick(node);
  if (!out) return path;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/**
 * Localise static markup.
 *   <span data-i18n="nav.timeline"></span>
 *   <input data-i18n-attr="placeholder:timeline.searchPlaceholder">
 */
export function applyI18n(scope = document) {
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  const title = document.querySelector('title[data-i18n]');
  if (title) document.title = `${t(title.dataset.i18n)} — HPC Thailand`;
}

/* ---------------------------------------------------------------- data */

const cache = new Map();

/** Fetch a JSON file relative to the site root, with a shared in-memory cache. */
export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(new URL(path, ROOT)).then((r) => {
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });
  cache.set(path, p);
  return p;
}

/* ---------------------------------------------------------------- theme */

const THEME_KEY = 'hpcth.theme';

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = saved || system;
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- helpers */

export const h = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
};

/** Escape a value for safe interpolation into an HTML template string. */
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const num = (n) => (n == null ? '—' : new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US').format(n));

/** Buddhist-era year. The source slides contain a few typos; we always compute. */
export const be = (ce) => (ce == null ? null : ce + 543);

export function formatDate(iso, l = lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return new Intl.DateTimeFormat(l === 'th' ? 'th-TH' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

/** Fade sections in as they scroll into view; a no-op when motion is reduced. */
export function observeReveal(scope = document) {
  const items = scope.querySelectorAll('.reveal:not(.in)');
  if (!items.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  items.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------- chrome */

const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

const NAV = [
  { key: 'timeline', href: '' },
  { key: 'systems', href: 'systems/' },
  { key: 'reference', href: 'reference/' },
  { key: 'stats', href: 'stats/' },
  { key: 'events', href: 'events/' },
  { key: 'submit', href: 'submit/' },
];

function navMarkup(active) {
  return NAV.map(({ key, href }) => {
    const url = new URL(href, ROOT).pathname;
    const current = key === active ? ' aria-current="page"' : '';
    return `<li><a href="${url}"${current} data-i18n="nav.${key}"></a></li>`;
  }).join('');
}

/** Render the shared header + footer. `active` is a NAV key. */
export function renderChrome(active) {
  const home = new URL('', ROOT).pathname;

  document.getElementById('site-header')?.replaceChildren(h(`
    <div class="container">
      <a class="brand" href="${home}">
        <span class="brand-mark" aria-hidden="true">HPC</span>
        <span class="brand-text">Thailand<small>${SITE.domain}</small></span>
      </a>
      <nav class="site-nav" id="site-nav" aria-label="Main"><ul>${navMarkup(active)}</ul></nav>
      <div class="header-tools">
        <div class="lang-switch" role="group" aria-label="Language">
          <button type="button" data-lang="th" aria-pressed="${lang === 'th'}">ไทย</button>
          <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
        </div>
        <button type="button" class="icon-btn" id="theme-toggle" aria-label="Toggle colour theme">${ICON.sun}</button>
        <button type="button" class="icon-btn nav-toggle" id="nav-toggle"
                aria-label="Menu" aria-expanded="false" aria-controls="site-nav">${ICON.menu}</button>
      </div>
    </div>`));

  document.getElementById('site-footer')?.replaceChildren(h(`
    <div class="container">
      <div class="footer-grid">
        <div class="footer-about">
          <h4 data-i18n="footer.about"></h4>
          <p data-i18n="footer.aboutText"></p>
        </div>
        <div>
          <h4 data-i18n="footer.sections"></h4>
          <ul>${navMarkup(null)}</ul>
        </div>
        <div>
          <h4 data-i18n="footer.contribute"></h4>
          <ul>
            <li><a href="${SITE.repoUrl}" rel="noopener" data-i18n="footer.sourceCode"></a></li>
            <li><a href="${SITE.repoUrl}/issues/new" rel="noopener" data-i18n="footer.reportIssue"></a></li>
            <li><a href="${new URL('submit/', ROOT).pathname}" data-i18n="nav.submit"></a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} HPC Thailand</span>
        <span data-i18n="footer.license"></span>
        <span class="spacer" id="footer-updated"></span>
      </div>
    </div>`));

  // Interactions
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.addEventListener('click', () => setLang(b.dataset.lang));
  });

  const themeBtn = document.getElementById('theme-toggle');
  const syncThemeIcon = () => {
    themeBtn.innerHTML = document.documentElement.dataset.theme === 'dark' ? ICON.sun : ICON.moon;
  };
  syncThemeIcon();
  themeBtn?.addEventListener('click', () => { toggleTheme(); syncThemeIcon(); });

  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  navToggle?.addEventListener('click', () => {
    const open = nav.dataset.open !== 'true';
    nav.dataset.open = String(open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.dataset.open = 'false'; navToggle?.setAttribute('aria-expanded', 'false'); }
  });

  document.documentElement.lang = lang;
  applyI18n();
}

/** One-call boot used by every page. Returns once UI strings are ready. */
export async function boot(active) {
  initTheme();
  await loadUI();
  renderChrome(active);
  return { lang };
}

/** Stamp "last updated" into the footer. */
export function setUpdated(iso) {
  const el = document.getElementById('footer-updated');
  if (!el || !iso) return;
  onLangChange(() => { el.textContent = `${t('footer.lastUpdated')}: ${formatDate(iso)}`; });
}
