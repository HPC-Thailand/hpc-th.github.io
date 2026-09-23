#!/usr/bin/env node
/**
 * Vendor the third-party libraries into assets/vendor/.
 *
 * The site is otherwise a pile of static files that GitHub Pages will serve
 * for as long as the repository exists. Three CDNs in the critical path
 * undo that: unpkg, jsdelivr and cdnjs each cost a DNS lookup and a TLS
 * handshake on first use, each can rate-limit or go down, and a version can
 * be unpublished out from under us. Serving them ourselves costs about 2 MB
 * in the repository and removes all of it.
 *
 * Versions are pinned here on purpose. Bumping one is a deliberate act:
 * change the version, re-run, test, commit.
 *
 *   node tools/fetch-vendor.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets/vendor');

const LEAFLET = '1.9.4';
const CHARTJS = '4.4.1';
const PDFJS = '4.10.38';

const FILES = [
  // Leaflet — the map on /systems/
  [`https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.js`, `leaflet-${LEAFLET}/leaflet.js`],
  [`https://unpkg.com/leaflet@${LEAFLET}/dist/leaflet.css`, `leaflet-${LEAFLET}/leaflet.css`],
  // leaflet.css references these by relative path.
  ...['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png', 'layers.png', 'layers-2x.png']
    .map((f) => [`https://unpkg.com/leaflet@${LEAFLET}/dist/images/${f}`, `leaflet-${LEAFLET}/images/${f}`]),

  // Chart.js — the charts on /stats/
  [`https://cdn.jsdelivr.net/npm/chart.js@${CHARTJS}/dist/chart.umd.min.js`, `chart.js-${CHARTJS}/chart.umd.min.js`],

  // PDF.js — the in-page reader on /reference/. The worker is only fetched
  // when a document is actually opened.
  [`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS}/pdf.min.mjs`, `pdf.js-${PDFJS}/pdf.min.mjs`],
  [`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS}/pdf.worker.min.mjs`, `pdf.js-${PDFJS}/pdf.worker.min.mjs`],
];

let total = 0;
for (const [url, rel] of FILES) {
  const abs = join(OUT, rel);
  if (!existsSync(abs)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, Buffer.from(await res.arrayBuffer()));
    console.log(`fetched ${rel}`);
  }
  total += readFileSync(abs).length;
}

console.log(`\n${FILES.length} files, ${(total / 1024 / 1024).toFixed(2)} MB in assets/vendor/`);
console.log('Pinned: leaflet %s · chart.js %s · pdf.js %s', LEAFLET, CHARTJS, PDFJS);
