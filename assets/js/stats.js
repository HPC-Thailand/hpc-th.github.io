/* ============================================================
   hpc.in.th — aggregate statistics
   ============================================================ */

import {
  boot, loadJSON, pick, t, num, onLangChange, observeReveal, setUpdated,
} from './core.js';

let DATA = null;
const charts = [];

/* Categorical series, led by the brand Amber and kept distinguishable in both
   themes. Amber carries the first (largest) series; the rest step away in hue. */
const PALETTE = ['#ff8a1f', '#4a4f58', '#1f7a6b', '#9e4e00', '#5a4fcf', '#b23a6b',
  '#ffb870', '#8a929e', '#3fa08e', '#8c84e0', '#d97aa0'];

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------------------------------------------------------------- KPIs */

function kpis() {
  const s = DATA.systems;
  return [
    ['stats.totalCores', s.reduce((a, x) => a + (x.specs.cpu.cores || 0), 0)],
    ['stats.totalGpus', s.reduce((a, x) => a + (x.specs.gpu?.count || 0), 0)],
    ['stats.totalSystems', s.length],
    ['stats.totalOrgs', new Set(s.map((x) => x.organization)).size],
  ];
}

function paintKpis() {
  document.getElementById('kpi-grid').innerHTML = kpis()
    .map(([key, v]) => `<div class="stat-card reveal"><b>${num(v)}</b><span>${t(key)}</span></div>`)
    .join('');
  observeReveal(document.getElementById('kpi-grid'));
}

/* ---------------------------------------------------------------- charts */

function tally(keyFn) {
  const m = new Map();
  DATA.systems.forEach((s) => {
    const k = keyFn(s);
    (Array.isArray(k) ? k : [k]).forEach((kk) => m.set(kk, (m.get(kk) || 0) + 1));
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function baseOptions(horizontal) {
  const grid = css('--line');
  const tick = css('--muted');
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: css('--ink'),
        titleFont: { family: 'IBM Plex Sans' },
        bodyFont: { family: 'IBM Plex Sans' },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { family: 'IBM Plex Sans', size: 11 } } },
      y: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { family: 'IBM Plex Sans', size: 11 } } },
    },
  };
}

function makeBar(id, labels, values, horizontal = true) {
  const el = document.getElementById(id);
  if (!el) return;
  charts.push(new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 5,
        maxBarThickness: 26,
      }],
    },
    options: baseOptions(horizontal),
  }));
}

function makeDoughnut(id, labels, values) {
  const el = document.getElementById(id);
  if (!el) return;
  charts.push(new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: css('--surface'),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: css('--ink-2'), font: { family: 'IBM Plex Sans', size: 11 }, boxWidth: 12, padding: 10 },
        },
      },
    },
  }));
}

function paintCharts() {
  charts.splice(0).forEach((c) => c.destroy());

  const byCores = [...DATA.systems].sort((a, b) => b.specs.cpu.cores - a.specs.cpu.cores);
  makeBar('chart-cores', byCores.map((s) => s.name), byCores.map((s) => s.specs.cpu.cores));

  const byGpu = [...DATA.systems]
    .filter((s) => s.specs.gpu?.count)
    .sort((a, b) => b.specs.gpu.count - a.specs.gpu.count);
  makeBar('chart-gpu', byGpu.map((s) => s.name), byGpu.map((s) => s.specs.gpu.count));

  const region = tally((s) => pick(s.location.city));
  makeDoughnut('chart-region', region.map(([k]) => k), region.map(([, v]) => v));

  const cons = tally((s) => s.consortium);
  makeDoughnut('chart-consortium', cons.map(([k]) => k), cons.map(([, v]) => v));

  const vendor = tally((s) => s.specs.gpu?.type || '—');
  makeDoughnut('chart-vendor', vendor.map(([k]) => k), vendor.map(([, v]) => v));
}

/* ---------------------------------------------------------------- boot */

(async function main() {
  await boot('stats');
  DATA = await loadJSON('data/systems.json');
  setUpdated(DATA.updated);

  onLangChange(() => {
    paintKpis();
    paintCharts();
    document.getElementById('stats-note').textContent = pick(DATA.note);
  });

  // Repaint charts when the theme flips so grid/legend colours stay readable.
  document.getElementById('theme-toggle')?.addEventListener('click', () => setTimeout(paintCharts, 30));

  observeReveal();
}());
