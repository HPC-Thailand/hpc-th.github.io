/* ============================================================
   hpc.in.th — submission helper
   Builds a pre-filled GitHub issue; nothing is sent from the browser.
   Each submission type gets its own schema-shaped fields; the JSON
   block is assembled for you — no need to write JSON by hand.
   ============================================================ */

import { boot, t, pick, esc, onLangChange, observeReveal, SITE } from './core.js';

const TYPES = [
  { value: 'system', key: 'submit.typeSystem', label: 'system' },
  { value: 'stats', key: 'submit.typeStats', label: 'stats' },
  { value: 'event', key: 'submit.typeEvent', label: 'event' },
  { value: 'timeline', key: 'submit.typeTimeline', label: 'timeline' },
  { value: 'correction', key: 'submit.typeCorrection', label: 'correction' },
];

const FILE_FOR = {
  system: 'data/systems.json',
  stats: 'data/systems.json',
  event: 'data/events.json',
  timeline: 'data/timeline.json',
  correction: '—',
};

/* Field spec: { id, label, schema?, type?, options?, placeholder?, hint?, section? }
   'label' is the plain-language question shown to the contributor; 'schema' is the
   underlying JSON path, shown as a small reference tag so Option 2 (raw JSON/PR) stays
   mappable. A field entry with only `section` set renders as a group heading instead
   of an input — labels ending in " *" are treated as required. */

const SYSTEM_FIELDS = [
  { section: 'Identity & status' },
  { id: 'sys_id', label: 'System ID *', schema: 'system_id', placeholder: 'thaisc-example', hint: 'Lowercase letters, numbers and hyphens only' },
  { id: 'sys_name', label: 'System name *', schema: 'name', placeholder: 'e.g. LANTA' },
  { id: 'sys_status', label: 'Status', schema: 'status', type: 'select', options: ['operational', 'planned', 'maintenance', 'decommissioned'] },
  { id: 'sys_comm', label: 'Commissioned date', schema: 'commissioned_date', type: 'date' },
  { id: 'sys_decomm', label: 'Decommissioned date', schema: 'decommissioned_date', type: 'date' },
  { id: 'sys_vendor', label: 'Vendor', schema: 'vendor', placeholder: 'e.g. Dell Technologies' },

  { section: 'Organisation' },
  { id: 'org_name_th', label: 'Organisation name (Thai) *', schema: 'organization.name_th', placeholder: 'เช่น มหาวิทยาลัยตัวอย่าง' },
  { id: 'org_name_en', label: 'Organisation name (English) *', schema: 'organization.name_en', placeholder: 'Example University' },
  { id: 'org_type', label: 'Organisation type *', schema: 'organization.org_type', type: 'select', options: ['government_research', 'university', 'private', 'state_enterprise'] },
  { id: 'org_province', label: 'Province *', schema: 'organization.province', placeholder: 'e.g. Bangkok' },
  { id: 'org_lat', label: 'Latitude *', schema: 'organization.coordinates.lat', type: 'number', placeholder: '13.7563' },
  { id: 'org_lng', label: 'Longitude *', schema: 'organization.coordinates.lng', type: 'number', placeholder: '100.5018' },
  { id: 'org_site', label: 'Organisation website', schema: 'organization.website', type: 'url', placeholder: 'https://example.ac.th' },
  { id: 'org_email', label: 'Organisation contact email', schema: 'organization.contact_email', type: 'email', placeholder: 'hpc@example.ac.th', hint: 'A team mailbox, not a personal address' },

  { section: 'Compute' },
  { id: 'cpu_lines', label: 'CPU models — one per line', schema: 'compute.cpu_types', type: 'textarea',
    placeholder: 'model | nodes | sockets_per_node | cores_per_node | memory_gb\nAMD EPYC 9654 | 100 | 2 | 192 | 1536', hint: 'model | nodes | sockets/node | cores/node | GB/node — leave a slot blank if unknown' },
  { id: 'gpu_lines', label: 'GPU models — one per line', schema: 'compute.gpu_types', type: 'textarea',
    placeholder: 'model | nodes | gpu_per_node | memory_gb\nNVIDIA H100 | 20 | 8 | 80', hint: 'model | nodes | GPUs/node | GB/unit — leave empty entirely for CPU-only systems' },
  { id: 'tot_nodes', label: 'Total nodes', schema: 'compute.total.total_nodes', type: 'number' },
  { id: 'tot_cores', label: 'Total CPU cores', schema: 'compute.total.total_cpu_cores', type: 'number' },
  { id: 'tot_gpus', label: 'Total GPU count', schema: 'compute.total.total_gpu_count', type: 'number' },
  { id: 'tot_mem', label: 'Total memory (TB)', schema: 'compute.total.total_memory_tb', type: 'number' },
  { id: 'cooling', label: 'Cooling', schema: 'cooling', placeholder: 'e.g. direct liquid cooling' },

  { section: 'Network & storage' },
  { id: 'ic_type', label: 'Interconnect type', schema: 'network.interconnect_type', placeholder: 'e.g. InfiniBand NDR' },
  { id: 'bw_gbps', label: 'Interconnect bandwidth (Gb/s)', schema: 'network.bandwidth_gbps', type: 'number' },
  { id: 'st_type', label: 'Storage type', schema: 'storage.type', type: 'select', options: ['parallel_fs', 'object', 'hybrid'] },
  { id: 'fs', label: 'Filesystem', schema: 'storage.filesystem', placeholder: 'e.g. Lustre' },
  { id: 'cap_pb', label: 'Storage capacity (PB)', schema: 'storage.capacity_pb', type: 'number', hint: 'Usable total, across all tiers' },
  { id: 'nvme_pb', label: 'NVMe / flash tier (PB)', schema: 'storage.nvme_pb', type: 'number' },
  { id: 'disk_pb', label: 'Disk / cold tier (PB)', schema: 'storage.disk_pb', type: 'number' },

  { section: 'Performance' },
  { id: 'peak_pflops', label: 'Peak performance — Rpeak (PFLOPS)', schema: 'performance.peak_pflops', type: 'number' },
  { id: 'sust_pflops', label: 'Sustained performance — Rmax (PFLOPS)', schema: 'performance.sustained_pflops', type: 'number' },
  { id: 'power_kw', label: 'Power consumption (kW)', schema: 'performance.power_consumption_kw', type: 'number' },

  { section: 'Software & access' },
  { id: 'os', label: 'Operating system', schema: 'software_stack.os', placeholder: 'e.g. Rocky Linux 9' },
  { id: 'sched', label: 'Scheduler', schema: 'software_stack.scheduler', type: 'select', options: ['slurm', 'pbs', 'lsf', 'other'] },
  { id: 'frameworks', label: 'Frameworks & libraries', schema: 'software_stack.frameworks', placeholder: 'MPI, PyTorch, TensorFlow', hint: 'Comma-separated' },
  { id: 'acc_model', label: 'Access model', schema: 'access.model', type: 'select', options: ['open_academic', 'restricted', 'commercial', 'hybrid'] },
  { id: 'acc_users', label: 'User base', schema: 'access.user_base', placeholder: 'academic, government, industry, sea_region', hint: 'Comma-separated, from: academic, government, industry, sea_region' },
];

const EVENT_FIELDS = [
  { id: 'ev_title_th', label: 'Title (Thai) *', schema: 'title.th', placeholder: 'เช่น งานสัมมนา HPC และ AI ประจำปี 2569' },
  { id: 'ev_title_en', label: 'Title (English) *', schema: 'title.en', placeholder: 'e.g. Thailand HPC & AI Summit 2026' },
  { id: 'ev_sub_th', label: 'Subtitle (Thai)', schema: 'subtitle.th', placeholder: 'คำโปรยสั้น ๆ เกี่ยวกับกิจกรรม' },
  { id: 'ev_sub_en', label: 'Subtitle (English)', schema: 'subtitle.en', placeholder: 'A short one-line strapline' },
  { id: 'ev_desc_th', label: 'Description (Thai)', schema: 'description.th', type: 'textarea', placeholder: 'รายละเอียดกิจกรรม เช่น กำหนดการ ผู้บรรยาย' },
  { id: 'ev_desc_en', label: 'Description (English)', schema: 'description.en', type: 'textarea', placeholder: 'Event details — agenda, speakers, etc.' },
  { id: 'ev_org_th', label: 'Organiser (Thai)', schema: 'organizer.th', placeholder: 'เช่น เนคเทค สวทช.' },
  { id: 'ev_org_en', label: 'Organiser (English)', schema: 'organizer.en', placeholder: 'e.g. NECTEC, NSTDA' },
  { id: 'ev_loc_th', label: 'Location (Thai)', schema: 'location.th', placeholder: 'สถานที่จัดงาน' },
  { id: 'ev_loc_en', label: 'Location (English)', schema: 'location.en', placeholder: 'Venue name, city' },
  { id: 'ev_format', label: 'Format', schema: 'format', type: 'select', options: ['onsite', 'online', 'hybrid'] },
  { id: 'ev_start', label: 'Start date *', schema: 'start', type: 'date' },
  { id: 'ev_end', label: 'End date', schema: 'end', type: 'date' },
  { id: 'ev_time', label: 'Time', schema: 'time', placeholder: '09:00–16:30' },
  { id: 'ev_url', label: 'Event URL', schema: 'url', type: 'url', placeholder: 'https://example.ac.th/event' },
  { id: 'ev_tags', label: 'Tags', schema: 'tags', placeholder: 'NSTDA, Workshop', hint: 'Comma-separated' },
  { id: 'ev_image', label: 'Banner image path', schema: 'image', placeholder: 'assets/img/events/event-slug-2026.jpg' },
];

const TIMELINE_FIELDS = [
  { id: 'tl_year', label: 'Year *', schema: 'year', type: 'number', placeholder: '2026' },
  { id: 'tl_era', label: 'Era *', schema: 'era', placeholder: 'e.g. gen4' },
  { id: 'tl_kind', label: 'Kind *', schema: 'kind', type: 'select', options: ['era', 'highlight', 'milestone', 'open'] },
  { id: 'tl_category', label: 'Category', schema: 'category', placeholder: 'e.g. system' },
  { id: 'tl_title_th', label: 'Title (Thai) *', schema: 'title.th', placeholder: 'เช่น เปิดใช้งานระบบ LANTA' },
  { id: 'tl_title_en', label: 'Title (English) *', schema: 'title.en', placeholder: 'e.g. LANTA goes live' },
  { id: 'tl_org_th', label: 'Organisation (Thai)', schema: 'org.th', placeholder: 'หน่วยงานที่เกี่ยวข้อง' },
  { id: 'tl_org_en', label: 'Organisation (English)', schema: 'org.en', placeholder: 'Organisation name' },
  { id: 'tl_body_th', label: 'Body text (Thai)', schema: 'body.th', type: 'textarea', placeholder: 'รายละเอียดเพิ่มเติมของเหตุการณ์นี้' },
  { id: 'tl_body_en', label: 'Body text (English)', schema: 'body.en', type: 'textarea', placeholder: 'More detail about this milestone' },
  { id: 'tl_tags', label: 'Tags', schema: 'tags', placeholder: 'Tag1, Tag2', hint: 'Comma-separated' },
  { id: 'tl_link', label: 'Link', schema: 'link', type: 'url', placeholder: 'https://example.ac.th' },
];

const CORRECTION_FIELDS = [
  { id: 'corr_where', label: 'Which record is wrong? *', placeholder: 'e.g. systems → LANTA, or an event/timeline id' },
  { id: 'corr_desc', label: 'What’s wrong, and what should it say instead? *', type: 'textarea' },
];

const FIELDSETS = {
  system: SYSTEM_FIELDS,
  stats: SYSTEM_FIELDS,
  event: EVENT_FIELDS,
  timeline: TIMELINE_FIELDS,
  correction: CORRECTION_FIELDS,
};

/* ---------------------------------------------------------------- values */

const val = (id) => (document.getElementById(id)?.value ?? '').trim();
const numv = (id) => (val(id) === '' ? null : Number(val(id)));
const list = (id) => val(id) ? val(id).split(',').map((x) => x.trim()).filter(Boolean) : [];

const isRows = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);

function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (!isRows(v)) continue;
    if (Array.isArray(v)) { out[k] = v; continue; }
    if (typeof v === 'object') {
      const nested = clean(v);
      if (Object.keys(nested).length) out[k] = nested;
      continue;
    }
    if (typeof v === 'number' && Number.isNaN(v)) continue;
    out[k] = v;
  }
  return out;
}

const i18n = (th, en) => ((th || en) ? { th: th || '', en: en || '' } : null);

function modelRows(id, build) {
  return val(id).split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('|') && !/^model\s*\|/i.test(l))
    .map((l) => build(l.split('|').map((s) => s.trim())))
    .filter((o) => Object.keys(o).length > 1);
}

const intv = (s) => (s === '' || s == null ? null : parseInt(s, 10));
const floatv = (s) => (s === '' || s == null ? null : parseFloat(s));

/* ---------------------------------------------------------------- data builders */

function buildSystem() {
  const cpu_types = modelRows('cpu_lines', ([model, nodes, sockets, cores, mem]) =>
    clean({ model, nodes: intv(nodes), sockets_per_node: intv(sockets), cores_per_node: intv(cores), memory_per_node_gb: floatv(mem) }));
  const gpu_types = modelRows('gpu_lines', ([model, nodes, perNode, mem]) =>
    clean({ model, nodes: intv(nodes), gpu_per_node: intv(perNode), memory_per_unit_gb: floatv(mem) }));
  const out = clean({
    system_id: val('sys_id'),
    name: val('sys_name'),
    organization: clean({
      name_th: val('org_name_th'),
      name_en: val('org_name_en'),
      org_type: val('org_type') || undefined,
      province: val('org_province'),
      coordinates: clean({ lat: numv('org_lat'), lng: numv('org_lng') }),
      website: val('org_site'),
      contact_email: val('org_email'),
    }),
    status: val('sys_status') || undefined,
    commissioned_date: val('sys_comm') || null,
    decommissioned_date: val('sys_decomm') || null,
    vendor: val('sys_vendor'),
    compute: clean({
      cpu_types: cpu_types.length ? cpu_types : null,
      total: clean({
        total_nodes: numv('tot_nodes'), total_cpu_cores: numv('tot_cores'),
        total_gpu_count: numv('tot_gpus'), total_memory_tb: numv('tot_mem'),
      }),
    }),
    cooling: val('cooling'),
    network: clean({ interconnect_type: val('ic_type'), bandwidth_gbps: numv('bw_gbps') }),
    storage: clean({
      type: val('st_type') || undefined, filesystem: val('fs'),
      capacity_pb: numv('cap_pb'), nvme_pb: numv('nvme_pb'), disk_pb: numv('disk_pb'),
    }),
    performance: clean({
      peak_pflops: numv('peak_pflops'), sustained_pflops: numv('sust_pflops'),
      power_consumption_kw: numv('power_kw'),
    }),
    software_stack: clean({ os: val('os'), scheduler: val('sched') || undefined, frameworks: list('frameworks') }),
    access: clean({ model: val('acc_model') || undefined, user_base: list('acc_users') }),
  });
  if (out.compute) {
    out.compute.num_cpu_type = cpu_types.length;
    out.compute.cpu_types = cpu_types;
    out.compute.num_gpu_type = gpu_types.length;
    out.compute.gpu_types = gpu_types;
  }
  return out;
}

function buildEvent() {
  return clean({
    title: i18n(val('ev_title_th'), val('ev_title_en')),
    subtitle: i18n(val('ev_sub_th'), val('ev_sub_en')),
    description: i18n(val('ev_desc_th'), val('ev_desc_en')),
    organizer: i18n(val('ev_org_th'), val('ev_org_en')),
    location: i18n(val('ev_loc_th'), val('ev_loc_en')),
    format: val('ev_format') || undefined,
    start: val('ev_start') || undefined,
    end: val('ev_end') || undefined,
    time: val('ev_time'),
    url: val('ev_url'),
    tags: list('ev_tags'),
    image: val('ev_image'),
  });
}

function buildTimeline() {
  return clean({
    year: numv('tl_year'),
    era: val('tl_era'),
    kind: val('tl_kind') || undefined,
    category: val('tl_category'),
    title: i18n(val('tl_title_th'), val('tl_title_en')),
    org: i18n(val('tl_org_th'), val('tl_org_en')),
    body: i18n(val('tl_body_th'), val('tl_body_en')),
    tags: list('tl_tags'),
    link: val('tl_link'),
  });
}

function buildData(type) {
  if (type === 'system' || type === 'stats') return buildSystem();
  if (type === 'event') return buildEvent();
  if (type === 'timeline') return buildTimeline();
  return null;
}

function subject(type) {
  switch (type) {
    case 'system': case 'stats': return val('sys_name') || val('sys_id');
    case 'event': return val('ev_title_en') || val('ev_title_th');
    case 'timeline': return val('tl_title_en') || val('tl_title_th');
    default: return val('corr_where');
  }
}

/* ---------------------------------------------------------------- issue body */

function buildBody() {
  const type = currentType();
  const typeLabel = t(TYPES.find((x) => x.value === type).key);
  const data = buildData(type);
  const contact = val('f-contact');
  const email = val('f-email');

  const sections = [
    `**${t('submit.formType')}:** ${typeLabel} (\`${type}\`)`,
    '',
    `### Submission`,
    '',
    data
      ? '```json\n' + JSON.stringify(data, null, 2) + '\n```'
      : `**Record:** \`${val('corr_where') || '—'}\`\n\n${val('corr_desc') || '—'}`,
    '',
    '### Submitter',
    contact ? `**${t('submit.fieldContactName')}:** ${contact}` : null,
    email ? `**${t('submit.fieldContactEmail')}:** ${email}` : null,
    '',
    '---',
    `_Target file: \`${FILE_FOR[type]}\` · submitted via hpc.in.th/submit_`,
  ].filter((l) => l !== null);
  return sections.join('\n');
}

/* ---------------------------------------------------------------- form */

function currentType() {
  const v = document.getElementById('f-type')?.value;
  return FIELDSETS[v] ? v : 'system';
}

const store = {};
let builtFor = null;

function fieldMarkup(f) {
  const req = /\*$/.test(f.label) ? ` <span class="req">${esc(t('submit.required'))}</span>` : '';
  const name = f.label.replace(/ \*$/, '');
  const schemaTag = f.schema ? ` <span class="field-key mono">${esc(f.schema)}</span>` : '';
  let input;
  if (f.type === 'select') {
    input = `<select id="${f.id}"><option value="">—</option>${f.options.map((o) => `<option${store[f.id] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${f.id}" placeholder="${esc(f.placeholder || '')}">${esc(store[f.id] || '')}</textarea>`;
  } else {
    input = `<input id="${f.id}" type="${f.type || 'text'}" autocomplete="off" placeholder="${esc(f.placeholder || '')}" value="${esc(store[f.id] || '')}">`;
  }
  const reqAttr = /\*$/.test(f.label) ? ' required' : '';
  return `<div class="field">
      <label for="${f.id}">${esc(name)}${schemaTag}${req}</label>
      ${input.replace(/<input|<select|<textarea/, (m) => m + reqAttr)}
      ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ''}
    </div>`;
}

function buildTypeFields() {
  const type = currentType();
  if (builtFor === type) return;
  builtFor = type;
  document.getElementById('type-fields').innerHTML = FIELDSETS[type]
    .map((f) => (f.section ? `<h3 class="field-section">${esc(f.section)}</h3>` : fieldMarkup(f)))
    .join('');
}

function buildTypeOptions() {
  const sel = document.getElementById('f-type');
  const keep = sel.value;
  sel.innerHTML = TYPES.map((x) => `<option value="${x.value}">${esc(t(x.key))}</option>`).join('');
  const fromQuery = new URLSearchParams(location.search).get('type');
  sel.value = keep || (TYPES.some((x) => x.value === fromQuery) ? fromQuery : 'system');
}

function refreshPreview() {
  const type = currentType();
  for (const f of FIELDSETS[type]) { if (f.id) store[f.id] = (document.getElementById(f.id)?.value ?? '').trim(); }
  document.getElementById('preview').textContent = buildBody();
  document.getElementById('step-2').innerHTML =
    esc(t('submit.step2', { file: '\u0000' })).replace('\u0000', `<code class="mono">${esc(FILE_FOR[type])}</code>`);
  const tpl = document.getElementById('tpl-json');
  const body = TEMPLATES[type];
  tpl.textContent = body || '—';
  document.getElementById('tpl-wrap').hidden = !body;
}

/* PR-side schema templates (Option 2 reference). */
const TEMPLATES = {
  system: SYSTEM_TEMPLATE(),
  stats: SYSTEM_TEMPLATE(),
  event: null,
  timeline: null,
  correction: null,
};

function SYSTEM_TEMPLATE() {
  return `// data/systems.json — items array (see data/schema/systems.schema.json)
{
  "system_id": "thaisc-example",
  "name": "Example",
  "organization": {
    "name_th": "ตัวอย่าง",
    "name_en": "Example Organisation",
    "org_type": "government_research",
    "province": "Bangkok",
    "coordinates": { "lat": 13.7563, "lng": 100.5018 },
    "website": "https://example.ac.th",
    "contact_email": null
  },
  "status": "planned",
  "commissioned_date": "2027-01-01",
  "decommissioned_date": null,
  "vendor": "Dell Technologies",
  "compute": {
    "num_cpu_type": 1,
    "cpu_types": [{ "model": "AMD EPYC 9654", "nodes": 100, "sockets_per_node": 2, "cores_per_node": 192, "memory_per_node_gb": 1536 }],
    "num_gpu_type": 1,
    "gpu_types": [{ "model": "NVIDIA H100", "nodes": 20, "gpu_per_node": 8, "memory_per_unit_gb": 80 }],
    "total": { "total_nodes": 120, "total_cpu_cores": 19200, "total_gpu_count": 160, "total_memory_tb": 184 }
  },
  "cooling": "direct liquid cooling",
  "network": { "interconnect_type": "InfiniBand NDR", "bandwidth_gbps": 400 },
  "storage": { "type": "parallel_fs", "filesystem": "Lustre", "capacity_pb": 5, "nvme_pb": 1, "disk_pb": 4 },
  "performance": { "peak_pflops": null, "sustained_pflops": null, "power_consumption_kw": null },
  "software_stack": { "os": "Rocky Linux 9", "scheduler": "slurm", "frameworks": ["MPI", "PyTorch"] },
  "access": { "model": "open_academic", "user_base": ["academic", "government"] }
}`;
}

/* ---------------------------------------------------------------- submit */

function submitIssue() {
  const type = currentType();
  const title = `[${type}] ${subject(type) || 'submission'}`;
  const url = new URL(`${SITE.repoUrl}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', buildBody());
  url.searchParams.set('labels', `data,${type}`);
  window.open(url.href, '_blank', 'noopener');
}

(async function main() {
  await boot('submit');

  onLangChange(() => {
    buildTypeOptions();
    builtFor = null;
    buildTypeFields();
    refreshPreview();
  });

  const form = document.getElementById('submit-form');
  form.addEventListener('input', refreshPreview);
  form.addEventListener('change', refreshPreview);
  document.getElementById('f-type').addEventListener('change', () => { buildTypeFields(); refreshPreview(); });
  form.addEventListener('submit', (e) => {
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
