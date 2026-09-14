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

/* -------------------------------------------------------------- systems */

function checkSystems() {
  const file = 'data/systems.json';
  const doc = read(file);
  if (!doc) return;

  const seen = new Set();
  for (const s of doc.systems ?? []) {
    const at = `system ${s.id}`;
    if (!SLUG.test(s.id ?? '')) fail(file, `${at}: id is not a slug`);
    if (seen.has(s.id)) fail(file, `${at}: duplicate id`);
    seen.add(s.id);

    if (!s.name) fail(file, `${at}: name is missing`);
    if (!s.organization) fail(file, `${at}: organization is missing`);

    const cores = s.specs?.cpu?.cores;
    if (!Number.isInteger(cores) || cores < 0) fail(file, `${at}: specs.cpu.cores must be a non-negative integer`);
    if (!s.specs?.cpu?.type) fail(file, `${at}: specs.cpu.type is missing`);

    checkI18n(file, `${at}.location.city`, s.location?.city);
    const coords = s.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      fail(file, `${at}: location.coordinates must be [longitude, latitude]`);
    } else {
      const [lon, lat] = coords;
      // Thailand's bounding box, give or take.
      if (lon < 96 || lon > 106) fail(file, `${at}: longitude ${lon} is outside Thailand — are lat/lon swapped?`);
      if (lat < 5 || lat > 21) fail(file, `${at}: latitude ${lat} is outside Thailand — are lat/lon swapped?`);
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
