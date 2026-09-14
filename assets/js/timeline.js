/* ============================================================
   HPC Thailand — historical timeline (home page)
   ============================================================ */

import {
  boot, loadJSON, pick, t, esc, be, num, onLangChange,
  observeReveal, setUpdated, ROOT,
} from './core.js';

const ICON_SLIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';

let DATA = null;
let firstPaint = true;
const state = { era: 'all', q: '' };

/* ---------------------------------------------------------------- render */

function nodeMarkup(entry) {
  if (entry.year == null) {
    return `<div class="tl-node"><div class="tl-year"><b>?</b></div></div>`;
  }
  if (entry.kind === 'milestone') {
    return `<div class="tl-node"><span class="tl-dot"></span></div>`;
  }
  return `<div class="tl-node">
      <div class="tl-year">
        <b>${entry.year}</b>
        <span>${t('timeline.beShort')} ${be(entry.year)}</span>
      </div>
    </div>`;
}

function eraCard(entry) {
  const era = DATA.eras.find((e) => e.id === entry.era);
  return `<div class="tl-era-card">
      <div class="tl-era-label">${esc(pick(era?.label))}</div>
      <h2>${esc(pick(entry.title))}</h2>
      ${entry.subtitle ? `<p>${esc(pick(entry.subtitle))}</p>` : ''}
    </div>`;
}

function milestoneCard(entry) {
  const parts = [];

  if (entry.year != null && entry.kind === 'milestone') {
    parts.push(`<div class="tl-sub"><span class="mono">${entry.year}</span> · ${t('timeline.beShort')} ${be(entry.year)}</div>`);
  }
  parts.push(`<h3>${esc(pick(entry.title))}</h3>`);
  if (entry.subtitle) parts.push(`<div class="tl-sub">${esc(pick(entry.subtitle))}</div>`);
  if (entry.org) parts.push(`<p class="tl-org">${esc(pick(entry.org))}</p>`);
  if (entry.body) parts.push(`<p class="tl-body">${esc(pick(entry.body))}</p>`);

  if (entry.bullets?.length) {
    parts.push(`<ul class="tl-bullets">${entry.bullets
      .map((b) => `<li data-tone="${esc(b.tone || 'neutral')}">${esc(pick(b))}</li>`)
      .join('')}</ul>`);
  }

  if (entry.stats?.length) {
    parts.push(`<div class="tl-stats">${entry.stats
      .map((s) => `<div class="tl-stat"><b>${esc(s.value)}</b><span>${esc(pick(s.label))}</span></div>`)
      .join('')}</div>`);
  }

  const foot = [];
  entry.badges?.forEach((b) => foot.push(`<span class="badge">${esc(pick(b))}</span>`));
  entry.tags?.forEach((tag) => foot.push(`<span class="tag">${esc(tag)}</span>`));
  if (entry.link) {
    foot.push(`<a class="tag" href="${esc(entry.link)}" rel="noopener" target="_blank">↗ ${esc(new URL(entry.link).hostname.replace(/^www\./, ''))}</a>`);
  }
  if (entry.source) {
    foot.push(`<button type="button" class="tl-source" data-slide="${esc(entry.source)}">
        ${ICON_SLIDE}<span>${t('timeline.sourceSlide')}</span>
      </button>`);
  }
  if (foot.length) parts.push(`<div class="tl-foot">${foot.join('')}</div>`);

  return `<div class="tl-card">${parts.join('')}</div>`;
}

function entryMarkup(entry) {
  const body = entry.kind === 'era' ? eraCard(entry) : milestoneCard(entry);
  // Only the very first paint animates in; re-renders (filter, language) swap instantly.
  return `<article class="tl-item${firstPaint ? ' reveal' : ''}" data-kind="${esc(entry.kind)}" data-era="${esc(entry.era)}" id="e-${esc(entry.id)}">
      ${nodeMarkup(entry)}${body}
    </article>`;
}

/* ---------------------------------------------------------------- filtering */

function haystack(entry) {
  const bits = [entry.year, entry.id, ...(entry.tags || [])];
  for (const key of ['title', 'subtitle', 'org', 'body']) {
    if (entry[key]) bits.push(pick(entry[key], 'th'), pick(entry[key], 'en'));
  }
  entry.bullets?.forEach((b) => bits.push(pick(b, 'th'), pick(b, 'en')));
  return bits.join(' ').toLowerCase();
}

function visibleEntries() {
  const q = state.q.trim().toLowerCase();
  return DATA.entries.filter((e) => {
    if (state.era !== 'all' && e.era !== state.era) return false;
    if (!q) return true;
    // Era banners stay visible only when they match the query themselves.
    return haystack(e).includes(q);
  });
}

function paint() {
  const list = document.getElementById('timeline');
  const items = visibleEntries();
  const countEl = document.getElementById('result-count');

  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p>${t('timeline.empty')}</p>
      <button type="button" class="btn btn-ghost" id="clear-filters">${t('timeline.clear')}</button></div>`;
    countEl.textContent = '';
    document.getElementById('clear-filters')?.addEventListener('click', () => {
      state.era = 'all';
      state.q = '';
      document.getElementById('tl-search').value = '';
      syncChips();
      paint();
    });
    return;
  }

  list.innerHTML = items.map(entryMarkup).join('');
  countEl.textContent = t('timeline.resultCount', { n: num(items.filter((e) => e.kind !== 'era').length) });
  if (firstPaint) { observeReveal(list); firstPaint = false; }
}

function syncChips() {
  document.querySelectorAll('#era-chips .chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.era === state.era));
  });
}

function buildChips() {
  const wrap = document.getElementById('era-chips');
  const counts = Object.fromEntries(DATA.eras.map((e) => [
    e.id, DATA.entries.filter((x) => x.era === e.id && x.kind !== 'era').length,
  ]));
  const all = `<button type="button" class="chip" data-era="all" aria-pressed="true">${t('timeline.filterAll')}
      <small>${DATA.entries.filter((x) => x.kind !== 'era').length}</small></button>`;
  wrap.innerHTML = all + DATA.eras.map((e) => `
    <button type="button" class="chip" data-era="${esc(e.id)}" aria-pressed="false"
            title="${esc(pick(e.tagline))}">${esc(pick(e.label))} <small>${counts[e.id]}</small></button>`).join('');
  wrap.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => { state.era = c.dataset.era; syncChips(); paint(); });
  });
}

/* ---------------------------------------------------------------- hero stats */

async function heroStats() {
  const years = DATA.entries.filter((e) => e.year).map((e) => e.year);
  const span = new Date().getFullYear() - Math.min(...years);
  const milestones = DATA.entries.filter((e) => e.kind !== 'era' && e.kind !== 'open').length;
  const generations = DATA.eras.length - 1;

  let systems = 0;
  try { systems = (await loadJSON('data/systems.json')).systems.length; } catch { /* optional */ }

  const cards = [
    ['home.statYears', span],
    ['home.statMilestones', milestones],
    ['home.statGenerations', generations],
    ['home.statSystems', systems],
  ];
  const el = document.getElementById('hero-stats');
  const render = () => {
    el.innerHTML = cards
      .filter(([, v]) => v)
      .map(([key, v]) => `<div class="stat-card"><b>${num(v)}</b><span>${t(key)}</span></div>`)
      .join('');
  };
  render();
  onLangChange(render);
}

/* ---------------------------------------------------------------- slides */

const SLIDES = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);

function buildSlides() {
  const grid = document.getElementById('slide-grid');
  grid.innerHTML = SLIDES.map((id, i) => `
    <figure class="slide-thumb" role="button" tabindex="0" data-slide="${id}">
      <img src="${new URL(`assets/img/slides/${id}-thumb.jpg`, ROOT)}" loading="lazy"
           width="640" height="360" alt="${t('slides.page')} ${i + 1}">
      <figcaption>${t('slides.page')} ${i + 1}</figcaption>
    </figure>`).join('');
}

function openSlide(id) {
  const dlg = document.getElementById('lightbox');
  const idx = SLIDES.indexOf(id);
  if (idx < 0) return;
  dlg.dataset.index = String(idx);
  dlg.querySelector('img').src = new URL(`assets/img/slides/${id}.jpg`, ROOT).href;
  dlg.querySelector('#lb-label').textContent = `${t('slides.page')} ${idx + 1} / ${SLIDES.length}`;
  if (!dlg.open) dlg.showModal();
}

function stepSlide(delta) {
  const dlg = document.getElementById('lightbox');
  const next = (Number(dlg.dataset.index) + delta + SLIDES.length) % SLIDES.length;
  openSlide(SLIDES[next]);
}

function initLightbox() {
  const dlg = document.getElementById('lightbox');
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-slide]');
    if (trigger) openSlide(trigger.dataset.slide);
  });
  document.addEventListener('keydown', (e) => {
    const fig = e.target.closest?.('.slide-thumb');
    if (fig && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSlide(fig.dataset.slide); }
    if (!dlg.open) return;
    if (e.key === 'ArrowRight') stepSlide(1);
    if (e.key === 'ArrowLeft') stepSlide(-1);
  });
  dlg.querySelector('#lb-prev').addEventListener('click', () => stepSlide(-1));
  dlg.querySelector('#lb-next').addEventListener('click', () => stepSlide(1));
  dlg.querySelector('#lb-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

/* ---------------------------------------------------------------- boot */

(async function main() {
  await boot('timeline');
  DATA = await loadJSON('data/timeline.json');
  setUpdated(DATA.updated);

  // Fires once immediately, then again on every language switch.
  onLangChange(() => {
    document.getElementById('source-note').textContent = pick(DATA.sourceNote);
    buildChips();
    syncChips();
    buildSlides();
    paint();
  });

  heroStats();
  initLightbox();
  observeReveal();

  const search = document.getElementById('tl-search');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = search.value; paint(); }, 140);
  });
}());
