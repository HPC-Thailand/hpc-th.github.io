/* ============================================================
   HPC Thailand — reference document archive
   ============================================================ */

import {
  boot, loadJSON, pick, t, esc, num, onLangChange, observeReveal, setUpdated, ROOT,
} from './core.js';

let DATA = null;
const state = { category: 'all', q: '' };

/* ---------------------------------------------------------------- helpers */

const ICON = {
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/></svg>',
  html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
};

/** Human-readable file size. Documents here run from a few KB to a few MB. */
function fileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Local files keep their original names, so the path needs encoding. */
function href(doc) {
  return doc.url || new URL(encodeURI(doc.file), ROOT).href;
}

function isExternal(doc) {
  return Boolean(doc.url);
}

/* ---------------------------------------------------------------- render */

function docMarkup(doc) {
  const meta = [
    doc.year ? `<span class="mono">${doc.year}</span>` : '',
    doc.pages ? `${num(doc.pages)} ${t('reference.pages')}` : '',
    doc.bytes ? fileSize(doc.bytes) : '',
    doc.author ? esc(doc.author) : '',
  ].filter(Boolean).join(' · ');

  const action = isExternal(doc)
    ? `<span class="doc-action">${ICON.link} ${t('reference.openSource')}</span>`
    : `<span class="doc-action">${ICON[doc.format] || ICON.pdf} ${t('reference.download')}</span>`;

  return `<a class="doc-card reveal${doc.featured ? ' is-featured' : ''}"
      href="${esc(href(doc))}" target="_blank"
      rel="noopener${isExternal(doc) ? ' noreferrer' : ''}"
      ${isExternal(doc) ? '' : 'download'} id="d-${esc(doc.id)}">
      <span class="doc-icon" data-format="${esc(doc.format)}">${ICON[doc.format] || ICON.pdf}</span>
      <span class="doc-body">
        <span class="doc-title">${esc(pick(doc.title))}</span>
        <span class="doc-desc">${esc(pick(doc.description))}</span>
        ${meta ? `<span class="doc-meta">${meta}</span>` : ''}
        ${doc.tags?.length ? `<span class="doc-tags">${doc.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</span>` : ''}
      </span>
      ${action}
    </a>`;
}

function matches(doc) {
  const q = state.q.trim().toLowerCase();
  if (state.category !== 'all' && doc.category !== state.category) return false;
  if (!q) return true;
  return [
    doc.id, doc.year, doc.author, doc.file, ...(doc.tags || []),
    pick(doc.title, 'th'), pick(doc.title, 'en'),
    pick(doc.description, 'th'), pick(doc.description, 'en'),
  ].join(' ').toLowerCase().includes(q);
}

function paint() {
  const wrap = document.getElementById('doc-groups');
  const visible = DATA.documents.filter(matches);

  document.getElementById('doc-count').textContent =
    t('reference.resultCount', { n: num(visible.length) });

  if (!visible.length) {
    wrap.innerHTML = `<div class="empty-state"><p>${t('reference.empty')}</p>
      <button type="button" class="btn btn-ghost" id="clear-docs">${t('timeline.clear')}</button></div>`;
    document.getElementById('clear-docs').addEventListener('click', () => {
      state.category = 'all';
      state.q = '';
      document.getElementById('doc-search').value = '';
      syncChips();
      paint();
    });
    return;
  }

  wrap.innerHTML = DATA.categories.map((cat) => {
    const docs = visible.filter((d) => d.category === cat.id);
    if (!docs.length) return '';
    return `<section class="doc-group">
        <header class="doc-group-head reveal">
          <h2>${esc(pick(cat.label))}</h2>
          <p>${esc(pick(cat.blurb))}</p>
        </header>
        <div class="doc-list">${docs.map(docMarkup).join('')}</div>
      </section>`;
  }).join('');

  observeReveal(wrap);
}

function syncChips() {
  document.querySelectorAll('#doc-chips .chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.cat === state.category));
  });
}

function buildChips() {
  const wrap = document.getElementById('doc-chips');
  wrap.innerHTML = [
    `<button type="button" class="chip" data-cat="all">${t('timeline.filterAll')}
       <small>${DATA.documents.length}</small></button>`,
    ...DATA.categories.map((c) => {
      const n = DATA.documents.filter((d) => d.category === c.id).length;
      return `<button type="button" class="chip" data-cat="${esc(c.id)}">${esc(pick(c.label))}
        <small>${n}</small></button>`;
    }),
  ].join('');
  wrap.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => { state.category = c.dataset.cat; syncChips(); paint(); });
  });
  syncChips();
}

/* ---------------------------------------------------------------- boot */

(async function main() {
  await boot('reference');
  DATA = await loadJSON('data/reference.json');
  setUpdated(DATA.updated);

  onLangChange(() => {
    document.getElementById('doc-note').textContent = pick(DATA.note);
    buildChips();
    paint();
  });

  const search = document.getElementById('doc-search');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = search.value; paint(); }, 140);
  });

  observeReveal();
}());
