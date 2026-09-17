/* ============================================================
   hpc.in.th — systems directory + map
   ============================================================ */

import {
  boot, loadJSON, pick, t, tData, esc, num, onLangChange, observeReveal, setUpdated,
} from './core.js';

let DATA = null;
let map = null;
let markerLayer = null;

const state = { q: '', orgType: 'all', sort: 'cores' };

const cpuModels = (s) => s.compute.cpu_types.map((c) => c.model);
const gpuModels = (s) => s.compute.gpu_types.map((g) => g.model);
const orgOf = (s) => s.organization || null;
const orgName = (s) => {
  const o = orgOf(s);
  if (!o) return '';
  return pick({ th: o.name_th, en: o.name_en });
};

/* ---------------------------------------------------------------- cards */

function specRow(label, value) {
  if (!value) return '';
  return `<div class="sys-spec"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function typeLines(items, fmt) {
  return items.map((x, i) => (i ? '<br>' : '') + fmt(x)).join('');
}

function storageLine(s) {
  const st = s.storage;
  const parts = [esc(st.filesystem)];
  if (st.nvme_pb) parts.push(`NVMe ${num(st.nvme_pb)} PB`);
  if (st.disk_pb) parts.push(`HDD ${num(st.disk_pb)} PB`);
  parts.push(`<span class="text-muted">${num(st.capacity_pb)} PB</span>`);
  return parts.join(' · ');
}

function softwareLine(s) {
  const sw = s.software_stack;
  return [esc(sw.os), esc(tData('systems.schedulerLabels', sw.scheduler)), ...sw.frameworks.map(esc)]
    .filter(Boolean).join(' · ');
}

function performanceLine(s) {
  const p = s.performance;
  const parts = [];
  if (p.peak_pflops) parts.push(`Rpeak ${num(p.peak_pflops)} PFLOPS`);
  if (p.sustained_pflops) parts.push(`Rmax ${num(p.sustained_pflops)} PFLOPS`);
  if (p.power_consumption_kw) parts.push(`${num(p.power_consumption_kw)} kW`);
  return parts.join(' · ');
}

function accessLine(s) {
  return [
    tData('systems.accessLabels', s.access.model),
    ...s.access.user_base.map((u) => tData('systems.userBaseLabels', u)),
  ].map(esc).join(' · ');
}

function cardMarkup(s) {
  const { cpu_types, gpu_types, total } = s.compute;
  const org = orgOf(s);
  const coreUnit = t('systems.cores');
  const nodeUnit = t('systems.nodes');
  const specs = [
    specRow(t('systems.cpu'), typeLines(cpu_types, (c) =>
      `<b>${num(c.nodes * c.cores_per_node)}</b> ${coreUnit} · ${esc(c.model)} × ${num(c.nodes)} ${nodeUnit}`
      + (c.sockets_per_node ? ` <span class="text-muted">${num(c.sockets_per_node)}S</span>` : '')
      + (c.memory_per_node_gb ? ` <span class="text-muted">${num(c.memory_per_node_gb)} GB/node</span>` : ''))),
    total.total_gpu_count
      ? specRow(t('systems.gpu'), typeLines(gpu_types, (g) =>
        `<b>${num(g.nodes * g.gpu_per_node)}</b> × ${esc(g.model)}`
        + (g.memory_per_unit_gb ? ` ${num(g.memory_per_unit_gb)} GB` : '')
        + ` <span class="text-muted">× ${num(g.nodes)} ${nodeUnit}</span>`))
      : '',
    specRow(t('systems.storage'), storageLine(s)),
    specRow(t('systems.network'), `${esc(s.network.interconnect_type)} <span class="text-muted">${num(s.network.bandwidth_gbps)} Gb/s</span>`),
    specRow(t('systems.cooling'), esc(tData('systems.coolingLabels', s.cooling))),
    specRow(t('systems.software'), softwareLine(s)),
    specRow(t('systems.performance'), performanceLine(s)),
    specRow(t('systems.access'), accessLine(s)),
    org ? specRow(t('systems.location'), esc(tData('systems.provinceLabels', org.province))) : '',
  ].join('');

  const foot = [
    `<span class="tag">${t(`systems.statusLabels.${s.status}`)}</span>`,
    org ? `<span class="tag">${t(`systems.orgTypeLabels.${org.org_type}`)}</span>` : '',
    s.verifiedOn
      ? ''
      : `<span class="badge-warn">${pickLocal('awaiting')}</span>`,
    org?.website ? `<a class="tag" href="${esc(org.website)}" target="_blank" rel="noopener">↗ ${t('systems.website')}</a>` : '',
  ].filter(Boolean).join('');

  return `<article class="sys-card reveal" id="s-${esc(s.system_id)}">
      <div class="sys-head">
        <h3>${esc(s.name)}</h3>
        ${s.commissioned_date ? `<span class="year">${s.commissioned_date.slice(0, 4)}</span>` : ''}
      </div>
      <p class="sys-org">${esc(orgName(s))}${s.vendor && s.vendor !== 'Unknown' ? ` · ${esc(s.vendor)}` : ''}</p>
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
    const org = orgOf(s);
    if (state.orgType !== 'all' && org?.org_type !== state.orgType) return false;
    if (!q) return true;
    return [
      s.name, org?.name_th, org?.name_en, s.vendor, s.storage.filesystem,
      s.network.interconnect_type, org?.province, tData('systems.provinceLabels', org?.province),
      ...cpuModels(s), ...gpuModels(s),
    ].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const by = {
    cores: (a, b) => b.compute.total.total_cpu_cores - a.compute.total.total_cpu_cores,
    gpu: (a, b) => b.compute.total.total_gpu_count - a.compute.total.total_gpu_count,
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
    const org = orgOf(s);
    const lat = org?.coordinates?.lat;
    const lng = org?.coordinates?.lng;
    if (lat == null || lng == null) return;
    bounds.push([lat, lng]);
    const { total } = s.compute;
    const radius = 7 + Math.min(13, Math.sqrt(total.total_cpu_cores) / 28);
    L.circleMarker([lat, lng], {
      radius,
      color: '#9e4e00',
      weight: 2,
      fillColor: '#ff8a1f',
      fillOpacity: 0.6,
    })
      .bindPopup(`<h4>${esc(s.name)}</h4>
        <div>${esc(orgName(s))}</div>
        <div class="text-muted">${num(total.total_cpu_cores)} ${t('systems.cores')}${
          total.total_gpu_count ? ` · ${num(total.total_gpu_count)} × ${esc(gpuModels(s).join(' / '))}` : ''}</div>`)
      .addTo(markerLayer);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 8 });
}

/* ---------------------------------------------------------------- controls */

function buildControls() {
  const types = [...new Set(DATA.systems.map((s) => orgOf(s)?.org_type).filter(Boolean))].sort();
  const chips = document.getElementById('consortium-chips');
  chips.innerHTML = [
    `<button type="button" class="chip" data-o="all" aria-pressed="${state.orgType === 'all'}">${t('timeline.filterAll')}
       <small>${DATA.systems.length}</small></button>`,
    ...types.map((ty) => `<button type="button" class="chip" data-o="${esc(ty)}"
       aria-pressed="${state.orgType === ty}">${esc(t(`systems.orgTypeLabels.${ty}`))}
       <small>${DATA.systems.filter((s) => orgOf(s)?.org_type === ty).length}</small></button>`),
  ].join('');
  chips.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.orgType = btn.dataset.o;
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
