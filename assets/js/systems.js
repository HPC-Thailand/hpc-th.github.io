/* ============================================================
   HPC Thailand — systems directory + map
   ============================================================ */

import {
  boot, loadJSON, pick, t, esc, num, onLangChange, observeReveal, setUpdated,
} from './core.js';

let DATA = null;
let map = null;
let markerLayer = null;

const state = { q: '', consortium: 'all', sort: 'cores' };

/* ---------------------------------------------------------------- cards */

function specRow(label, value) {
  if (!value) return '';
  return `<div class="sys-spec"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function cardMarkup(s) {
  const { cpu, gpu, storage, network, cooling } = s.specs;
  const specs = [
    specRow(t('systems.cpu'), `<b>${num(cpu.cores)}</b> ${t('systems.cores')} · ${esc(cpu.type)}`),
    gpu?.count ? specRow(t('systems.gpu'), `<b>${num(gpu.count)}</b> × ${esc(gpu.type)}${gpu.memory ? ` ${esc(gpu.memory)}` : ''}`) : '',
    specRow(t('systems.storage'), `${esc(storage.nvme)} · ${esc(storage.disk)} <span class="text-muted">(${esc(storage.filesystem)})</span>`),
    specRow(t('systems.network'), esc(network.compute)),
    specRow(t('systems.cooling'), esc(cooling)),
    specRow(t('systems.applications'), esc(s.applications)),
    specRow(t('systems.location'), esc(pick(s.location.city))),
  ].join('');

  const foot = [
    ...s.consortium.map((c) => `<span class="tag">${esc(c)}</span>`),
    s.verifiedOn
      ? ''
      : `<span class="badge-warn">${pickLocal('awaiting')}</span>`,
    s.website ? `<a class="tag" href="${esc(s.website)}" target="_blank" rel="noopener">↗ ${t('systems.website')}</a>` : '',
  ].filter(Boolean).join('');

  return `<article class="sys-card reveal" id="s-${esc(s.id)}">
      <div class="sys-head">
        <h3>${esc(s.name)}</h3>
        ${s.yearCommissioned ? `<span class="year">${s.yearCommissioned}</span>` : ''}
      </div>
      <p class="sys-org">${esc(s.organization)}</p>
      <dl class="sys-specs">${specs}</dl>
      <div class="sys-foot">${foot}</div>
    </article>`;
}

function pickLocal(key) {
  const strings = {
    awaiting: { th: 'รอการยืนยัน', en: 'awaiting verification' },
  };
  return esc(pick(strings[key]));
}

/* ---------------------------------------------------------------- filtering */

function filtered() {
  const q = state.q.trim().toLowerCase();
  const out = DATA.systems.filter((s) => {
    if (state.consortium !== 'all' && !s.consortium.includes(state.consortium)) return false;
    if (!q) return true;
    return [
      s.name, s.organization, s.applications, s.specs.cpu.type, s.specs.gpu?.type,
      pick(s.location.city, 'th'), pick(s.location.city, 'en'), s.location.address,
    ].join(' ').toLowerCase().includes(q);
  });

  const by = {
    cores: (a, b) => b.specs.cpu.cores - a.specs.cpu.cores,
    gpu: (a, b) => (b.specs.gpu?.count || 0) - (a.specs.gpu?.count || 0),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return out.sort(by[state.sort] || by.cores);
}

function paint() {
  const items = filtered();
  const grid = document.getElementById('sys-grid');
  grid.innerHTML = items.length
    ? items.map(cardMarkup).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><p>${t('systems.empty')}</p></div>`;
  document.getElementById('sys-count').textContent =
    t('systems.resultCount', { n: num(items.length) });
  observeReveal(grid);
  drawMarkers(items);
}

/* ---------------------------------------------------------------- map */

function initMap() {
  if (typeof L === 'undefined') return;
  map = L.map('map', { scrollWheelZoom: false }).setView([13.2, 100.9], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function drawMarkers(items) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  const bounds = [];
  items.forEach((s) => {
    const [lon, lat] = s.location.coordinates; // stored GeoJSON-style
    if (lat == null || lon == null) return;
    bounds.push([lat, lon]);
    const radius = 7 + Math.min(13, Math.sqrt(s.specs.cpu.cores) / 28);
    L.circleMarker([lat, lon], {
      radius,
      color: '#15427a',
      weight: 2,
      fillColor: '#2e7bc4',
      fillOpacity: 0.6,
    })
      .bindPopup(`<h4>${esc(s.name)}</h4>
        <div>${esc(s.organization)}</div>
        <div class="text-muted">${num(s.specs.cpu.cores)} ${t('systems.cores')}${
          s.specs.gpu?.count ? ` · ${num(s.specs.gpu.count)} × ${esc(s.specs.gpu.type)}` : ''}</div>`)
      .addTo(markerLayer);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 8 });
}

/* ---------------------------------------------------------------- controls */

function buildControls() {
  const consortia = [...new Set(DATA.systems.flatMap((s) => s.consortium))].sort();
  const chips = document.getElementById('consortium-chips');
  chips.innerHTML = [
    `<button type="button" class="chip" data-c="all" aria-pressed="${state.consortium === 'all'}">${t('timeline.filterAll')}
       <small>${DATA.systems.length}</small></button>`,
    ...consortia.map((c) => `<button type="button" class="chip" data-c="${esc(c)}"
       aria-pressed="${state.consortium === c}">${esc(c)}
       <small>${DATA.systems.filter((s) => s.consortium.includes(c)).length}</small></button>`),
  ].join('');
  chips.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.consortium = btn.dataset.c;
      chips.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      paint();
    });
  });

  const sort = document.getElementById('sys-sort');
  sort.innerHTML = [['cores', 'sortCores'], ['gpu', 'sortGpu'], ['name', 'sortName']]
    .map(([v, k]) => `<option value="${v}"${state.sort === v ? ' selected' : ''}>${t(`systems.${k}`)}</option>`)
    .join('');
}

/* ---------------------------------------------------------------- boot */

(async function main() {
  await boot('systems');
  DATA = await loadJSON('data/systems.json');
  setUpdated(DATA.updated);

  initMap();

  onLangChange(() => {
    document.getElementById('sys-note').textContent = pick(DATA.note);
    buildControls();
    paint();
  });

  const search = document.getElementById('sys-search');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = search.value; paint(); }, 140);
  });

  document.getElementById('sys-sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    paint();
  });

  observeReveal();
}());
