#!/usr/bin/env node
/**
 * Dependency-free structural check for the JSON files under data/.
 * Run with `node tools/validate-data.mjs`; exits non-zero on any error.
 *
 * This is deliberately not a full JSON Schema validator — the schemas under
 * data/schema/ cover that for editors. This catches the mistakes that actually
 * break the site: missing ids, broken bilingual strings, dangling era refs.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function read(rel) {
  try {
    return JSON.parse(readFileSync(join(root, rel), 'utf8'));
  } catch (e) {
    fail(rel, `cannot parse — ${e.message}`);
    return null;
  }
}

/** A bilingual string must carry non-empty th and en. */
function checkI18n(file, where, value, required = true) {
  if (value == null) {
    if (required) fail(file, `${where} is missing`);
    return;
  }
  for (const l of ['th', 'en']) {
    if (typeof value[l] !== 'string' || !value[l].trim()) {
      fail(file, `${where}.${l} is missing or empty`);
    }
  }
}

const SLUG = /^[a-z0-9-]+$/;

/* ------------------------------------------------------------------ ui */

function checkUI() {
  const file = 'data/ui.json';
  const ui = read(file);
  if (!ui) return;
  const walk = (node, path) => {
    for (const [key, value] of Object.entries(node)) {
      const where = path ? `${path}.${key}` : key;
      if (value && typeof value === 'object' && ('th' in value || 'en' in value)) {
        checkI18n(file, where, value);
      } else if (value && typeof value === 'object') {
        walk(value, where);
      } else {
        fail(file, `${where} is not a bilingual object`);
      }
    }
  };
  walk(ui, '');
}

/* ------------------------------------------------------------- timeline */

function checkTimeline() {
  const file = 'data/timeline.json';
  const doc = read(file);
  if (!doc) return;

  const eraIds = new Set();
  for (const era of doc.eras ?? []) {
    if (!SLUG.test(era.id ?? '')) fail(file, `era id "${era.id}" is not a slug`);
    if (eraIds.has(era.id)) fail(file, `duplicate era id "${era.id}"`);
    eraIds.add(era.id);
    checkI18n(file, `era ${era.id}.label`, era.label);
    checkI18n(file, `era ${era.id}.tagline`, era.tagline);
  }

  const KINDS = new Set(['era', 'highlight', 'milestone', 'open']);
  const seen = new Set();
  let previousYear = -Infinity;

  for (const e of doc.entries ?? []) {
    const at = `entry ${e.id}`;
    if (!SLUG.test(e.id ?? '')) fail(file, `${at}: id is not a slug`);
    if (seen.has(e.id)) fail(file, `${at}: duplicate id`);
    seen.add(e.id);

    if (!KINDS.has(e.kind)) fail(file, `${at}: unknown kind "${e.kind}"`);
    if (!eraIds.has(e.era)) fail(file, `${at}: era "${e.era}" is not defined`);
    checkI18n(file, `${at}.title`, e.title);
    for (const key of ['subtitle', 'org', 'body']) {
      if (e[key]) checkI18n(file, `${at}.${key}`, e[key], false);
    }
    (e.bullets ?? []).forEach((b, i) => checkI18n(file, `${at}.bullets[${i}]`, b));
    (e.badges ?? []).forEach((b, i) => checkI18n(file, `${at}.badges[${i}]`, b));
    (e.stats ?? []).forEach((s, i) => {
      checkI18n(file, `${at}.stats[${i}].label`, s.label);
      if (typeof s.value !== 'string' || !s.value) fail(file, `${at}.stats[${i}].value is missing`);
    });

    if (e.year != null) {
      if (!Number.isInteger(e.year) || e.year < 1900) fail(file, `${at}: year "${e.year}" looks wrong`);
      if (e.year < previousYear) warn(file, `${at}: year ${e.year} is out of chronological order`);
      previousYear = e.year;
    }
    if (e.link) {
      try { new URL(e.link); } catch { fail(file, `${at}: link is not a URL`); }
    }
    if (e.source && !/^p([1-9]|10)$/.test(e.source)) {
      warn(file, `${at}: source "${e.source}" has no matching slide image`);
    }
  }
}

/* --------------------------------------------------------- organizations */

const ORG_TYPES = new Set(['government_research', 'university', 'private', 'state_enterprise']);
let ORG_IDS = null;

function checkOrganizations() {
  const file = 'data/organizations.json';
  const doc = read(file);
  if (!doc) return;

  ORG_IDS = new Set();
  const parents = [];
  for (const o of doc.organizations ?? []) {
    const at = `organisation ${o.org_id}`;
    if (!SLUG.test(o.org_id ?? '')) fail(file, `${at}: org_id is not a slug`);
    if (ORG_IDS.has(o.org_id)) fail(file, `${at}: duplicate org_id`);
    ORG_IDS.add(o.org_id);

    for (const key of ['name_th', 'name_en', 'province']) {
      if (typeof o[key] !== 'string' || !o[key].trim()) fail(file, `${at}: ${key} is missing or empty`);
    }
    if (!ORG_TYPES.has(o.org_type)) fail(file, `${at}: unknown org_type "${o.org_type}"`);
    if (o.parent != null) {
      if (!SLUG.test(o.parent)) fail(file, `${at}: parent "${o.parent}" is not a slug`);
      parents.push([o.org_id, o.parent]);
    }

    const { lat, lng } = o.coordinates ?? {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      fail(file, `${at}: coordinates must have numeric lat and lng`);
    } else {
      // Thailand's bounding box, give or take.
      if (lng < 96 || lng > 106) fail(file, `${at}: lng ${lng} is outside Thailand — are lat/lng swapped?`);
      if (lat < 5 || lat > 21) fail(file, `${at}: lat ${lat} is outside Thailand — are lat/lng swapped?`);
    }

    if (o.website) {
      try { new URL(o.website); } catch { fail(file, `${at}: website is not a URL`); }
    }
    if (o.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.contact_email)) {
      fail(file, `${at}: contact_email "${o.contact_email}" is not an email`);
    }
  }
  for (const [oid, parent] of parents) {
    if (!ORG_IDS.has(parent)) fail(file, `organisation ${oid}: parent "${parent}" is not defined`);
  }
}

/* -------------------------------------------------------------- systems */

const STATUSES = new Set(['operational', 'planned', 'maintenance', 'decommissioned']);
const STORAGE_TYPES = new Set(['parallel_fs', 'object', 'hybrid']);
const SCHEDULERS = new Set(['slurm', 'pbs', 'lsf', 'other']);
const ACCESS_MODELS = new Set(['open_academic', 'restricted', 'commercial', 'hybrid']);
const USER_BASES = new Set(['academic', 'government', 'industry', 'sea_region']);

function checkSystems() {
  const file = 'data/systems.json';
  const doc = read(file);
  if (!doc) return;

  const seen = new Set();
  for (const s of doc.systems ?? []) {
    const at = `system ${s.system_id}`;
    if (!SLUG.test(s.system_id ?? '')) fail(file, `${at}: system_id is not a slug`);
    if (seen.has(s.system_id)) fail(file, `${at}: duplicate system_id`);
    seen.add(s.system_id);

    if (!s.name) fail(file, `${at}: name is missing`);
    if (!ORG_IDS) fail(file, `${at}: cannot check org_id — organizations.json is unreadable`);
    else if (!s.org_id || !ORG_IDS.has(s.org_id)) fail(file, `${at}: org_id "${s.org_id}" is not defined in organizations.json`);
    if (!STATUSES.has(s.status)) fail(file, `${at}: unknown status "${s.status}"`);

    for (const key of ['commissioned_date', 'decommissioned_date']) {
      const v = s[key];
      if (v != null && Number.isNaN(Date.parse(v))) fail(file, `${at}: ${key} is not a date`);
    }
    if (s.commissioned_date && s.decommissioned_date
      && Date.parse(s.decommissioned_date) < Date.parse(s.commissioned_date)) {
      fail(file, `${at}: decommissioned_date is before commissioned_date`);
    }

    const c = s.compute;
    if (!c) {
      fail(file, `${at}: compute is missing`);
      continue;
    }
    if (!Array.isArray(c.cpu_types) || !c.cpu_types.length) fail(file, `${at}: compute.cpu_types must be a non-empty array`);
    if (!Array.isArray(c.gpu_types)) fail(file, `${at}: compute.gpu_types must be an array`);
    if (c.num_cpu_type !== (c.cpu_types?.length || 0)) fail(file, `${at}: num_cpu_type ${c.num_cpu_type} != ${c.cpu_types?.length || 0} cpu_types`);
    if (c.num_gpu_type !== (c.gpu_types?.length || 0)) fail(file, `${at}: num_gpu_type ${c.num_gpu_type} != ${c.gpu_types?.length || 0} gpu_types`);
    if (c.num_gpu_type > 0 && !c.gpu_types?.length) fail(file, `${at}: num_gpu_type > 0 but gpu_types is empty`);

    let coreSum = 0;
    (c.cpu_types ?? []).forEach((t2, i) => {
      if (!t2.model) fail(file, `${at}: cpu_types[${i}].model is missing`);
      if (!Number.isInteger(t2.nodes) || t2.nodes < 0) fail(file, `${at}: cpu_types[${i}].nodes must be a non-negative integer`);
      if (!Number.isInteger(t2.cores_per_node) || t2.cores_per_node < 0) fail(file, `${at}: cpu_types[${i}].cores_per_node must be a non-negative integer`);
      coreSum += (t2.nodes || 0) * (t2.cores_per_node || 0);
    });
    (c.gpu_types ?? []).forEach((g, i) => {
      if (!g.model) fail(file, `${at}: gpu_types[${i}].model is missing`);
      if (!Number.isInteger(g.nodes) || g.nodes < 0) fail(file, `${at}: gpu_types[${i}].nodes must be a non-negative integer`);
      if (!Number.isInteger(g.gpu_per_node) || g.gpu_per_node < 1) fail(file, `${at}: gpu_types[${i}].gpu_per_node must be a positive integer`);
      if (typeof g.memory_per_unit_gb !== 'number') fail(file, `${at}: gpu_types[${i}].memory_per_unit_gb must be a number`);
    });

    const total = c.total ?? {};
    if (!Number.isInteger(total.total_cpu_cores) || total.total_cpu_cores < 0) fail(file, `${at}: total.total_cpu_cores must be a non-negative integer`);
    if (!Number.isInteger(total.total_gpu_count) || total.total_gpu_count < 0) fail(file, `${at}: total.total_gpu_count must be a non-negative integer`);
    if (!Number.isInteger(total.total_nodes) || total.total_nodes < 0) fail(file, `${at}: total.total_nodes must be a non-negative integer`);
    if (typeof total.total_memory_tb !== 'number') fail(file, `${at}: total.total_memory_tb must be a number`);
    // Old/derived records round per-node figures, so only flag gross mismatches.
    if (coreSum && total.total_cpu_cores && Math.abs(coreSum - total.total_cpu_cores) / total.total_cpu_cores > 0.05) {
      warn(file, `${at}: total_cpu_cores ${total.total_cpu_cores} differs >5% from cpu_types sum ${coreSum}`);
    }
    const gpuSum = (c.gpu_types ?? []).reduce((a, g) => a + (g.nodes || 0) * (g.gpu_per_node || 0), 0);
    if (gpuSum && total.total_gpu_count && Math.abs(gpuSum - total.total_gpu_count) / total.total_gpu_count > 0.05) {
      warn(file, `${at}: total_gpu_count ${total.total_gpu_count} differs >5% from gpu_types sum ${gpuSum}`);
    }

    if (!s.storage || !STORAGE_TYPES.has(s.storage.type)) fail(file, `${at}: storage.type "${s.storage?.type}" is not valid`);
    if (!s.storage?.filesystem) fail(file, `${at}: storage.filesystem is missing`);
    if (typeof s.storage?.capacity_pb !== 'number' || s.storage.capacity_pb < 0) fail(file, `${at}: storage.capacity_pb must be a non-negative number`);
    for (const k of ['nvme_pb', 'disk_pb']) {
      if (s.storage?.[k] != null && (typeof s.storage[k] !== 'number' || s.storage[k] < 0)) {
        fail(file, `${at}: storage.${k} must be a non-negative number or null`);
      }
    }

    if (!s.network?.interconnect_type) fail(file, `${at}: network.interconnect_type is missing`);
    if (typeof s.network?.bandwidth_gbps !== 'number' || s.network.bandwidth_gbps < 0) fail(file, `${at}: network.bandwidth_gbps must be a non-negative number`);

    if (!SCHEDULERS.has(s.software_stack?.scheduler)) fail(file, `${at}: software_stack.scheduler "${s.software_stack?.scheduler}" is not valid`);
    if (!s.software_stack?.os) fail(file, `${at}: software_stack.os is missing`);

    if (!ACCESS_MODELS.has(s.access?.model)) fail(file, `${at}: access.model "${s.access?.model}" is not valid`);
    for (const u of s.access?.user_base ?? []) {
      if (!USER_BASES.has(u)) fail(file, `${at}: access.user_base contains unknown value "${u}"`);
    }

    if (!s.verifiedOn) warn(file, `${at}: no verifiedOn date — shown as "awaiting verification"`);
  }
}

/* --------------------------------------------------------------- events */

function checkEvents() {
  const file = 'data/events.json';
  const doc = read(file);
  if (!doc) return;

  const seen = new Set();
  for (const e of doc.events ?? []) {
    const at = `event ${e.id}`;
    if (!SLUG.test(e.id ?? '')) fail(file, `${at}: id is not a slug`);
    if (seen.has(e.id)) fail(file, `${at}: duplicate id`);
    seen.add(e.id);

    checkI18n(file, `${at}.title`, e.title);
    if (Number.isNaN(Date.parse(e.start))) fail(file, `${at}: start is not a date`);
    if (e.end && Number.isNaN(Date.parse(e.end))) fail(file, `${at}: end is not a date`);
    if (e.end && Date.parse(e.end) < Date.parse(e.start)) fail(file, `${at}: end is before start`);
    if (e.url) {
      try { new URL(e.url); } catch { fail(file, `${at}: url is not a URL`); }
    }
    if (e.image) {
      if (e.image.startsWith('/')) fail(file, `${at}: image must be relative to the site root`);
      else if (!existsSync(join(root, e.image))) fail(file, `${at}: image not found — ${e.image}`);
    }
  }
}

/* ------------------------------------------------------------ reference */

function checkReference() {
  const file = 'data/reference.json';
  const doc = read(file);
  if (!doc) return;

  const catIds = new Set();
  for (const c of doc.categories ?? []) {
    if (!SLUG.test(c.id ?? '')) fail(file, `category id "${c.id}" is not a slug`);
    if (catIds.has(c.id)) fail(file, `duplicate category id "${c.id}"`);
    catIds.add(c.id);
    checkI18n(file, `category ${c.id}.label`, c.label);
    checkI18n(file, `category ${c.id}.blurb`, c.blurb);
  }

  const FORMATS = new Set(['pdf', 'image', 'html', 'link']);
  const seen = new Set();

  for (const d of doc.documents ?? []) {
    const at = `document ${d.id}`;
    if (!SLUG.test(d.id ?? '')) fail(file, `${at}: id is not a slug`);
    if (seen.has(d.id)) fail(file, `${at}: duplicate id`);
    seen.add(d.id);

    if (!catIds.has(d.category)) fail(file, `${at}: category "${d.category}" is not defined`);
    if (!FORMATS.has(d.format)) fail(file, `${at}: unknown format "${d.format}"`);
    checkI18n(file, `${at}.title`, d.title);
    checkI18n(file, `${at}.description`, d.description, false);

    if (!d.file && !d.url) fail(file, `${at}: needs either a file or a url`);
    if (d.file && d.url) fail(file, `${at}: has both file and url — pick one`);

    if (d.url) {
      try { new URL(d.url); } catch { fail(file, `${at}: url is not a URL`); }
    }

    if (d.file) {
      if (d.file.startsWith('/')) fail(file, `${at}: file must be relative to the site root`);
      const abs = join(root, d.file);
      if (!existsSync(abs)) {
        fail(file, `${at}: file not found — ${d.file}`);
      } else {
        const { size } = statSync(abs);
        // GitHub rejects any pushed file over 100 MB outright.
        if (size > 100 * 1024 * 1024) {
          fail(file, `${at}: ${(size / 1024 / 1024).toFixed(0)} MB exceeds GitHub's 100 MB file limit — host it elsewhere and use \`url\``);
        } else if (size > 40 * 1024 * 1024) {
          warn(file, `${at}: ${(size / 1024 / 1024).toFixed(0)} MB is large for a Pages download`);
        }
        if (d.bytes && d.bytes !== size) {
          warn(file, `${at}: bytes says ${d.bytes} but the file is ${size}`);
        }
      }
    }
  }
}

/* ----------------------------------------------------------------- run */

checkUI();
checkTimeline();
checkOrganizations();
checkSystems();
checkEvents();
checkReference();

warnings.forEach((w) => console.warn(`warn  ${w}`));
errors.forEach((e) => console.error(`error ${e}`));

if (errors.length) {
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
}
console.log(`Data OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
