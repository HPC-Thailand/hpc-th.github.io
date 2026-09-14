/* ============================================================
   HPC Thailand — submission helper
   Builds a pre-filled GitHub issue; nothing is sent from the browser.
   ============================================================ */

import { boot, t, pick, esc, onLangChange, observeReveal, SITE } from './core.js';

const TYPES = [
  { value: 'system', key: 'submit.typeSystem', label: 'system' },
  { value: 'stats', key: 'submit.typeStats', label: 'stats' },
  { value: 'event', key: 'submit.typeEvent', label: 'event' },
  { value: 'timeline', key: 'submit.typeTimeline', label: 'timeline' },
  { value: 'correction', key: 'submit.typeCorrection', label: 'correction' },
];

const TEMPLATES = {
  system: `{
  "id": "short-slug",
  "name": "System name",
  "organization": "Organisation",
  "yearCommissioned": 2025,
  "status": "operational",
  "specs": {
    "cpu":     { "type": "AMD EPYC 9654", "cores": 0, "nodes": 0 },
    "gpu":     { "type": "NVIDIA H100", "memory": "80GB", "count": 0, "nodes": 0 },
    "storage": { "nvme": "0TB NVMe", "disk": "0PB HDD", "filesystem": "Lustre" },
    "network": { "frontend": "25GbE", "compute": "InfiniBand NDR", "backend": "100GbE" },
    "cooling": "Direct liquid cooling"
  },
  "applications": "AI, CFD, Bioinformatics",
  "consortium": ["ThaiSC"],
  "location": {
    "address": "Full postal address",
    "city": { "th": "จังหวัด", "en": "Province" },
    "coordinates": [100.0000, 13.0000]
  },
  "contact": "team@example.ac.th",
  "website": "https://example.ac.th/hpc",
  "verifiedOn": "2026-01-31"
}`,
  event: `{
  "id": "event-slug-2026",
  "title":       { "th": "ชื่องาน", "en": "Event title" },
  "subtitle":    { "th": "คำโปรย", "en": "Strapline" },
  "description": { "th": "รายละเอียด", "en": "Details" },
  "organizer":   { "th": "ผู้จัด", "en": "Organiser" },
  "location":    { "th": "สถานที่", "en": "Venue" },
  "format": "onsite",
  "start": "2026-03-12",
  "end": "2026-03-14",
  "time": "09:00–16:30",
  "url": "https://example.ac.th/event",
  "image": "assets/img/events/event-slug-2026.jpg",
  "tags": ["NSTDA"]
}`,
  timeline: `{
  "id": "2026-something",
  "year": 2026,
  "era": "gen4",
  "kind": "milestone",
  "category": "system",
  "title": { "th": "หัวข้อ", "en": "Title" },
  "org": { "th": "หน่วยงาน", "en": "Organisation" },
  "body": { "th": "รายละเอียด", "en": "Details" },
  "tags": ["Tag"],
  "link": "https://example.ac.th"
}`,
};
TEMPLATES.stats = TEMPLATES.system;
TEMPLATES.correction = '';

const FILE_FOR = {
  system: 'data/systems.json',
  stats: 'data/systems.json',
  event: 'data/events.json',
  timeline: 'data/timeline.json',
  correction: '—',
};

function currentType() {
  return document.getElementById('f-type').value;
}

function buildBody() {
  const get = (id) => document.getElementById(id).value.trim();
  const type = currentType();
  const typeLabel = t(TYPES.find((x) => x.value === type).key);

  return [
    `**${t('submit.formType')}:** ${typeLabel} (\`${type}\`)`,
    `**${t('submit.fieldName')}:** ${get('f-name') || '—'}`,
    `**${t('submit.fieldOrg')}:** ${get('f-org') || '—'}`,
    `**${t('submit.fieldContactName')}:** ${get('f-contact') || '—'}`,
    get('f-email') ? `**${t('submit.fieldContactEmail')}:** ${get('f-email')}` : null,
    '',
    `### ${t('submit.fieldDetails')}`,
    '',
    get('f-details') || '—',
    '',
    '---',
    `_Target file: \`${FILE_FOR[type]}\` · submitted via hpc.in.th/submit_`,
  ].filter((l) => l !== null).join('\n');
}

function refreshPreview() {
  document.getElementById('preview').textContent = buildBody();
  document.getElementById('step-2').innerHTML =
    esc(t('submit.step2', { file: '\u0000' })).replace('\u0000', `<code class="mono">${esc(FILE_FOR[currentType()])}</code>`);
  const tpl = document.getElementById('tpl-json');
  const body = TEMPLATES[currentType()];
  tpl.textContent = body || '—';
  document.getElementById('tpl-wrap').hidden = !body;
}

function submitIssue() {
  const type = currentType();
  const name = document.getElementById('f-name').value.trim();
  const title = `[${type}] ${name || 'submission'}`;
  const url = new URL(`${SITE.repoUrl}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', buildBody());
  url.searchParams.set('labels', `data,${type}`);
  window.open(url.href, '_blank', 'noopener');
}

function buildTypeOptions() {
  const sel = document.getElementById('f-type');
  const keep = sel.value;
  sel.innerHTML = TYPES.map((x) => `<option value="${x.value}">${esc(t(x.key))}</option>`).join('');
  const fromQuery = new URLSearchParams(location.search).get('type');
  sel.value = keep || (TYPES.some((x) => x.value === fromQuery) ? fromQuery : 'system');
}

(async function main() {
  await boot('submit');

  onLangChange(() => { buildTypeOptions(); refreshPreview(); });

  document.getElementById('submit-form').addEventListener('input', refreshPreview);
  document.getElementById('f-type').addEventListener('change', refreshPreview);
  document.getElementById('submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitIssue();
  });

  document.getElementById('copy-preview').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(buildBody());
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.textContent = t('submit.copied');
      setTimeout(() => { btn.textContent = original; }, 1600);
    } catch { /* clipboard blocked */ }
  });

  observeReveal();
}());
