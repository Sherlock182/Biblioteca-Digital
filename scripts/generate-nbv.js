/**
 * Builds assets/data/biblia-nbv.json from the USFM of the Biblica® Open Nueva Biblia Viva 2008
 * (CC BY-SA 4.0, https://ebible.org/Scriptures/spaonbv_usfm.zip).
 *
 *   node scripts/generate-nbv.js <folder with the .usfm files>
 *
 * Output: { [book]: string[][] } with the app's book names. A verse printed together with the next
 * ones ("\v 2-15") holds the text and the verses it covers are "" (the reader shows "2-15").
 * Kept from the source: «» quotes and the » that opens each new paragraph of a quotation, dialogue
 * dashes, italics as plain text. Dropped: footnotes. Table rows (Numbers 1-3, 34) become one line
 * each: "Rubén: Elisur (hijo de Sedeúr);". Section headings, psalm titles and the speakers of the
 * Song of Songs go to a second file, nbv-titulos.json, shown above their verse.
 *
 *   node scripts/generate-nbv.js <usfm folder> [bible.json] [titles.json]
 */
const fs = require('fs');
const path = require('path');

const BS = '\\';
const BOOKS = {
  GEN: 'Genesis', EXO: 'Exodo', LEV: 'Levitico', NUM: 'Numeros', DEU: 'Deuteronomio', JOS: 'Josue', JDG: 'Jueces', RUT: 'Rut',
  '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Reyes', '2KI': '2 Reyes', '1CH': '1 Cronicas', '2CH': '2 Cronicas', EZR: 'Esdras',
  NEH: 'Nehemias', EST: 'Ester', JOB: 'Job', PSA: 'Salmos', PRO: 'Proverbios', ECC: 'Eclesiastes', SNG: 'Cantares', ISA: 'Isaias',
  JER: 'Jeremias', LAM: 'Lamentaciones', EZK: 'Ezequiel', DAN: 'Daniel', HOS: 'Oseas', JOL: 'Joel', AMO: 'Amos', OBA: 'Abdias',
  JON: 'Jonas', MIC: 'Miqueas', NAM: 'Nahum', HAB: 'Habacuc', ZEP: 'Sofonias', HAG: 'Hageo', ZEC: 'Zacarias', MAL: 'Malaquias',
  MAT: 'Mateo', MRK: 'Marcos', LUK: 'Lucas', JHN: 'Juan', ACT: 'Hechos', ROM: 'Romanos', '1CO': '1 Corintios', '2CO': '2 Corintios',
  GAL: 'Galatas', EPH: 'Efesios', PHP: 'Filipenses', COL: 'Colosenses', '1TH': '1 Tesalonicenses', '2TH': '2 Tesalonicenses',
  '1TI': '1 Timoteo', '2TI': '2 Timoteo', TIT: 'Tito', PHM: 'Filemon', HEB: 'Hebreos', JAS: 'Santiago', '1PE': '1 Pedro',
  '2PE': '2 Pedro', '1JN': '1 Juan', '2JN': '2 Juan', '3JN': '3 Juan', JUD: 'Judas', REV: 'Apocalipsis',
};
/** A RegExp where "~" stands for a backslash (USFM markers start with one). */
const re = (source, flags = 'g') => new RegExp(source.replace(/~/g, BS + BS), flags);

// Lines that are not verse text.
const SKIP = new Set(['id', 'ide', 'h', 'toc1', 'toc2', 'toc3', 'mt1', 'mt2', 'cl', 'rem', 's1', 's2', 's3', 'ms1', 'sp', 'd', 'r']);

/** One line of USFM as plain text (character markers removed, the words kept). */
function inline(text) {
  return text
    .replace(re('~(f|x) [\\s\\S]*?~\\1\\*'), '')                       // footnotes / cross references
    .replace(re('~\\+?(nd|wj|it|sc|bd|em|xt|add|qs|bk|k|w|tl)\\*'), '')   // closing character markers
    .replace(re('~\\+?(nd|wj|it|sc|bd|em|xt|add|qs|bk|k|w|tl) ?'), '');   // opening character markers
}

// Headings shown above a verse: M major section, S section, D psalm title, P speaker (Song of Songs).
const HEADING_KIND = { ms1: 'M', s1: 'S', s2: 'S', d: 'D', sp: 'P' };

/**
 * The footnotes of a book (\f + \fr 2.23 \ft text\f*), placed by their own reference: [chapter, verse,
 * label, text]. label is the verse part of the reference as printed ("18-23").
 */
function bookFootnotes(usfm) {
  const notes = [];
  for (const m of usfm.matchAll(re('~f [\\s\\S]*?~f\\*'))) {
    const ref = (re('~fr ([0-9.:\\-–]+)', '').exec(m[0]) || [])[1];
    const [chapter, verses] = (ref || '').split(/[.:]/);
    const text = m[0]
      .replace(re('^~f [+\\-*]?\\s*'), '').replace(re('~fr [^~]*'), '').replace(re('~f\\*$'), '')
      .replace(re('~\\+?(ft|fq|fqa|xt|fk|fv|it|nd)\\*'), '')   // closing markers (\+nd* nested inside a note)
      .replace(re('~\\+?(ft|fq|fqa|xt|fk|fv|it|nd)\\s?'), ' ')
      .replace(/\s+/g, ' ').trim();
    if (chapter && verses && text) notes.push([Number(chapter), Number(verses.split(/[-–]/)[0]), verses, polish(text)]);
  }
  return notes;
}

function convertBook(usfm) {
  const chapters = [];
  const headings = {};    // "chapter:verse" -> [kind, text][]
  let pending = [];       // headings waiting for the next verse
  let chapter = null;     // verses of the current chapter: index = verse - 1
  let current = null;     // { verse, parts: string[] } being collected
  let row = null;         // table row cells being collected
  let header = false;
  let afterTable = false; // the text following a table starts on its own line

  const flushRow = () => {
    if (row && current && !header) {
      const cells = row.map(cell => cell.trim()).filter(Boolean);
      if (cells.length) {
        current.parts.push('\n' + (cells.length > 1 ? cells[0].replace(/:$/, '') + ': ' + cells.slice(1).join(', ') : cells[0]));
        afterTable = true;
      }
    }
    row = null; header = false;
  };
  const addText = (text) => {
    if (!text.trim() || !current) return;
    current.parts.push((afterTable ? '\n' : '') + text);
    afterTable = false;
  };
  const flushVerse = () => {
    flushRow();
    if (!current) return;
    const text = current.parts.join(' ')
      .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/^\n+|\n+$/g, '')
      .replace(/\n{2,}/g, '\n').trim();
    chapter[current.verse - 1] = text;
    for (let v = current.verse + 1; v <= current.last; v++) chapter[v - 1] = '';
    current = null;
  };

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const marker = (re('^~([a-z]+[0-9]*)', '').exec(line) || [])[1];
    if (marker === 'c') {
      flushVerse();
      chapter = [];
      chapters[Number(line.slice(3).trim()) - 1] = chapter;
      continue;
    }
    // A \d after the verses (Habakkuk 3:19, the note for the choir director) belongs to the last verse;
    // before the verses it is a psalm title, shown as a heading.
    if (marker === 'd' && current) { addText('\n' + inline(line.slice(2).trim())); continue; }
    if (HEADING_KIND[marker]) {
      const text = polish(inline(line.replace(re('^~[a-z]+[0-9]*\\s?', ''), '')).replace(/\s+/g, ' ').trim());
      if (text) pending.push([HEADING_KIND[marker], text]);
      continue;
    }
    if (SKIP.has(marker)) continue;
    if (marker === 'tr') { flushRow(); row = []; continue; }
    if (marker && /^t[hc]\d$/.test(marker)) {
      if (!row) row = [];
      if (marker.startsWith('th')) header = true;
      row.push(inline(line.replace(re('^~t[hc]\\d\\s?', ''), '')));
      continue;
    }
    // Paragraph-level markers (\p \m \q1 \b …) may carry verse text and \v markers on the same line.
    flushRow();
    const body = marker && marker !== 'v' ? line.replace(re('^~[a-z]+[0-9]*\\s?', ''), '') : line;
    const pieces = body.split(re('~v '));
    pieces.forEach((piece, i) => {
      if (i === 0) { addText(inline(piece)); return; }
      const m = /^(\d+)(?:-(\d+))?\s*/.exec(piece);
      if (!m) throw new Error('Marcador de versículo inválido: ' + piece.slice(0, 40));
      flushVerse();
      afterTable = false;
      current = { verse: Number(m[1]), last: Number(m[2] || m[1]), parts: [inline(piece.slice(m[0].length))] };
      if (pending.length) { headings[chapters.length + ':' + m[1]] = pending; pending = []; }
    });
  }
  flushVerse();
  // Verse numbers the translation skips stay as null (none expected in this Bible).
  return { headings, chapters: chapters.map(verses => Array.from({ length: verses.length }, (_, i) => verses[i] ?? null)) };
}

/** Small corrections of the source, listed so they can be reviewed. */
function polish(text) {
  return text
    .replace(new RegExp(String.fromCharCode(0x2006), 'g'), '')                   // hair space between nested quotes (’ ”): some fonts draw it as a box
    .replace(/\ba el Señor\b/g, 'al Señor')     // "a el Señor" left by the YHWH → Señor replacement
    .replace(/\bde el Señor\b/g, 'del Señor')
    .replace(/ +([,.;:!?)”])/g, '$1')            // no space before closing punctuation
    .replace(/ +»(?=[\s,.;:!?)]|$)/g, '»')       // » closing a quote (a » before a word opens a new paragraph of it)
    .replace(/([(«“¿¡]) +/g, '$1');              // no space after opening punctuation
}

const dir = process.argv[2];
const out = {};
const titles = {};
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.usfm')).sort()) {
  const code = file.slice(3, 6);
  if (!BOOKS[code]) continue;
  const usfm = fs.readFileSync(path.join(dir, file), 'utf8');
  const { chapters, headings } = convertBook(usfm);
  out[BOOKS[code]] = chapters.map(verses => verses.map(text => (text ? polish(text) : text)));
  // Same shape as platense-notas.json: { [book]: { "chapter:verse": { h?: [kind, text][], n?: [label, text][] } } }.
  const entries = Object.fromEntries(Object.entries(headings).map(([key, h]) => [key, { h }]));
  for (const [chapter, verse, label, text] of bookFootnotes(usfm)) {
    // A verse printed inside a range ("1-3") is shown at the start of that range.
    const verses = chapters[chapter - 1] || [];
    let at = verse;
    while (at > 1 && verses[at - 1] === '') at--;
    if (typeof verses[at - 1] !== 'string') throw new Error(`Nota sin versículo: ${BOOKS[code]} ${chapter}:${verse}`);
    ((entries[chapter + ':' + at] ??= {}).n ??= []).push([label, text]);
  }
  titles[BOOKS[code]] = entries;
}
const dataDir = path.join(__dirname, '..', 'assets', 'data');
const target = process.argv[3] || path.join(dataDir, 'biblia-nbv.json');
const titlesTarget = process.argv[4] || path.join(dataDir, 'nbv-titulos.json');
fs.writeFileSync(target, JSON.stringify(out));
fs.writeFileSync(titlesTarget, JSON.stringify(titles));
const count = kind => Object.values(titles).flatMap(book => Object.values(book)).flatMap(e => e.h ?? []).filter(([k]) => k === kind).length;
console.log('libros', Object.keys(out).length, '→', target);
console.log('títulos → ' + titlesTarget + ': sección', count('S'), '| mayores', count('M'), '| salmos', count('D'), '| quién habla', count('P'),
  '| notas', Object.values(titles).flatMap(book => Object.values(book)).reduce((sum, e) => sum + (e.n?.length ?? 0), 0));
