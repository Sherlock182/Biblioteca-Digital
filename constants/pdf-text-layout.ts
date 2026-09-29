/**
 * Text reconstruction for PDF pages, shipped as source because it runs inside the viewer
 * WebView next to PDF.js (Hermes cannot serialize functions). Defines three globals:
 *
 * - pdfLayoutPage(items, info, edgeMemory) -> { lines, text, letters }
 *   Rebuilds reading order from glyph positions instead of trusting the content-stream
 *   order: follows the dominant text direction, splits columns at vertical gutters, joins
 *   words by gap, drops superscript markers, running headers/footers and page numbers,
 *   and de-hyphenates line breaks.
 * - pdfTextQuality(text) -> { letters, garbled }
 * - pdfAnalyzeSample(pages, numPages) -> { verdict, numPages, sampledPages, textPages, garbledPages }
 *   verdict: 'text' | 'mixed' (some image-only pages) | 'scanned' (no real text) | 'garbled'.
 */
export const PDF_TEXT_LAYOUT_JS = String.raw`
var PDF_MIN_PAGE_LETTERS = 25;
var pdfLetterRe, pdfLatinRe;
try { pdfLetterRe = new RegExp('\\p{L}', 'gu'); pdfLatinRe = new RegExp('\\p{Script=Latin}', 'gu'); }
catch (e) { pdfLetterRe = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿؀-ۿ]/g; pdfLatinRe = /[A-Za-zÀ-ɏ]/g; }
function pdfCount(re, text) { re.lastIndex = 0; var m = text.match(re); return m ? m.length : 0; }
function pdfMedian(values) {
  if (!values.length) return 0;
  var s = values.slice().sort(function (a, b) { return a - b; });
  return s[Math.floor(s.length / 2)];
}
function pdfSignature(text) { return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); }
var PDF_PAGE_NUMBER_RE = /^[\s\-–—.·|]*(p(á|a)g(ina)?\.?\s*)?(\d{1,4}|[ivxlcdm]{1,7})([\s\/]*(de|of)?[\s\/]*\d{1,4})?[\s\-–—.·|]*$/i;

function pdfNormalizeItems(items) {
  var raw = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it || typeof it.str !== 'string') continue;
    var t = it.transform || [1, 0, 0, 1, 0, 0];
    var str = it.str.replace(/[\s ]+/g, ' ');
    if (!str.trim()) continue;
    var size = Math.hypot(t[2], t[3]) || Math.abs(it.height) || Math.hypot(t[0], t[1]) || 10;
    raw.push({ str: str, x: t[4], y: t[5], w: Math.abs(it.width) || 0, size: size, angle: Math.atan2(t[1], t[0]), idx: i });
  }
  if (!raw.length) return raw;
  // Keep the dominant text direction (weighted by length); stray rotated margin labels are dropped.
  var votes = {}, best = 0, bestKey = '0';
  raw.forEach(function (r) {
    var k = String(Math.round(r.angle / (Math.PI / 12)));
    votes[k] = (votes[k] || 0) + r.str.length;
    if (votes[k] > best) { best = votes[k]; bestKey = k; }
  });
  var dominant = Number(bestKey) * Math.PI / 12, cos = Math.cos(-dominant), sin = Math.sin(-dominant);
  return raw.filter(function (r) {
    var d = Math.abs(r.angle - dominant);
    return Math.min(d, 2 * Math.PI - d) < Math.PI / 18;
  }).map(function (r) {
    var x = r.x * cos - r.y * sin, y = r.x * sin + r.y * cos;
    var w = r.w || r.str.length * r.size * 0.5;
    return { str: r.str, x: x, y: y, w: w, size: r.size, idx: r.idx };
  });
}

function pdfBuildLines(items) {
  var sorted = items.slice().sort(function (a, b) {
    var tol = Math.max(a.size, b.size) * 0.45;
    if (Math.abs(a.y - b.y) > tol) return b.y - a.y;
    return a.x - b.x || a.idx - b.idx;
  });
  var lines = [], line = null;
  sorted.forEach(function (it) {
    if (line && Math.abs(it.y - line.y) <= Math.max(it.size, line.size) * 0.45) { line.items.push(it); line.size = Math.max(line.size, it.size); }
    else { line = { y: it.y, size: it.size, items: [it] }; lines.push(line); }
  });
  return lines.map(function (l) {
    l.items.sort(function (a, b) { return a.x - b.x || a.idx - b.idx; });
    var text = '', prev = null;
    l.items.forEach(function (it) {
      if (prev && it.str === prev.str && Math.abs(it.x - prev.x) < it.size * 0.3) return; // fake-bold overdraw
      if (!prev) text = it.str;
      else {
        var gap = it.x - (prev.x + prev.w);
        var space = gap > it.size * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.str);
        text += (space ? ' ' : '') + it.str;
      }
      prev = it;
    });
    return { text: text.replace(/\s+/g, ' ').trim(), y: l.y, size: l.size, x: l.items[0].x };
  }).filter(function (l) { return l.text; });
}

function pdfFindGutter(items, median) {
  var body = items.filter(function (it) { return it.size >= median * 0.8; });
  if (body.length < 12) return null;
  var minX = Infinity, maxX = -Infinity;
  body.forEach(function (it) { minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x + it.w); });
  var span = maxX - minX;
  if (!(span > median * 10)) return null;
  var bins = 120, cover = new Array(bins).fill(0), binW = span / bins;
  body.forEach(function (it) {
    var a = Math.max(0, Math.floor((it.x - minX) / binW)), b = Math.min(bins - 1, Math.floor((it.x + it.w - minX) / binW));
    for (var k = a; k <= b; k++) cover[k]++;
  });
  var limit = Math.max(1, Math.round(body.length * 0.02)), bestRun = 0, bestAt = -1, run = 0;
  for (var k = Math.floor(bins * 0.2); k <= Math.ceil(bins * 0.8); k++) {
    if (cover[k] <= limit) { run++; if (run > bestRun) { bestRun = run; bestAt = k - run + 1; } }
    else run = 0;
  }
  if (bestAt < 0 || bestRun * binW < Math.max(median * 1.2, span * 0.02)) return null;
  var gx = minX + (bestAt + bestRun / 2) * binW;
  var left = 0, right = 0;
  body.forEach(function (it) { if (it.x + it.w <= gx) left++; else if (it.x >= gx) right++; });
  if (left < body.length * 0.2 || right < body.length * 0.2) return null;
  return gx;
}

function pdfOrderLines(items, median, depth) {
  var gx = depth < 2 ? pdfFindGutter(items, median) : null;
  if (gx === null) return pdfBuildLines(items);
  var slack = median * 0.2, left = [], right = [], span = [];
  items.forEach(function (it) {
    if (it.x + it.w <= gx + slack) left.push(it);
    else if (it.x >= gx - slack) right.push(it);
    else span.push(it);
  });
  var L = pdfOrderLines(left, median, depth + 1), R = pdfOrderLines(right, median, depth + 1), S = pdfBuildLines(span);
  var out = [], li = 0, ri = 0;
  S.concat([{ y: -Infinity, sentinel: true }]).forEach(function (s) {
    while (li < L.length && L[li].y > s.y) out.push(L[li++]);
    while (ri < R.length && R[ri].y > s.y) out.push(R[ri++]);
    if (!s.sentinel) out.push(s);
  });
  return out.concat(L.slice(li), R.slice(ri));
}

function pdfLayoutPage(items, info, edgeMemory) {
  info = info || {};
  var norm = pdfNormalizeItems(items || []);
  if (!norm.length) return { lines: [], text: '', letters: 0 };
  var sizes = [];
  norm.forEach(function (it) { for (var k = 0; k < Math.min(it.str.length, 50); k++) sizes.push(it.size); });
  var median = pdfMedian(sizes) || 10;
  // Superscript footnote/verse markers read as noise ("3En el principio").
  norm = norm.filter(function (it) { return !(it.size < median * 0.72 && /^[\s\d*†‡§¹²³⁰-⁹]{1,4}$/.test(it.str)); });
  var lines = pdfOrderLines(norm, median, 0);
  // Running headers/footers and page numbers at the page edges.
  var view = info.view, top = -Infinity, bottom = Infinity;
  if (view && view.length === 4) { var h = Math.abs(view[3] - view[1]); top = Math.max(view[1], view[3]) - h * 0.1; bottom = Math.min(view[1], view[3]) + h * 0.1; }
  else if (lines.length > 4) { var ys = lines.map(function (l) { return l.y; }); top = Math.max.apply(null, ys) - 1; bottom = Math.min.apply(null, ys) + 1; }
  lines = lines.filter(function (l, i) {
    var edge = (l.y >= top || l.y <= bottom) && (i < 3 || i >= lines.length - 3);
    if (!edge) return true;
    if (PDF_PAGE_NUMBER_RE.test(l.text)) return false;
    if (!edgeMemory) return true;
    var sig = pdfSignature(l.text), seen = edgeMemory[sig] || (edgeMemory[sig] = {});
    seen[info.number || 0] = true;
    return Object.keys(seen).length < 3;
  });
  var gaps = [];
  for (var i = 1; i < lines.length; i++) {
    var g = lines[i - 1].y - lines[i].y;
    if (g > 0 && g < lines[i].size * 3) gaps.push(g);
  }
  var lineGap = pdfMedian(gaps) || median * 1.2, text = '';
  lines.forEach(function (l, i) {
    if (!text) { text = l.text; return; }
    var gap = lines[i - 1].y - l.y;
    if (/[A-Za-zÀ-ÿ][-­‐]$/.test(text) && /^[a-záéíóúüñà-ÿ]/.test(l.text)) text = text.slice(0, -1) + l.text;
    else text += (gap > lineGap * 1.45 ? '\n\n' : ' ') + l.text;
  });
  return { lines: lines.map(function (l) { return l.text; }), text: text, letters: pdfCount(pdfLetterRe, text) };
}

function pdfTextQuality(text) {
  var chars = String(text || '').replace(/\s+/g, '');
  var letters = pdfCount(pdfLetterRe, chars);
  if (!chars.length) return { letters: 0, garbled: false };
  var bad = (chars.match(/[�-\u0000-\u001F]/g) || []).length;
  var latin = pdfCount(pdfLatinRe, chars);
  var words = (String(text).match(/[A-Za-zÀ-ÿ]{4,}/g) || []);
  var noVowel = words.filter(function (w) { return !/[aeiouyáéíóúàèìòùâêîôûäëïöü]/i.test(w); }).length;
  var clusters = words.filter(function (w) { return /[bcdfghjklmnñpqrstvwxz]{5,}/i.test(w); }).length;
  // Badly built text layers: overlapping/duplicated glyphs ("EEll pprriinncciippiioo"), words glued
  // without spaces ("enelprincipiocreóDios") and letters spread apart ("E n e l p r i n c i p i o").
  var tokens = String(text).split(/\s+/).filter(function (t) { return /[A-Za-zÀ-ÿ]/.test(t); });
  var bare = tokens.map(function (t) { return t.replace(/[^A-Za-zÀ-ÿ]/g, ''); }).filter(Boolean);
  var doubled = bare.filter(function (w) {
    if (w.length < 6) return false;
    for (var i = 0; i + 1 < w.length; i += 2) if (w[i].toLowerCase() !== w[i + 1].toLowerCase()) return false;
    return true;
  }).length;
  var glued = bare.filter(function (w) { return w.length >= 20; }).length;
  var single = bare.filter(function (w) { return w.length === 1 && !/^[aeouyAEOUYÁÉÓÚ]$/.test(w); }).length;
  var broken = bare.length >= 8 && (
    doubled / bare.length > 0.15 ||
    (glued >= 3 && glued / bare.length > 0.04) ||
    single / bare.length > 0.25);
  var garbled = letters >= PDF_MIN_PAGE_LETTERS && (
    bad / chars.length > 0.15 || letters / chars.length < 0.45 || broken ||
    (latin / letters > 0.7 && words.length >= 8 && (noVowel + clusters) / words.length > 0.3));
  return { letters: letters, garbled: garbled };
}

function pdfAnalyzeSample(pages, numPages) {
  // Lines repeated on many sampled pages are watermarks ("Digitalizado por…"), not content.
  var freq = {};
  pages.forEach(function (p) {
    var seen = {};
    (p.lines || []).forEach(function (l) { var s = pdfSignature(l); if (!seen[s]) { seen[s] = true; freq[s] = (freq[s] || 0) + 1; } });
  });
  var repeated = Math.max(3, Math.ceil(pages.length * 0.4));
  var textPages = 0, garbledPages = 0, letters = 0;
  pages.forEach(function (p) {
    var body = (p.lines || []).filter(function (l) { return pages.length < 3 || freq[pdfSignature(l)] < repeated; }).join(' ');
    var q = pdfTextQuality(body);
    letters += q.letters;
    if (q.letters >= PDF_MIN_PAGE_LETTERS) { if (q.garbled) garbledPages++; else textPages++; }
  });
  var sampled = pages.length, verdict;
  if (!textPages && !garbledPages) verdict = 'scanned';
  // A sizeable share of badly written pages makes the whole document unreliable to read aloud.
  else if (garbledPages >= Math.max(2, Math.ceil((textPages + garbledPages) * 0.3)) || garbledPages > textPages) verdict = 'garbled';
  else if (textPages / sampled < 0.3 && letters < sampled * 60) verdict = 'scanned';
  else verdict = textPages / sampled >= 0.8 ? 'text' : 'mixed';
  return { verdict: verdict, numPages: numPages, sampledPages: sampled, textPages: textPages, garbledPages: garbledPages };
}

function pdfSamplePages(numPages, max) {
  max = max || 12;
  if (numPages <= max) return Array.from({ length: numPages }, function (_, i) { return i + 1; });
  var out = [];
  for (var k = 0; k < max; k++) {
    var p = Math.round(1 + (numPages - 1) * k / (max - 1));
    if (out.indexOf(p) < 0) out.push(p);
  }
  return out;
}
`;
