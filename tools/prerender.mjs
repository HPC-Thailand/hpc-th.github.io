#!/usr/bin/env node
/**
 * Bake the JSON data into every page as real HTML, and mirror the site in
 * English under /en/.
 *
 * Why this exists: the pages ship as empty shells that JavaScript fills in.
 * Google can usually render that, eventually. Everything else cannot —
 * Bing and DuckDuckGo render JS poorly, and LLM crawlers and coding agents
 * (ClaudeBot, GPTBot, PerplexityBot, CCBot, and anything doing a plain HTTP
 * GET) never run JS at all. Before this script every page carried 20
 * characters of text and an empty <h1>.
 *
 * The markup produced here is semantic rather than pixel-identical: the
 * client replaces it on boot, so its job is to carry the words, the links
 * and the structured data. It is the same content from the same JSON, so it
 * is a fallback, not cloaking.
 *
 * Run `node tools/prerender.mjs`; `--check` exits non-zero if the committed
 * output is stale, which is what CI runs.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://hpc.in.th';
const CHECK = process.argv.includes('--check');

const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const UI = read('data/ui.json');
const TIMELINE = read('data/timeline.json');
const SYSTEMS = read('data/systems.json');
const REFERENCE = read('data/reference.json');
const EVENTS = read('data/events.json');

/* ------------------------------------------------------------------ utils */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const pick = (v, lang) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] ?? v.en ?? v.th ?? '';
};

const t = (path, lang, vars) => {
  const node = path.split('.').reduce((o, k) => (o == null ? o : o[k]), UI);
  let out = pick(node, lang);
  if (!out) return '';
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
};

const num = (n, lang) => (n == null ? '—'
  : new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US').format(n));

const be = (ce) => (ce == null ? null : ce + 543);

/** Absolute URL for a page path, per language. */
const pageUrl = (path, lang) => `${SITE}${lang === 'en' ? '/en' : ''}${path}`;

/* --------------------------------------------------------------- renderers */

function renderTimeline(lang) {
  const eras = new Map(TIMELINE.eras.map((e) => [e.id, e]));
  const parts = [];

  for (const e of TIMELINE.entries) {
    if (e.kind === 'era') {
      const era = eras.get(e.era);
      parts.push(`<section class="tl-item" data-kind="era" id="e-${esc(e.id)}">
  <h2>${e.year ? `${e.year} · ` : ''}${esc(pick(e.title, lang))}</h2>
  ${era ? `<p><strong>${esc(pick(era.label, lang))}</strong> — ${esc(pick(era.tagline, lang))}</p>` : ''}
  ${e.subtitle ? `<p>${esc(pick(e.subtitle, lang))}</p>` : ''}
</section>`);
      continue;
    }

    const bits = [];
    const year = e.year ? `${e.year}${lang === 'th' ? ` (พ.ศ. ${be(e.year)})` : ''}` : '';
    bits.push(`<h3>${year ? `${year} — ` : ''}${esc(pick(e.title, lang))}</h3>`);
    if (e.subtitle) bits.push(`<p>${esc(pick(e.subtitle, lang))}</p>`);
    if (e.org) bits.push(`<p>${esc(pick(e.org, lang))}</p>`);
    if (e.body) bits.push(`<p>${esc(pick(e.body, lang))}</p>`);
    if (e.bullets?.length) {
      bits.push(`<ul>${e.bullets.map((b) => `<li>${esc(pick(b, lang))}</li>`).join('')}</ul>`);
    }
    if (e.stats?.length) {
      bits.push(`<ul>${e.stats
        .map((s) => `<li>${esc(pick(s.label, lang))}: ${esc(s.value)}</li>`).join('')}</ul>`);
    }
    if (e.link) bits.push(`<p><a href="${esc(e.link)}" rel="noopener">${esc(e.link)}</a></p>`);

    parts.push(`<article class="tl-item" data-kind="${esc(e.kind)}" id="e-${esc(e.id)}">
  ${bits.join('\n  ')}
</article>`);
  }
  return parts.join('\n');
}

function renderHeroStats(lang) {
  const years = TIMELINE.entries.filter((e) => e.year).map((e) => e.year);
  const span = new Date().getFullYear() - Math.min(...years);
  const cards = [
    ['home.statYears', span],
    ['home.statMilestones', TIMELINE.entries.filter((e) => e.kind !== 'era' && e.kind !== 'open').length],
    ['home.statGenerations', TIMELINE.eras.length - 1],
    ['home.statSystems', SYSTEMS.systems.length],
  ];
  return cards.map(([key, v]) =>
    `<div class="stat-card"><b>${num(v, lang)}</b><span>${esc(t(key, lang))}</span></div>`).join('\n');
}

function renderEraChips(lang) {
  return [`<span class="chip">${esc(t('timeline.filterAll', lang))}</span>`,
    ...TIMELINE.eras.map((e) => `<span class="chip">${esc(pick(e.label, lang))}</span>`)].join('\n');
}

/** Look up a coded value (province, cooling, access…) in ui.json's label maps. */
const label = (map, key, lang) => (key == null ? '' : (pick(UI.systems?.[map]?.[key], lang) || String(key)));

const orgName = (s, lang) => (lang === 'th'
  ? s.organization?.name_th || s.organization?.name_en
  : s.organization?.name_en || s.organization?.name_th) || '';

function renderSystems(lang) {
  return SYSTEMS.systems.map((s) => {
    const org = s.organization || {};
    const { cpu_types = [], gpu_types = [], total = {} } = s.compute || {};
    const st = s.storage || {};
    const perf = s.performance || {};

    const rows = [
      [t('systems.cpu', lang), [
        `${num(total.total_cpu_cores, lang)} ${t('systems.cores', lang)}`,
        cpu_types.map((c) => c.model).filter(Boolean).join(', '),
      ].filter(Boolean).join(' · ')],

      total.total_gpu_count
        ? [t('systems.gpu', lang), `${num(total.total_gpu_count, lang)} × ${
            gpu_types.map((g) => g.model).filter(Boolean).join(', ')}`]
        : null,

      st.filesystem || st.capacity_pb
        ? [t('systems.storage', lang), [
            st.capacity_pb ? `${st.capacity_pb} PB` : '', st.filesystem,
          ].filter(Boolean).join(' · ')]
        : null,

      s.network?.interconnect_type
        ? [t('systems.network', lang), [s.network.interconnect_type,
            s.network.bandwidth_gbps ? `${num(s.network.bandwidth_gbps, lang)} Gb/s` : '',
          ].filter(Boolean).join(' · ')]
        : null,

      s.cooling ? [t('systems.cooling', lang), label('coolingLabels', s.cooling, lang)] : null,

      perf.peak_pflops
        ? [t('systems.performance', lang), `${perf.peak_pflops} PFLOPS${
            perf.sustained_pflops ? ` (${perf.sustained_pflops} PFLOPS sustained)` : ''}`]
        : null,

      s.access?.model
        ? [t('systems.access', lang), [label('accessLabels', s.access.model, lang),
            ...(s.access.user_base || []).map((u) => label('userBaseLabels', u, lang)),
          ].filter(Boolean).join(' · ')]
        : null,

      org.province ? [t('systems.location', lang), label('provinceLabels', org.province, lang)] : null,
    ].filter(Boolean);

    const year = s.commissioned_date ? String(s.commissioned_date).slice(0, 4) : '';

    return `<article class="sys-card" id="s-${esc(s.system_id)}">
  <h3>${esc(s.name)}${year ? ` (${year})` : ''}</h3>
  <p>${esc(orgName(s, lang))}${org.org_type ? ` — ${esc(label('orgTypeLabels', org.org_type, lang))}` : ''}</p>
  <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${org.website ? `<p><a href="${esc(org.website)}" rel="noopener">${esc(t('systems.website', lang))}</a></p>` : ''}
</article>`;
  }).join('\n');
}

function renderReference(lang) {
  return REFERENCE.categories.map((cat) => {
    const docs = REFERENCE.documents.filter((d) => d.category === cat.id);
    if (!docs.length) return '';
    return `<section class="doc-group">
  <h2>${esc(pick(cat.label, lang))}</h2>
  <p>${esc(pick(cat.blurb, lang))}</p>
  ${docs.map((d) => {
    const href = d.url || `/${d.file}`;
    const meta = [d.year, d.author,
      d.pages ? `${d.pages} ${t('reference.pages', lang)}` : ''].filter(Boolean).join(' · ');
    return `<article class="doc-card" id="d-${esc(d.id)}">
    <h3><a href="${esc(encodeURI(href))}" rel="noopener">${esc(pick(d.title, lang))}</a></h3>
    ${d.description ? `<p>${esc(pick(d.description, lang))}</p>` : ''}
    ${meta ? `<p>${esc(meta)}</p>` : ''}
  </article>`;
  }).join('\n  ')}
</section>`;
  }).filter(Boolean).join('\n');
}

function renderEvents(lang, when) {
  const now = Date.now() - 864e5;
  const list = (EVENTS.events || [])
    .filter((e) => e.start)
    .filter((e) => (when === 'upcoming'
      ? new Date(e.end || e.start) >= now
      : new Date(e.end || e.start) < now))
    .sort((a, b) => (when === 'upcoming'
      ? new Date(a.start) - new Date(b.start)
      : new Date(b.start) - new Date(a.start)));

  if (!list.length) return when === 'upcoming' ? `<p>${esc(t('events.empty', lang))}</p>` : '';

  return list.map((e) => {
    const d = new Date(e.start);
    const date = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return `<article class="event-card" id="ev-${esc(e.id)}">
  <h3>${esc(pick(e.title, lang))}</h3>
  ${e.subtitle ? `<p>${esc(pick(e.subtitle, lang))}</p>` : ''}
  <p><time datetime="${esc(e.start)}">${esc(date)}</time>${e.time ? ` · ${esc(e.time)}` : ''}</p>
  ${e.description ? `<p>${esc(pick(e.description, lang))}</p>` : ''}
  ${e.location ? `<p>${esc(pick(e.location, lang))}</p>` : ''}
  ${e.organizer ? `<p>${esc(pick(e.organizer, lang))}</p>` : ''}
  ${e.url ? `<p><a href="${esc(e.url)}" rel="noopener">${esc(t('events.register', lang))}</a></p>` : ''}
</article>`;
  }).join('\n');
}

/** A plain data table under the charts: canvases carry no text, so without
    this the statistics page has nothing for a crawler or a screen reader. */
function renderStatsTable(lang) {
  const cols = ['colSystem', 'colOrg', 'colCores', 'colGpus', 'colPeak', 'colProvince'];
  const head = `<tr>${cols.map((c) => `<th scope="col">${esc(t(`stats.${c}`, lang))}</th>`).join('')}</tr>`;

  const rows = [...SYSTEMS.systems]
    .sort((a, b) => (b.compute?.total?.total_cpu_cores || 0) - (a.compute?.total?.total_cpu_cores || 0))
    .map((s) => {
      const total = s.compute?.total || {};
      const cells = [
        `<th scope="row">${esc(s.name)}</th>`,
        `<td>${esc(orgName(s, lang))}</td>`,
        `<td>${num(total.total_cpu_cores, lang)}</td>`,
        `<td>${total.total_gpu_count ? num(total.total_gpu_count, lang) : '—'}</td>`,
        `<td>${s.performance?.peak_pflops ? `${s.performance.peak_pflops} PFLOPS` : '—'}</td>`,
        `<td>${esc(label('provinceLabels', s.organization?.province, lang))}</td>`,
      ];
      return `<tr>${cells.join('')}</tr>`;
    }).join('\n');

  return { head, rows };
}

function renderKpis(lang) {
  const s = SYSTEMS.systems;
  const sum = (fn) => s.reduce((a, x) => a + (fn(x) || 0), 0);
  return [
    ['stats.totalCores', sum((x) => x.compute?.total?.total_cpu_cores)],
    ['stats.totalGpus', sum((x) => x.compute?.total?.total_gpu_count)],
    ['stats.totalSystems', s.length],
    ['stats.totalOrgs', new Set(s.map((x) => orgName(x, 'en'))).size],
  ].map(([k, v]) =>
    `<div class="stat-card"><b>${num(v, lang)}</b><span>${esc(t(k, lang))}</span></div>`).join('\n');
}

/* ------------------------------------------------------------- structured data */

const orgLd = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'HPC Thailand',
  url: SITE,
  description: pick(UI.site.tagline, 'en'),
};

function jsonLd(page, lang) {
  const url = pageUrl(page.path, lang);
  const graph = [
    orgLd,
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: pick(UI.site.name, lang),
      description: pick(UI.site.tagline, lang),
      inLanguage: lang === 'th' ? 'th-TH' : 'en',
      publisher: { '@id': `${SITE}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.title(lang),
      description: page.description(lang),
      inLanguage: lang === 'th' ? 'th-TH' : 'en',
      isPartOf: { '@id': `${SITE}/#website` },
      dateModified: page.updated || TIMELINE.updated,
    },
  ];

  if (page.path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: pick(UI.site.name, lang), item: pageUrl('/', lang) },
        { '@type': 'ListItem', position: 2, name: page.title(lang), item: url },
      ],
    });
  }

  if (page.key === 'timeline') {
    graph.push({
      '@type': 'ItemList',
      name: page.title(lang),
      numberOfItems: TIMELINE.entries.filter((e) => e.kind !== 'era').length,
      itemListElement: TIMELINE.entries
        .filter((e) => e.kind !== 'era' && e.year)
        .map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${e.year} — ${pick(e.title, lang)}`,
          url: `${url}#e-${e.id}`,
        })),
    });
  }

  if (page.key === 'systems' || page.key === 'stats') {
    graph.push({
      '@type': 'Dataset',
      name: page.title(lang),
      description: page.description(lang),
      url,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@id': `${SITE}/#organization` },
      dateModified: SYSTEMS.updated,
      keywords: ['high performance computing', 'supercomputer', 'Thailand', 'HPC', 'GPU', 'AI infrastructure'],
      isAccessibleForFree: true,
      distribution: [{
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${SITE}/data/systems.json`,
      }],
    });
  }

  if (page.key === 'reference') {
    graph.push({
      '@type': 'CollectionPage',
      name: page.title(lang),
      url,
      hasPart: REFERENCE.documents.map((d) => ({
        '@type': d.category === 'research' ? 'ScholarlyArticle' : 'DigitalDocument',
        name: pick(d.title, lang),
        ...(d.author ? { author: { '@type': 'Person', name: d.author } } : {}),
        ...(d.year ? { datePublished: String(d.year) } : {}),
        url: d.url || `${SITE}/${encodeURI(d.file)}`,
      })),
    });
  }

  if (page.key === 'events') {
    for (const e of EVENTS.events || []) {
      graph.push({
        '@type': 'Event',
        name: pick(e.title, lang),
        description: pick(e.description, lang),
        startDate: e.start,
        ...(e.end ? { endDate: e.end } : {}),
        eventAttendanceMode: e.format === 'online'
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: e.format === 'online'
          ? { '@type': 'VirtualLocation', url: e.url }
          : { '@type': 'Place', name: pick(e.location, lang), address: pick(e.location, lang) },
        ...(e.image ? { image: `${SITE}/${e.image}` } : {}),
        ...(e.url ? { url: e.url } : {}),
        organizer: { '@type': 'Organization', name: pick(e.organizer, lang) },
      });
    }
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

/* ------------------------------------------------------------------- pages */

const PAGES = [
  {
    key: 'timeline',
    path: '/',
    file: 'index.html',
    updated: TIMELINE.updated,
    title: (l) => t('home.title', l),
    description: (l) => t('home.lead', l),
    blocks: (l) => ({
      'hero-stats': renderHeroStats(l),
      'era-chips': renderEraChips(l),
      timeline: renderTimeline(l),
    }),
  },
  {
    key: 'systems',
    path: '/systems/',
    file: 'systems/index.html',
    updated: SYSTEMS.updated,
    title: (l) => t('systems.title', l),
    description: (l) => t('systems.lead', l),
    blocks: (l) => ({ 'sys-grid': renderSystems(l) }),
  },
  {
    key: 'reference',
    path: '/reference/',
    file: 'reference/index.html',
    updated: REFERENCE.updated,
    title: (l) => t('reference.title', l),
    description: (l) => t('reference.lead', l),
    blocks: (l) => ({ 'doc-groups': renderReference(l) }),
  },
  {
    key: 'stats',
    path: '/stats/',
    file: 'stats/index.html',
    updated: SYSTEMS.updated,
    title: (l) => t('stats.title', l),
    description: (l) => t('stats.lead', l),
    blocks: (l) => {
      const table = renderStatsTable(l);
      return {
        'kpi-grid': renderKpis(l),
        'stats-table-head': table.head,
        'stats-table': table.rows,
      };
    },
  },
  {
    key: 'events',
    path: '/events/',
    file: 'events/index.html',
    updated: EVENTS.updated,
    title: (l) => t('events.title', l),
    description: (l) => t('events.lead', l),
    blocks: (l) => ({
      'events-upcoming': renderEvents(l, 'upcoming'),
      'events-past': renderEvents(l, 'past'),
    }),
  },
  {
    key: 'submit',
    path: '/submit/',
    file: 'submit/index.html',
    updated: SYSTEMS.updated,
    title: (l) => t('submit.title', l),
    description: (l) => t('submit.lead', l),
    blocks: () => ({}),
  },
];

/* ---------------------------------------------------------------- rewriting */

const START = '<!--prerender-->';
const END = '<!--/prerender-->';

/** Remove anything a previous run added, so the transform is idempotent. */
function strip(html) {
  return html
    .replace(new RegExp(`${START}[\\s\\S]*?${END}`, 'g'), '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '')
    .replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, '');
}

/** Fill an empty element, addressed by id, with generated markup. */
function fillById(html, id, content) {
  if (!content) return html;
  const re = new RegExp(`(<([a-z]+)[^>]*\\bid="${id}"[^>]*>)(</\\2>)`);
  if (!re.test(html)) return html;
  return html.replace(re, (_m, open, _tag, close) => `${open}${START}\n${content}\n${END}${close}`);
}

/**
 * Fill every [data-i18n] element with its string, replacing any default text
 * already in the markup. <title> is left alone — those are hand-written for
 * search and are better than the generic UI string.
 */
function fillI18n(html, lang) {
  return html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g,
    (m, open, tag, key, _inner, close) => {
      if (tag === 'title') return m;
      const text = t(key, lang);
      return text ? `${open}${START}${esc(text)}${END}${close}` : m;
    });
}

function renderPage(page, lang) {
  let html = strip(readFileSync(join(root, page.file), 'utf8'));
  const url = pageUrl(page.path, lang);

  const blocks = page.blocks(lang);
  for (const [id, content] of Object.entries(blocks)) {
    html = fillById(html, id, content);
  }
  // A section the shell hides must be revealed once it has prerendered
  // content, or crawlers never see past events — and hidden again when it is
  // empty, so a second run cannot leave an empty section showing.
  if ('events-past' in blocks) {
    const show = Boolean(blocks['events-past']);
    html = html.replace(/(<section[^>]*\bid="past-section"[^>]*?)(\s+hidden)?(\s*>)/,
      (_m, head, _hidden, tail) => `${head}${show ? '' : ' hidden'}${tail}`);
  }
  html = fillI18n(html, lang);

  // <html> attributes. Drop any data-lang first: re-adding it blindly appended
  // a duplicate on every run and made the output non-idempotent.
  html = html.replace(/<html\s+([^>]*)>/, (_m, attrs) => {
    const rest = attrs
      // data-lang first, and a lookbehind on lang= — plain \b also matched
      // the tail of data-lang, leaving a "data-" that grew on every run.
      .replace(/\bdata-lang="[^"]*"\s*/g, '')
      .replace(/(?<![-\w])lang="[^"]*"\s*/g, '')
      .trim();
    return `<html lang="${lang}" data-lang="${lang}"${rest ? ` ${rest}` : ''}>`;
  });

  // canonical + the pair of hreflang alternates that make the mirror legible
  html = html.replace(/<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="th" href="${pageUrl(page.path, 'th')}">
<link rel="alternate" hreflang="en" href="${pageUrl(page.path, 'en')}">
<link rel="alternate" hreflang="x-default" href="${pageUrl(page.path, 'th')}">`);

  html = html.replace(/<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${url}">`);
  html = html.replace(/<meta property="og:locale" content="[^"]*">\n?/g, '');
  html = html.replace(/(<meta property="og:url"[^>]*>)/,
    `$1\n<meta property="og:locale" content="${lang === 'th' ? 'th_TH' : 'en_US'}">`);

  // structured data, just before </head>
  html = html.replace('</head>',
    `<script type="application/ld+json">\n${jsonLd(page, lang)}\n</script>\n</head>`);

  if (lang === 'en') {
    // Keep internal links inside the mirror. Assets and data stay shared.
    html = html.replace(/href="\/(?!en\/|assets\/|data\/|favicon\/|reference\/docs\/|site\.webmanifest)([^"]*)"/g,
      'href="/en/$1"');
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/,
      `<title>${esc(page.title('en'))} — hpc.in.th</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${esc(page.description('en'))}">`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${esc(page.title('en'))}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${esc(page.description('en'))}">`);
  }

  return html;
}

/* ------------------------------------------------------------------ sitemap */

function sitemap() {
  const rows = PAGES.map((p) => {
    const alts = ['th', 'en'].map((l) =>
      `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(p.path, l)}"/>`).join('\n');
    return ['th', 'en'].map((l) => `  <url>
    <loc>${pageUrl(p.path, l)}</loc>
    <lastmod>${p.updated}</lastmod>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(p.path, 'th')}"/>
  </url>`).join('\n');
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${rows}
</urlset>
`;
}

/* ----------------------------------------------------------------- llms.txt */

function llmsTxt() {
  const docs = REFERENCE.documents.length;
  return `# HPC Thailand — hpc.in.th

> An open, bilingual (Thai/English) record of high performance computing in
> Thailand: a timeline from the first IBM 1620 in 1963 to the present AI-HPC
> era, a directory of the HPC systems currently in service, an archive of
> historical presentations and papers, and community events.
> Maintained by the Thai HPC community. Content is CC BY 4.0.

Every page exists in Thai at the paths below and in English under /en/.
All content is generated from the JSON files in /data/, which are the
canonical source and are usually the fastest thing to read.

## Data (read these first)

- [Timeline](${SITE}/data/timeline.json): ${TIMELINE.entries.length} milestones across ${TIMELINE.eras.length} eras, 1963–present. Bilingual. Updated ${TIMELINE.updated}.
- [Systems](${SITE}/data/systems.json): ${SYSTEMS.systems.length} HPC systems with CPU/GPU/storage/interconnect specs and coordinates. Updated ${SYSTEMS.updated}.
- [Reference documents](${SITE}/data/reference.json): ${docs} presentations, reports and papers, ${REFERENCE.categories.length} categories. Updated ${REFERENCE.updated}.
- [Events](${SITE}/data/events.json): community events. Updated ${EVENTS.updated}.
- [UI strings](${SITE}/data/ui.json): every interface string, in both languages.
- [JSON Schemas](${SITE}/data/schema/): the contract each data file follows.

## Pages

${PAGES.map((p) => `- [${p.title('en')}](${pageUrl(p.path, 'en')}): ${p.description('en')}`).join('\n')}

## Notes for machine readers

- Buddhist-era years are always computed as CE + 543; the data stores CE only.
- Bilingual fields are objects of the shape {"th": "...", "en": "..."}.
- System specifications are as declared by each centre, not benchmarked. A
  system without a "verifiedOn" date has not been confirmed by its operator.
- Coordinates are [longitude, latitude], GeoJSON order.

## Optional

- [Source repository](https://github.com/HPC-Thailand/hpc-th.github.io)
- [How to contribute data](${SITE}/en/submit/)
`;
}

/* --------------------------------------------------------------- robots.txt */

function robotsTxt() {
  // Named explicitly so there is no ambiguity about whether agents are welcome.
  const agents = ['ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'Amazonbot',
    'meta-externalagent', 'cohere-ai', 'DuckAssistBot', 'MistralAI-User'];

  return `# hpc.in.th — an open record of HPC in Thailand.
# Crawlers and AI agents are welcome: the content is CC BY 4.0 and the
# underlying data is served as JSON from /data/. See /llms.txt.

User-agent: *
Allow: /

${agents.map((a) => `User-agent: ${a}\nAllow: /`).join('\n\n')}

Sitemap: ${SITE}/sitemap.xml
`;
}

/* --------------------------------------------------------------------- run */

const outputs = new Map();

for (const page of PAGES) {
  outputs.set(page.file, renderPage(page, 'th'));
  outputs.set(join('en', page.file), renderPage(page, 'en'));
}
outputs.set('sitemap.xml', sitemap());
outputs.set('llms.txt', llmsTxt());
outputs.set('robots.txt', robotsTxt());

let stale = 0;
for (const [rel, content] of outputs) {
  const abs = join(root, rel);
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (current === content) continue;
  stale += 1;
  if (CHECK) {
    console.error(`stale: ${rel}`);
    continue;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`wrote ${rel}`);
}

if (CHECK && stale) {
  console.error(`\n${stale} file(s) out of date. Run: node tools/prerender.mjs`);
  process.exit(1);
}
console.log(CHECK ? 'Prerendered output is up to date.' : `Done — ${outputs.size} files.`);
