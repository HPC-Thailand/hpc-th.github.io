/* ============================================================
   HPC Thailand — events listing
   ============================================================ */

import {
  boot, loadJSON, pick, t, esc, onLangChange, observeReveal, setUpdated, lang, ROOT,
} from './core.js';

let DATA = null;

const MONTH = (iso, l) => new Intl.DateTimeFormat(l === 'th' ? 'th-TH' : 'en-GB', { month: 'short' })
  .format(new Date(iso));

/** "17 Sep 2026", or "17–19 Sep 2026" when the event runs over several days. */
function dateBadge(ev) {
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : null;
  const sameMonth = end && end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear();
  const day = end && !Number.isNaN(+end) && +end !== +start
    ? (sameMonth ? `${start.getDate()}–${end.getDate()}` : `${start.getDate()}`)
    : `${start.getDate()}`;
  // Thai dates are written in the Buddhist era, English ones in the Common era.
  const year = lang === 'th' ? start.getFullYear() + 543 : start.getFullYear();
  return { day, month: `${MONTH(ev.start, lang)} ${year}` };
}

function metaLine(ev) {
  return [
    ev.time,
    pick(ev.location),
    pick(ev.organizer),
  ].filter(Boolean).join(' · ');
}

function cardMarkup(ev) {
  const { day, month } = dateBadge(ev);
  const img = ev.image
    ? `<a class="event-banner" href="${esc(ev.url || '#')}" target="_blank" rel="noopener"
          tabindex="-1" aria-hidden="true">
         <img src="${esc(new URL(ev.image, ROOT).href)}" alt="" loading="lazy" width="1400" height="734">
       </a>`
    : '';

  const tags = ev.tags?.length
    ? `<div class="event-tags">${ev.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>`
    : '';

  return `<article class="event-card reveal${ev.featured ? ' is-featured' : ''}" id="ev-${esc(ev.id)}">
      ${img}
      <div class="event-main">
        <div class="event-date">
          <b>${esc(day)}</b>
          <span>${esc(month)}</span>
        </div>
        <div class="event-body">
          <h3>${esc(pick(ev.title))}</h3>
          ${ev.subtitle ? `<p class="event-sub">${esc(pick(ev.subtitle))}</p>` : ''}
          ${ev.description ? `<p class="event-desc">${esc(pick(ev.description))}</p>` : ''}
          <p class="event-meta">${esc(metaLine(ev))}</p>
          ${tags}
        </div>
        ${ev.url ? `<a class="btn btn-primary event-cta" href="${esc(ev.url)}" target="_blank" rel="noopener">
            ${t('events.register')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>
          </a>` : ''}
      </div>
    </article>`;
}

function paint() {
  const now = Date.now();
  const all = [...(DATA.events || [])].filter((e) => e.start);
  const upcoming = all.filter((e) => new Date(e.end || e.start) >= now - 864e5)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const past = all.filter((e) => new Date(e.end || e.start) < now - 864e5)
    .sort((a, b) => new Date(b.start) - new Date(a.start));

  const upEl = document.getElementById('events-upcoming');
  const pastSection = document.getElementById('past-section');

  upEl.innerHTML = upcoming.length
    ? upcoming.map(cardMarkup).join('')
    : `<div class="empty-state">
         <p>${t('events.empty')}</p>
         <a class="btn btn-primary" href="${new URL('submit/', ROOT).pathname}?type=event">${t('events.addEvent')}</a>
       </div>`;

  if (past.length) {
    pastSection.hidden = false;
    document.getElementById('events-past').innerHTML = past.map(cardMarkup).join('');
  } else {
    pastSection.hidden = true;
  }

  observeReveal(document.getElementById('main'));
}

(async function main() {
  await boot('events');
  DATA = await loadJSON('data/events.json');
  setUpdated(DATA.updated);
  onLangChange(paint);
  observeReveal();
}());
