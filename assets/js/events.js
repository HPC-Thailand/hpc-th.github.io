/* ============================================================
   HPC Thailand — events listing
   ============================================================ */

import {
  boot, loadJSON, pick, t, esc, onLangChange, observeReveal, setUpdated, lang, ROOT,
} from './core.js';

let DATA = null;

const MONTH = (iso, l) => new Intl.DateTimeFormat(l === 'th' ? 'th-TH' : 'en-GB', { month: 'short' })
  .format(new Date(iso));

function itemMarkup(ev) {
  const start = new Date(ev.start);
  const meta = [pick(ev.organizer), pick(ev.location), ev.format].filter(Boolean).join(' · ');
  return `<article class="event-item reveal">
      <div class="event-date">
        <b>${start.getDate()}</b>
        <span>${esc(MONTH(ev.start, lang))} ${start.getFullYear()}</span>
      </div>
      <div>
        <h3>${esc(pick(ev.title))}</h3>
        <p class="event-meta">${esc(meta)}</p>
      </div>
      ${ev.url ? `<a class="btn btn-ghost" href="${esc(ev.url)}" target="_blank" rel="noopener">${t('events.register')}</a>` : ''}
    </article>`;
}

function paint() {
  const now = Date.now();
  const all = [...(DATA.events || [])].filter((e) => e.start);
  const upcoming = all.filter((e) => new Date(e.end || e.start) >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const past = all.filter((e) => new Date(e.end || e.start) < now)
    .sort((a, b) => new Date(b.start) - new Date(a.start));

  const upEl = document.getElementById('events-upcoming');
  const pastSection = document.getElementById('past-section');

  upEl.innerHTML = upcoming.length
    ? upcoming.map(itemMarkup).join('')
    : `<div class="empty-state">
         <p>${t('events.empty')}</p>
         <a class="btn btn-primary" href="${new URL('submit/', ROOT).pathname}?type=event">${t('events.addEvent')}</a>
       </div>`;

  if (past.length) {
    pastSection.hidden = false;
    document.getElementById('events-past').innerHTML = past.map(itemMarkup).join('');
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
