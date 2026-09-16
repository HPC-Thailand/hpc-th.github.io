/* ============================================================
   HPC Thailand — aggregate statistics
   ============================================================ */

import {
  boot, loadJSON, pick, t, num, onLangChange, observeReveal, setUpdated,
} from './core.js';

let DATA = null;
const charts = [];

const PALETTE = ['#2e7bc4', '#15427a', '#d97a1a', '#3f9f83', '#7a5cc4', '#c4566f',
  '#5b8fbd', '#8a9db2', '#e0a94f', '#5cb0a0', '#9b7fd4'];

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------------------------------------------------------------- KPIs */

function kpis() {
  const s = DATA.systems;
  const sum = (fn) => s.reduce((a, x) => a + (fn(x) || 0), 0);
  return [
    ['stats.totalCores', sum((x) => x.compute.total.total_cpu_cores)],
    ['stats.totalGpus', sum((x) => x.compute.total.total_gpu_count)],
    ['stats.totalSystems', s.length],
    ['stats.totalOrgs', new Set(s.map((x) => x.organization?.name_en)).size],
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
        titleFont: { family: 'Prompt' },
        bodyFont: { family: 'Prompt' },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { family: 'Prompt', size: 11 } } },
      y: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { family: 'Prompt', size: 11 } } },
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
          labels: { color: css('--ink-2'), font: { family: 'Prompt', size: 11 }, boxWidth: 12, padding: 10 },
        },
      },
    },
  }));
}

function paintCharts() {
  charts.splice(0).forEach((c) => c.destroy());

  const cores = (s) => s.compute.total.total_cpu_cores;
  const gpus = (s) => s.compute.total.total_gpu_count;
  const byCores = [...DATA.systems].sort((a, b) => cores(b) - cores(a));
  makeBar('chart-cores', byCores.map((s) => s.name), byCores.map(cores));

  const byGpu = [...DATA.systems]
    .filter((s) => gpus(s))
    .sort((a, b) => gpus(b) - gpus(a));
  makeBar('chart-gpu', byGpu.map((s) => s.name), byGpu.map(gpus));

  const region = tally((s) => s.organization?.province || '—');
  makeDoughnut('chart-region', region.map(([k]) => k), region.map(([, v]) => v));

  const orgType = tally((s) => {
    const ty = s.organization?.org_type;
    return ty ? t(`systems.orgTypeLabels.${ty}`) : '—';
  });
  makeDoughnut('chart-orgtype', orgType.map(([k]) => k), orgType.map(([, v]) => v));

  const vendor = tally((s) => s.compute.gpu_types.map((g) => g.model));
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
