/* ============================================================
   hpc.in.th — in-page PDF reader

   Renders PDFs with PDF.js rather than an <iframe>. Embedded PDF
   plugins are unreliable — Electron shells abort the request outright
   and iOS Safari only paints the first page — so we rasterise pages
   ourselves and get the same result in every browser.
   ============================================================ */

// Vendored under assets/vendor/ by tools/fetch-vendor.mjs — see the note
// there on why this is not loaded from a CDN.
const PDFJS_VERSION = '4.10.38';
const CDN = `/assets/vendor/pdf.js-${PDFJS_VERSION}`;

let pdfjsPromise = null;

/** Load PDF.js once, on first use, so other pages never pay for it. */
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`${CDN}/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsPromise;
}

export class PdfReader {
  /**
   * @param {HTMLElement} stage scroll container the pages are rendered into
   * @param {(state: {page: number, pages: number}) => void} [onState]
   */
  constructor(stage, onState) {
    this.stage = stage;
    this.onState = onState || (() => {});
    this.doc = null;
    this.scale = 1;
    this.pageEls = [];
    this.rendered = new Set();
    this.token = 0;
  }

  /** Base width the "100%" zoom level fits pages to. */
  get baseWidth() {
    return Math.min(this.stage.clientWidth - 48, 1100);
  }

  async open(url) {
    const token = ++this.token;
    this.destroy({ keepToken: true });

    const pdfjs = await loadPdfJs();
    if (token !== this.token) return;

    const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
    if (token !== this.token) { doc.destroy(); return; }

    this.doc = doc;
    this.scale = 1;
    await this.layout();
  }

  /** Create one placeholder per page at the right aspect ratio, then
      render only what comes into view. */
  async layout() {
    const doc = this.doc;
    if (!doc) return;
    const token = this.token;

    this.stage.innerHTML = '';
    this.pageEls = [];
    this.rendered.clear();

    const first = await doc.getPage(1);
    if (token !== this.token) return;
    const unscaled = first.getViewport({ scale: 1 });
    const fit = (this.baseWidth / unscaled.width) * this.scale;

    for (let n = 1; n <= doc.numPages; n += 1) {
      const holder = document.createElement('div');
      holder.className = 'pdf-page';
      holder.dataset.page = String(n);
      // Reserve the right height up front so the scrollbar does not jump.
      holder.style.width = `${Math.round(unscaled.width * fit)}px`;
      holder.style.height = `${Math.round(unscaled.height * fit)}px`;
      this.stage.append(holder);
      this.pageEls.push(holder);
    }

    this.fit = fit;
    this.onState({ page: 1, pages: doc.numPages });
    this.update();
  }

  /** Render whatever is near the viewport, and report the current page.
      Driven from scroll position rather than IntersectionObserver, which
      goes quiet while the tab is backgrounded and leaves pages blank. */
  update() {
    if (!this.doc) return;
    const { scrollTop, clientHeight } = this.stage;
    const from = scrollTop - clientHeight * 1.5;
    const to = scrollTop + clientHeight * 2.5;

    for (const el of this.pageEls) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (bottom >= from && top <= to) this.renderPage(Number(el.dataset.page));
      else if (top > to) break;
    }
    this.reportCurrent();
  }

  async renderPage(n) {
    if (this.rendered.has(n) || !this.doc) return;
    this.rendered.add(n);
    const token = this.token;

    const page = await this.doc.getPage(n);
    if (token !== this.token) return;

    const viewport = page.getViewport({ scale: this.fit });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const params = { canvasContext: canvas.getContext('2d', { alpha: false }), viewport };
    // `transform` must be an array or absent — passing null makes the render
    // task hang and never settle.
    if (ratio !== 1) params.transform = [ratio, 0, 0, ratio, 0, 0];

    await page.render(params).promise;
    if (token !== this.token) return;

    const holder = this.pageEls[n - 1];
    holder?.replaceChildren(canvas);
    this.reportCurrent();
  }

  /** Report the topmost page in view, the way a PDF viewer labels it —
      measuring from the middle instead reads as page 2 while still at the top. */
  reportCurrent() {
    if (!this.doc) return;
    const mark = this.stage.scrollTop + 80;
    let current = 1;
    for (const el of this.pageEls) {
      if (el.offsetTop <= mark) current = Number(el.dataset.page);
      else break;
    }
    this.onState({ page: current, pages: this.doc.numPages });
  }

  goTo(n) {
    const el = this.pageEls[Math.max(0, Math.min(this.pageEls.length - 1, n - 1))];
    if (el) this.stage.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
  }

  async zoom(delta) {
    // Snap to the step so 1 + 0.25 stays 1.25 rather than rounding to 1.3.
    const next = Math.max(0.5, Math.min(3, Math.round((this.scale + delta) / 0.25) * 0.25));
    // Always report the level, so the label stays right at the clamp limits.
    if (next === this.scale) return this.scale;
    this.scale = next;
    await this.layout();
    return this.scale;
  }

  destroy({ keepToken = false } = {}) {
    if (!keepToken) this.token += 1;
    this.doc?.destroy();
    this.doc = null;
    this.pageEls = [];
    this.rendered.clear();
    this.stage.innerHTML = '';
  }
}
