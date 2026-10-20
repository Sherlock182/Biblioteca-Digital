const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  const context = { exports, module: { exports }, require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error('Unexpected dependency: ' + name);
  }, console, setTimeout, clearTimeout };
  vm.runInNewContext(code, context, { filename: relative });
  return exports;
}
const { PDF_TEXT_LAYOUT_JS } = load('constants/pdf-text-layout.ts');
const { getPDFViewerHTML } = load('constants/pdf-viewer-html.ts', { './pdf-text-layout': { PDF_TEXT_LAYOUT_JS } });
const { splitTextIntoBlocks, normalizeTextForSpeech } = load('constants/pdf-speech-text.ts');
const WORDS = ['cielos', 'tierra', 'aguas', 'luz', 'tinieblas', 'firmamento', 'mares', 'hierba', 'árboles', 'lumbreras', 'estrellas', 'aves'];
// Distinct prose per page: identical lines on many pages are treated as a watermark.
const prosePage = n => 'En el principio creó Dios los ' + WORDS[n % WORDS.length] + ' y separó las ' + WORDS[(n + 5) % WORDS.length] + ' de lo que estaba desordenado y vacío.';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function book(id) { return { id, fileUri: 'file:///pdf_storage/' + id + '.pdf', displayName: id, fileName: id + '.pdf', currentPage: 1, totalPages: 3, lastOpened: 1, createdAt: 1, notes: {}, highlights: [] }; }

test('speech chunks preserve normalized text without exceeding engine limits', () => {
  for (const text of ['Hola. Segunda frase.', 'x'.repeat(4501), 'Palabra '.repeat(800), '  Texto­ con\nsaltos y ﬁnal.']) {
    const chunks = splitTextIntoBlocks(text, 150);
    assert(chunks.every(chunk => chunk.length > 0 && chunk.length <= 150));
    assert.equal(chunks.join('').replace(/\s/g, ''), normalizeTextForSpeech(text).replace(/\s/g, ''));
  }
});

test('concurrent progress, imports and deletion do not overwrite each other', async () => {
  let data = JSON.stringify({ books: [book('a')] });
  const storage = {
    getItem: async () => { await delay(2); return data; },
    setItem: async (_key, value) => { await delay(2); data = value; },
  };
  const { PDFLibraryService: service } = load('constants/pdf-library-service.ts', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  await Promise.all([service.updateProgress('a', 2, 3), service.addBook(book('b')), service.updateProgress('a', 3, 3)]);
  const saved = JSON.parse(data);
  assert.equal(saved.books.length, 2);
  assert.equal(saved.books[0].currentPage, 3);
  await Promise.all([service.removeBook('a'), service.updateProgress('a', 2, 3)]);
  assert.deepEqual(JSON.parse(data).books.map(b => b.id), ['b']);
});
test('invalid saved library is reported and never overwritten', async () => {
  let data = '{broken';
  const storage = { getItem: async () => data, setItem: async (_key, value) => { data = value; } };
  const { PDFLibraryService: service } = load('constants/pdf-library-service.ts', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  await assert.rejects(service.addBook(book('a')), /biblioteca/);
  assert.equal(data, '{broken');
  data = JSON.stringify({ books: [] });
  await service.addBook(book('a'));
  assert.equal(JSON.parse(data).books.length, 1);
});

// ---- Viewer (PDF.js mocked) ----
function viewerHarness({ failDocument = false, brokenPage = 0, pageItems } = {}) {
  const events = [], canvases = [], loaded = [], listeners = {};
  let concurrent = 0, maxConcurrent = 0;
  const element = () => ({
    style: {}, children: [], classList: { add() {}, toggle() {} }, getContext: () => ({ fillRect() {} }),
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
    setAttribute() {}, querySelectorAll: () => [],
    // The page is drawn at 600×800 CSS px from the top-left corner of the screen.
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 800, bottom: 800 }),
  });
  const container = {
    clientWidth: 360, clientHeight: 600, scrollWidth: 360, scrollHeight: 600, scrollTop: 0, scrollLeft: 0, firstChild: null,
    classList: { toggle() {} }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 600, bottom: 600 }),
    addEventListener(type, handler) { listeners[type] = handler; },
    replaceChildren(child) { this.firstChild = child; canvases.push(child.children?.[0] ?? child); },
  };
  const defaultItems = [
    { str: 'Primera línea', transform: [12, 0, 0, 12, 40, 700], width: 80, hasEOL: true },
    { str: 'Segunda línea', transform: [12, 0, 0, 12, 40, 680], width: 80 },
  ];
  const doc = { numPages: 3, destroy: async () => {}, getPage: async number => ({
    view: [0, 0, 600, 800],
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale, transform: [scale, 0, 0, -scale, 0, 800 * scale] }),
    render: () => ({ promise: (async () => {
      concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent); await delay(2); concurrent--;
      if (number === brokenPage) throw new Error('Operador dañado');
    })() }),
    cleanup() {},
    getTextContent: async () => ({ items: pageItems ? pageItems(number) : defaultItems }),
  }) };
  const context = {
    console, setTimeout, clearTimeout, atob, devicePixelRatio: 4, Uint8Array,
    ReactNativeWebView: { postMessage: text => events.push(JSON.parse(text)) },
    document: {
      getElementById: id => id === 'pages' ? container : { textContent: '' },
      createElement: element,
    },
    addEventListener() {},
    pdfjsWorker: {},
    pdfjsLib: { Util: { transform: (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]] }, getDocument: options => {
      loaded.push(options.data);
      return { promise: failDocument ? Promise.reject({ name: 'InvalidPDFException' }) : Promise.resolve(doc) };
    } },
  };
  context.window = context;
  vm.createContext(context);
  const html = getPDFViewerHTML('', '');
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  return { context, events, canvases, loaded, listeners, getMax: () => maxConcurrent };
}
const lastChange = events => events.filter(e => e.type === 'PAGE_CHANGED').at(-1);

test('viewer restores page, coalesces navigation and bounds zoom/canvas memory', async () => {
  const { context, events, canvases, getMax } = viewerHarness();
  assert.equal(events[0].type, 'VIEWER_READY');
  await context.loadPDF(btoa('%PDF'), 2);
  assert.equal(events.find(e => e.type === 'PAGE_CHANGED').page, 2);
  const before = events.filter(e => e.type === 'PAGE_CHANGED').length;
  await Promise.all([context.goToPage(1), context.goToPage(3), context.goToPage(2)]);
  assert.equal(getMax(), 1);
  assert.equal(events.filter(e => e.type === 'PAGE_CHANGED').length - before, 1, 'a burst of taps draws only the last page');
  assert.equal(lastChange(events).page, 2);
  await context.setPDFZoom(100);
  assert.equal(lastChange(events).zoom, 3);
  assert(canvases.every(c => !c.width || (c.width * c.height <= 6000000 && c.width <= 4096 && c.height <= 4096)));
  await context.requestPageText(3, 42);
  assert.equal(events.at(-1).requestId, 42);
  assert.match(events.at(-1).text, /Primera línea\s+Segunda línea/);
});
test('marking highlights the words dragged over and draws saved marks on their page', async () => {
  const { context, events, listeners } = viewerHarness();
  await context.loadPDF(btoa('%PDF'), 1);
  context.setMarkMode(true);
  await delay(5);
  assert.equal(events.filter(e => e.type === 'MARK_MODE').at(-1).words, 4);
  const touch = (x, y) => ({ clientX: x, clientY: y });
  // From "Primera" (first line) down to "Segunda" (second line).
  listeners.touchstart({ touches: [touch(50, 95)] });
  listeners.touchmove({ touches: [touch(52, 115)], preventDefault() {} });
  listeners.touchend({ changedTouches: [touch(52, 115)] });
  const selection = events.filter(e => e.type === 'MARK_SELECTION').at(-1);
  assert.equal(selection.text, 'Primera línea Segunda');
  assert.equal(selection.count, 3);
  assert.equal(selection.rects.length, 2, 'one box per line');
  assert(!events.some(e => e.type === 'SWIPE'));
  // A tap farther on extends the passage to that word.
  listeners.touchstart({ touches: [touch(110, 115)] });
  listeners.touchend({ changedTouches: [touch(110, 115)] });
  assert.equal(events.filter(e => e.type === 'MARK_SELECTION').at(-1).text, 'Primera línea Segunda línea');
  // Outside marking, tapping a saved highlight reports it.
  context.setMarkMode(false);
  context.setMarks([{ id: 'm1', page: 1, rects: selection.rects }]);
  listeners.touchstart({ touches: [touch(50, 95)] });
  listeners.touchend({ changedTouches: [touch(50, 95)] });
  assert.equal(events.at(-1).type, 'MARK_TAPPED');
  assert.equal(events.at(-1).id, 'm1');
});
test('document arrives in base64 chunks and is reassembled byte for byte', async () => {
  const { context, events, loaded } = viewerHarness();
  context.beginPDF();
  context.appendPDFChunk(btoa('%PDF-1'));
  context.appendPDFChunk(btoa('.7 ok'));
  await context.openPDF(1);
  assert.equal(Buffer.from(loaded[0]).toString('latin1'), '%PDF-1.7 ok');
  assert.equal(events.at(-1).type, 'PDF_READY');
});
test('a damaged page is reported without closing the document', async () => {
  const { context, events } = viewerHarness({ brokenPage: 2 });
  await context.loadPDF(btoa('%PDF'), 1);
  await context.goToPage(2);
  assert(events.some(e => e.type === 'PAGE_ERROR' && e.page === 2));
  assert(!events.some(e => e.type === 'PDF_ERROR'));
  assert.equal(lastChange(events).page, 2);
  await context.goToPage(3);
  assert.equal(lastChange(events).page, 3);
});
test('invalid PDFs produce an actionable message instead of hanging', async () => {
  const { context, events } = viewerHarness({ failDocument: true });
  await context.loadPDF(btoa('bad'), 1);
  assert.equal(events.at(-1).type, 'PDF_ERROR');
  assert.match(events.at(-1).error, /dañado/);
});
test('import analysis rejects image-only documents and accepts real text', async () => {
  const scanned = viewerHarness({ pageItems: () => [] });
  scanned.context.beginPDF(); scanned.context.appendPDFChunk(btoa('%PDF'));
  await scanned.context.analyzePDF();
  assert.equal(scanned.events.at(-1).type, 'ANALYSIS');
  assert.equal(scanned.events.at(-1).verdict, 'scanned');
  const real = viewerHarness({ pageItems: n => [{ str: prosePage(n), transform: [12, 0, 0, 12, 40, 700], width: 500 }] });
  real.context.beginPDF(); real.context.appendPDFChunk(btoa('%PDF'));
  await real.context.analyzePDF();
  assert.equal(real.events.at(-1).verdict, 'text');
  assert.equal(real.events.at(-1).numPages, 3);
});
test('background reading receives the remaining pages in ordered batches', async () => {
  const { context, events } = viewerHarness({ pageItems: n => [{ str: 'Texto de la página ' + n, transform: [12, 0, 0, 12, 40, 700], width: 200 }] });
  await context.loadPDF(btoa('%PDF'), 1);
  await context.requestPageTexts(2, 99, 7);
  const batches = events.filter(e => e.type === 'PAGE_TEXTS');
  assert.equal(batches.length, 1);
  assert.equal(batches[0].requestId, 7);
  assert.equal(batches[0].done, true);
  assert.deepEqual(batches[0].pages.map(p => p.page), [2, 3]);
  assert.match(batches[0].pages[1].text, /página 3/);
});
test('inline scripts cannot be closed early and nothing loads from the network', () => {
  const html = getPDFViewerHTML('/* </script> */', '/* </script> */');
  assert.equal([...html.matchAll(/<script>/g)].length, 4);
  assert.equal([...html.matchAll(/<\/script>/g)].length, 5);
  assert.equal([...html.matchAll(/<\\\/script>/g)].length, 2);
  assert(!/<script[^>]+src=/.test(html));
});

// ---- Text reconstruction ----
const layout = (() => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(PDF_TEXT_LAYOUT_JS, context);
  return context;
})();
const item = (str, x, y, size = 12, width = str.length * size * 0.5) => ({ str, transform: [size, 0, 0, size, x, y], width });
const VIEW = { view: [0, 0, 600, 800] };

test('layout follows geometry, not content-stream order', () => {
  const page = layout.pdfLayoutPage([item('mundo', 80, 700), item('Hola', 40, 700), item('Adiós', 40, 680)], VIEW, {});
  assert.equal(page.text, 'Hola mundo Adiós');
});
test('layout reads two columns left then right, keeping full-width titles first', () => {
  const items = [item('TÍTULO GENERAL DEL CAPÍTULO', 150, 700, 16)];
  for (let i = 0; i < 10; i++) {
    items.push(item('izquierda' + i + ' texto', 40, 650 - i * 16));
    items.push(item('derecha' + i + ' texto', 330, 650 - i * 16));
  }
  const text = layout.pdfLayoutPage(items.reverse(), VIEW, {}).text;
  assert(text.startsWith('TÍTULO GENERAL'), text);
  assert(text.indexOf('izquierda9') < text.indexOf('derecha0'), text);
  const order = [...text.matchAll(/(izquierda|derecha)(\d)/g)].map(m => m[0]);
  assert.deepEqual(order, [...Array(10).keys()].map(i => 'izquierda' + i).concat([...Array(10).keys()].map(i => 'derecha' + i)));
});
test('layout joins hyphenated words, drops verse markers and page numbers', () => {
  const page = layout.pdfLayoutPage([
    item('Capítulo primero', 40, 700),
    item('3', 40, 664, 7), item('Y dijo Dios: Sea la luz; y fue la', 46, 660),
    item('luz. Y vio Dios que la luz era bue-', 40, 646),
    item('na; y separó Dios la luz de las tinieblas.', 40, 632),
    item('- 12 -', 280, 40),
  ], VIEW, {});
  assert.match(page.text, /^Capítulo primero/);
  assert.match(page.text, /era buena; y separó/);
  assert.doesNotMatch(page.text, /\b3\b|12/);
});
test('running headers repeated across pages are removed', () => {
  const memory = {};
  const pageWith = n => layout.pdfLayoutPage([
    item('HISTORIA DEL MUNDO ANGÉLICO', 200, 780),
    item('Contenido real de la página ' + n + ' con bastante texto.', 40, 600),
  ], { view: [0, 0, 600, 800], number: n }, memory);
  pageWith(1); pageWith(2);
  assert.doesNotMatch(pageWith(3).text, /HISTORIA DEL MUNDO/);
});
test('stray rotated margin text is ignored', () => {
  const page = layout.pdfLayoutPage([
    item('Texto principal de la página', 40, 600),
    { str: 'Descargado de ejemplo.org', transform: [0, 12, -12, 0, 580, 300], width: 150 },
  ], VIEW, {});
  assert.equal(page.text, 'Texto principal de la página');
});
test('analysis verdicts: text, mixed, scanned (even with a watermark) and garbled encoding', () => {
  const prose = [...Array(12).keys()].map(n => ({ lines: [prosePage(n)] }));
  const blank = { lines: [] };
  const mark = { lines: ['Digitalizado por Biblioteca Ejemplo www.ejemplo.org'] };
  const garbage = [...Array(12).keys()].map(n => ({ lines: ['Xkdpq wrtzv brpqstl ñkjhgf vbnmrt qwrtpl zxcvbnm psdfghj klmnbv trwqpl'.split(' ').map((w, i) => i === n % 10 ? w + 'q' : w).join(' ') + ' zzkrt' + 'bcdfg'[n % 5].repeat(n + 1)] }));
  assert.equal(layout.pdfAnalyzeSample(prose.slice(0, 10), 10).verdict, 'text');
  assert.equal(layout.pdfAnalyzeSample([...prose.slice(0, 6), ...Array(4).fill(blank)], 10).verdict, 'mixed');
  assert.equal(layout.pdfAnalyzeSample(Array(12).fill(blank), 300).verdict, 'scanned');
  assert.equal(layout.pdfAnalyzeSample(Array(12).fill(mark), 300).verdict, 'scanned');
  assert.equal(layout.pdfAnalyzeSample(garbage, 300).verdict, 'garbled');
  assert.equal(layout.pdfAnalyzeSample([{ lines: ['Hola'] }, ...Array(11).fill(blank)], 12).verdict, 'scanned');
});
test('badly written text layers are rejected: overlapped letters, glued words, spaced letters', () => {
  const pagesOf = make => [...Array(10).keys()].map(n => ({ lines: [make(n)] }));
  const doubled = n => 'EEll pprriinncciippiioo ccrreeóó DDiiooss llooss cciieellooss yy llaa ttiieerrrraa, yy llaa ttiieerrrraa eessttaabbaa ddeessoorrddeennaaddaa ' + WORDS[n % WORDS.length];
  const glued = n => 'Enelprincipiocreódioslos ' + WORDS[n % WORDS.length] + ' ylatierraestabadesordenadayvacía ytinieblasestabansobrelafazdelabismo yelespíritudeDiossemovía sobrelafazdelasaguas ydijoDiosseala luz yfuelaluz';
  const spaced = n => 'E n e l p r i n c i p i o c r e ó D i o s l o s c i e l o s ' + WORDS[n % WORDS.length] + ' y l a t i e r r a';
  assert.equal(layout.pdfAnalyzeSample(pagesOf(doubled), 10).verdict, 'garbled', 'overlapped/duplicated letters');
  assert.equal(layout.pdfAnalyzeSample(pagesOf(glued), 10).verdict, 'garbled', 'words glued without spaces');
  assert.equal(layout.pdfAnalyzeSample(pagesOf(spaced), 10).verdict, 'garbled', 'letters spread apart');
  // A few bad pages in an otherwise good document make it unreliable too.
  const mostlyGood = [...pagesOf(prosePage).slice(0, 7), ...pagesOf(doubled).slice(0, 3)];
  assert.equal(layout.pdfAnalyzeSample(mostlyGood, 10).verdict, 'garbled');
  // …but ordinary Spanish with long words, lists and single-letter words is accepted.
  const normal = n => 'La constitucionalidad y la responsabilidad a veces se discuten, o se ignoran: a) primero, b) segundo, c) tercero. ' + prosePage(n);
  assert.equal(layout.pdfAnalyzeSample(pagesOf(normal), 10).verdict, 'text');
});
test('page sampling spreads over the whole document', () => {
  assert.deepEqual([...layout.pdfSamplePages(5)], [1, 2, 3, 4, 5]);
  const picks = [...layout.pdfSamplePages(208, 12)];
  assert.equal(picks.length, 12);
  assert.equal(picks[0], 1);
  assert.equal(picks.at(-1), 208);
});

// ---- Real PDF.js, offline ----
function samplePDF(content) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n'; });
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return pdf;
}
function pdfjsContext() {
  const context = {
    console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, atob, btoa,
    structuredClone, AbortController, DOMException, ReadableStream,
    document: { currentScript: { src: 'file:///local/pdf.js' } },
    fetch: () => { throw new Error('Network access is forbidden in this test'); },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/pdfjs/pdf.worker.min.txt'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/pdfjs/pdf.min.txt'), 'utf8'), context);
  vm.runInContext(PDF_TEXT_LAYOUT_JS, context);
  return context;
}
function analyzeReal(context, pdf) {
  context.sample = pdf;
  return vm.runInContext(`(async () => {
    const doc = await pdfjsLib.getDocument({ data: new TextEncoder().encode(sample), isEvalSupported: false }).promise;
    const pages = [];
    for (const n of pdfSamplePages(doc.numPages, 12)) {
      const page = await doc.getPage(n);
      pages.push(pdfLayoutPage((await page.getTextContent()).items, { view: page.view, number: n }, null));
    }
    const result = { pages: doc.numPages, text: pages.map(p => p.text).join(' '), verdict: pdfAnalyzeSample(pages, doc.numPages).verdict };
    await doc.destroy();
    return result;
  })()`, context);
}
test('bundled PDF.js reads real PDFs offline and tells text from image-only pages', async () => {
  const context = pdfjsContext();
  const text = await analyzeReal(context, samplePDF(
    'BT /F1 9 Tf 10 150 Td (En el principio era el Verbo, y el Verbo era con Dios.) Tj ' +
    '0 -12 Td (Este era en el principio con Dios; todas las cosas fueron hechas.) Tj ET'));
  assert.equal(text.pages, 1);
  assert.match(text.text, /En el principio era el Verbo, y el Verbo era con Dios\. Este era en el principio/);
  assert.equal(text.verdict, 'text');
  const image = await analyzeReal(context, samplePDF('q 0.5 g 10 10 280 180 re f Q'));
  assert.equal(image.verdict, 'scanned');
});

// ---- Voice ----
const { expandForSpeech, prepareSpeech } = load('constants/pdf-speech-text.ts');
test('speech expands Bible references, roman numerals and abbreviations', () => {
  assert.equal(expandForSpeech('Lee Gn 1:3 hoy.'), 'Lee Génesis, capítulo 1, versículo 3 hoy.');
  assert.equal(expandForSpeech('Ver 1 Co 13:4-7.'), 'Ver Primera de Corintios, capítulo 13, versículos 4 al 7.');
  assert.equal(expandForSpeech('Juan 3:16'), 'Juan, capítulo 3, versículo 16');
  assert.equal(expandForSpeech('Tomo III, cap. 4, pág. 12'), 'Tomo 3, capítulo 4, página 12');
  assert.equal(expandForSpeech('El siglo XX (p. ej. 1950) etc.'), 'El siglo 20 (por ejemplo 1950) etcétera');
  assert.equal(expandForSpeech('• Uno — dos… 50% & más'), 'Uno, dos. 50 por ciento y más');
});
test('speech leaves ordinary text, times and words alone', () => {
  for (const text of ['A las 10:30 salimos.', 'Es 5:3 el marcador.', 'Mi casa y tu casa.', 'Costó 1.000 pesos.', 'Juan Pablo II habló.']) {
    assert.equal(expandForSpeech(text), text);
  }
});
test('speech splits by sentence and paragraph without breaking numbers', () => {
  const paragraphs = prepareSpeech('Primera frase bastante larga de ejemplo para probar aquí. Costó 1.000 pesos y 3.5 kilos en total.\n\nOtro párrafo.', 400);
  assert.equal(paragraphs.length, 2);
  assert.deepEqual([...paragraphs[0]], ['Primera frase bastante larga de ejemplo para probar aquí.', 'Costó 1.000 pesos y 3.5 kilos en total.']);
  assert.deepEqual([...paragraphs[1]], ['Otro párrafo.']);
  assert.deepEqual([...prepareSpeech('Sí. Claro que sí, vamos.')[0]], ['Sí. Claro que sí, vamos.']);
  const long = prepareSpeech('palabra '.repeat(200), 120);
  assert(long[0].every(part => part.length <= 120));
  assert.deepEqual([...prepareSpeech('  \n\n • ')], []);
});

test('background queue keeps page numbers and paragraph pauses, skipping image-only pages', () => {
  const { buildSpeechQueue } = load('constants/pdf-speech-text.ts');
  const queue = buildSpeechQueue([
    { page: 4, text: 'Primera frase bastante larga de la página cuatro aquí. Segunda frase de la página.\n\nNuevo párrafo.' },
    { page: 5, text: '' },
    { page: 6, text: 'Texto de la página seis.' },
  ]);
  assert.deepEqual([...queue.pages], [4, 4, 4, 6]);
  assert.deepEqual([...queue.paragraphEnds], [false, true, true, true]);
  assert.equal(queue.texts[2], 'Nuevo párrafo.');
});

// ---- Home screen ----
test('verse of the day is stable within a day, changes daily and exists offline', async () => {
  const chapters = {};
  const fetchChapterContent = async (_collection, book, chapter) => {
    const file = path.join(root, 'Reina-Valera-1960/procesados', book.toLowerCase().replace(/ /g, '_') + '.js');
    const data = chapters[file] ??= new Function(fs.readFileSync(file, 'utf8').replace('export default', 'return '))();
    return { source: 'local', verses: (data[chapter - 1] || []).map((text, i) => ({ number: i + 1, text })) };
  };
  const verses = load('constants/verse-of-day.ts', {
    './reading-history': { displayBookName: book => ({ Jeremias: 'Jeremías' })[book] ?? book },
    './scripture': { fetchChapterContent },
  });
  const morning = new Date(2026, 8, 28, 7), night = new Date(2026, 8, 28, 23), tomorrow = new Date(2026, 8, 29, 7);
  assert.equal(verses.dailyVerseIndex(morning), verses.dailyVerseIndex(night));
  assert.notEqual(verses.dailyVerseIndex(morning), verses.dailyVerseIndex(tomorrow));
  for (let day = 0; day < verses.DAILY_VERSES.length; day++) {
    const verse = await verses.getVerseOfDay(new Date(2026, 0, 1 + day));
    assert(verse && verse.text.length > 10, 'day ' + day);
  }
});
function appBookLists() {
  const scripture = fs.readFileSync(path.join(root, 'constants/scripture.ts'), 'utf8');
  const list = name => [...scripture.match(new RegExp('export const ' + name + ' = \\[([\\s\\S]*?)\\];'))[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const catholic = [...scripture.match(/export const CATHOLIC_BOOK_LIST[\s\S]*?\n\];/)[0].matchAll(/book: '([^']+)'/g)].map(m => m[1]);
  const chapterCounts = Object.fromEntries([...scripture.match(/export const BOOK_CHAPTERS[^{]*\{([\s\S]*?)\n\};/)[1]
    .matchAll(/'?([^':\n]+?)'?\s*:\s*(\d+)/g)].map(m => [m[1].trim(), +m[2]]));
  return { books: [...list('OLD_TESTAMENT_BOOKS'), ...list('NEW_TESTAMENT_BOOKS')], catholic, chapterCounts };
}
const readBible = file => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', file), 'utf8'));
function countVerses(bible) {
  let verses = 0;
  for (const chapters of Object.values(bible)) chapters.forEach(chapter => {
    assert(chapter[0], 'every chapter starts with text');
    assert(!/\\|strong=/.test(chapter.join(' ')), 'no USFM markup left');
    verses += chapter.filter(Boolean).length;
  });
  return verses;
}

test('Nueva Biblia Viva is complete and different from the RV1960', () => {
  const { books, chapterCounts } = appBookLists();
  const nbv = readBible('biblia-nbv.json');
  assert.deepEqual(Object.keys(nbv).sort(), [...books].sort());
  for (const book of books) assert.equal(nbv[book].length, chapterCounts[book], book);
  assert.equal(countVerses(nbv), 29102);
  // "»" opens a new paragraph of Jesus' words, which began in 3:10 (Spanish typography, as in the source).
  assert.equal(nbv.Juan[2][15], '»Dios amó tanto al mundo, que dio a su único Hijo, para que todo el que cree en él no se pierda, sino tenga vida eterna.');
  assert.equal(nbv.Salmos[22][0], 'El Señor es mi pastor, nada me falta.');
  assert.match(nbv.Numeros[1][2], /^La ubicación de las tribus:\nJudá: Naasón \(hijo de Aminadab\), Al este del santuario, 74\.600\nIsacar/, 'one line per table row');
  // The source's «» quotes are kept (removing them glued sentences together: "rumores.No").
  assert.equal(nbv.Exodo[22][0], '»No acepten falsos rumores. »No cooperen con el malvado apoyando su testimonio, cuando sepan que es falso.');
  assert.match(nbv.Exodo[16][14], /«El Señor-Nisí»/);
  const text = Object.values(nbv).flat(2).filter(Boolean).join('\n');
  assert(!/[,;:.!?][A-Za-zÁÉÍÓÚÑáéíóúñ¿¡«]/.test(text), 'no words glued after punctuation');
  assert(!/ [,.;:!?)”]|[(¿¡«“] /.test(text), 'no stray spaces around punctuation');
  assert(!/\ba el Señor\b/.test(text), '"al Señor", not "a el Señor"');
});
test('RV1960 headings stand above verses of the app text', () => {
  const titles = readBible('rv1960-titulos.json');
  assert.deepEqual(titles.Genesis['1:1'], { h: [['S', 'La creación']] });
  assert.deepEqual(titles.Salmos['3:1'].h.map(([kind]) => kind), ['S', 'D'], 'section heading, then the psalm title');
  assert.deepEqual(titles.Salmos['119:9'], { h: [['P', 'Bet']] });
  const chapters = appBookLists().chapterCounts;
  for (const [book, entries] of Object.entries(titles)) for (const key of Object.keys(entries)) {
    const [chapter] = key.split(':').map(Number);
    assert(chapter >= 1 && chapter <= chapters[book], 'título fuera del libro: ' + book + ' ' + key);
  }
});
test('Nueva Biblia Viva headings are attached to existing verses', () => {
  const nbv = readBible('biblia-nbv.json');
  const titles = readBible('nbv-titulos.json');
  assert.deepEqual(titles.Genesis['11:1'], { h: [['S', 'La torre de Babel']] });
  assert.deepEqual(titles.Salmos['3:1'], { h: [['D', 'Salmo de David, cuando huía de su hijo Absalón.']] });
  assert.deepEqual(titles.Cantares['1:2'].h.map(([kind]) => kind), ['M', 'P'], 'Song of Songs: canto and who speaks');
  // The 68 translator's notes, placed by their own reference (a verse inside a range goes to its start).
  const notes = Object.values(titles).flatMap(book => Object.values(book)).flatMap(entry => entry.n ?? []);
  assert.equal(notes.length, 68);
  assert.deepEqual(titles.Genesis['2:23'].n, [['23', 'En el original la palabra «mujer» y «hombre» vienen de la misma raíz.']]);
  assert(!notes.some(([, text]) => text.includes('\\')), 'no USFM markup left in notes');
  for (const [book, entries] of Object.entries(titles)) for (const key of Object.keys(entries)) {
    const [chapter, verse] = key.split(':').map(Number);
    assert(typeof nbv[book]?.[chapter - 1]?.[verse - 1] === 'string', 'título sin versículo: ' + book + ' ' + key);
  }
});
test('Catholic Bible is the Platense (Straubinger) with the full Catholic canon', () => {
  const { catholic } = appBookLists();
  const bible = readBible('biblia-catolica-platense.json');
  assert.equal(catholic.length, 73);
  for (const book of catholic) assert(bible[book] && bible[book].length > 0, 'falta ' + book);
  assert.equal(bible.Daniel.length, 14, 'Daniel with Susanna (13) and Bel and the Dragon (14)');
  assert.equal(bible.Ester.length, 16, 'Esther with the Greek chapters 11-16 (Vulgate)');
  assert.equal(bible.Baruc.length, 6);
  assert.equal(bible.Abdias.length, 1);
  assert.equal(bible.Filemon.length, 1);
  assert.equal(bible.Hechos[7][36], null, 'Acts 8:37 is omitted, not merged into a range');
  assert.equal(bible.Marcos[8][43], null, 'Mark 9:44 lost its bracketed text in the source: omitted, not "]."');
  assert.equal(bible.Marcos[8][45], null);
  assert(!/\[$/.test(bible.Marcos[8][42]), 'no dangling "[" at the end of Mark 9:43');
  const allText = Object.values(bible).flat(2).filter(Boolean).join('\n');
  assert(!/[{}]/.test(allText), 'no stray braces (1 Chr 29:19, Song 8:6)');
  assert.equal(bible.Lucas[0][27], 'Y entrado donde ella estaba, le dijo: “Salve, llena de gracia; el Señor es contigo”.');
  assert.equal(bible.Salmos[21][0], 'Salmo de David. Yahvé es mi pastor, nada me faltará.', 'Vulgate psalm numbering');
  assert(countVerses(bible) > 35000);
});
test('saved app settings are validated', () => {
  const source = fs.readFileSync(path.join(root, 'constants/app-settings.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? { createContext: () => ({}) } : {} });
  assert.deepEqual({ ...exports.sanitizeAppSettings({ themeId: 'noche', textScale: 1.3, readerFont: 'libro', verseLayout: 'parrafo' }) },
    { themeId: 'noche', textScale: 1.3, readerFont: 'libro', verseLayout: 'parrafo' });
  // Unknown or missing values fall back to the defaults (settings saved before these options existed).
  assert.deepEqual({ ...exports.sanitizeAppSettings({ themeId: 'rosa', textScale: 7 }) },
    { themeId: 'clasico', textScale: 1, readerFont: 'clasica', verseLayout: 'versiculos' });
  assert.deepEqual({ ...exports.sanitizeAppSettings({ readerFont: 'comic', verseLayout: 'tabla' }) },
    { themeId: 'clasico', textScale: 1, readerFont: 'clasica', verseLayout: 'versiculos' });
  assert.equal(exports.THEMES.length, 5);
  assert.equal(exports.THEMES[0].reader.page, '#F6EFD2', 'the classic theme keeps the original reader colors');
});

const voices = load('constants/speech-voices.ts');
test('voice ranking prefers offline, high-quality Latin American Spanish voices', () => {
  const ranked = voices.rankSpanishVoices([
    { identifier: 'en-us-x-iol-local', name: 'en', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'es-es-x-eea-local', name: 'es-es', quality: 'Enhanced', language: 'es-ES' },
    { identifier: 'es-us-x-sfb-network', name: 'net', quality: 'Enhanced', language: 'es-US' },
    { identifier: 'es-us-x-esc-local', name: 'es-us', quality: 'Enhanced', language: 'es-US' },
    { identifier: 'es-mx-basic', name: 'mx', quality: 'Default', language: 'es-MX' },
    { identifier: 'es-us-x-esd-local', name: 'es-us2', quality: 'Enhanced', language: 'es-US' },
  ]);
  assert.deepEqual(ranked.map(v => v.identifier), ['es-us-x-esc-local', 'es-us-x-esd-local', 'es-es-x-eea-local', 'es-mx-basic']);
  assert.equal(ranked[0].label, 'Español (EE. UU.) · Alta calidad · Voz 1');
  assert.equal(ranked[3].label, 'Español (México) · Normal');
});
test('saved voice falls back when uninstalled and settings are always valid', () => {
  const ranked = voices.rankSpanishVoices([{ identifier: 'a', name: 'a', quality: 'Default', language: 'es-MX' }]);
  assert.equal(voices.pickVoice(ranked, 'gone').identifier, 'a');
  assert.equal(voices.pickVoice([], 'gone'), null);
  assert.deepEqual({ ...voices.sanitizeSpeechSettings({ voiceId: 5, rate: 9, pitch: 'x', background: 'yes' }) }, { voiceId: null, rate: 2, pitch: 1, background: true });
  assert.deepEqual({ ...voices.sanitizeSpeechSettings(null) }, { voiceId: null, rate: 1, pitch: 1, background: true });
  assert.equal(voices.sanitizeSpeechSettings({ background: false }).background, false);
});
