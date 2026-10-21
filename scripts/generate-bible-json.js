/**
 * Builds a Bible for the app from one of the JSON files of https://github.com/mrk214/bible-data-es-spa
 * (for example LBLA_vid_89.json, RVC_vid_146.json, NVI_vid_128.json):
 *
 *   node scripts/generate-bible-json.js <source.json> <id>
 *
 * Writes assets/data/biblia-<id>.json — { [book]: (string | null)[][] } with the app's book names — and
 * assets/data/<id>-titulos.json with the section headings, the divisions of Psalms and the psalm titles
 * (same shape as rv1960-titulos.json, kinds as in constants/bible-extras.ts).
 *
 * Verse text: the lines of a poem are joined with spaces, and a verse cut in two by a heading or a new
 * paragraph is put back together. The ¶ paragraph marks and the » that opens a paragraph of a long speech
 * are dropped (the «» of the dialogues stay). "Selah" (a separate line in these
 * files) goes back to the end of its verse, as it is printed in the Reina-Valera. A verse the translation
 * leaves out of its text (the NVI moves Matthew 17:21 and others to a footnote) is null.
 */
const fs = require('fs');
const path = require('path');

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

const clean = text => text.replace(/¶\s*/g, '').replace(/\s+/g, ' ').trim();
const lineText = item => clean(item.lines.join(' '));
const isSelah = text => /^\(?(Higaión\.?\s*)?Selah\.?\)?$/i.test(text);
const plain = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// The Hebrew letters that open the stanzas of an acrostic (Psalm 119 and others).
const HEBREW_LETTERS = new Set(['alef', 'aleph', 'bet', 'beth', 'guimel', 'gimel', 'dalet', 'daleth', 'he', 'vav', 'vau', 'waw', 'zayin',
  'jet', 'het', 'heth', 'tet', 'teth', 'yod', 'caf', 'kaf', 'kaph', 'lamed', 'mem', 'nun', 'samej', 'samek', 'samekh', 'ayin', 'pe',
  'tsade', 'sade', 'tsadi', 'qof', 'cof', 'kof', 'resh', 'shin', 'sin', 'tav', 'tau']);
const isHebrewLetter = text => HEBREW_LETTERS.has(plain(text).replace(/[.:]$/, ''));
/** "LA ESPOSA:" / "El amado": who speaks next in the Song of Songs, as "La esposa" / "El amado". */
function speakerOf(text) {
  const name = text.replace(/:$/, '').trim();
  if (!/^(el|la|los|las) (esposo|esposa|amado|amada|amigos|amigas|coro|doncellas|hermanos)$/i.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

const [sourcePath, id] = process.argv.slice(2);
if (!sourcePath || !id) {
  console.error('Uso: node scripts/generate-bible-json.js <origen.json> <id>');
  process.exit(1);
}
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const bible = {};
const titles = {};
const counts = { verses: 0, omitted: [], selah: 0, continuation: 0, M: 0, S: 0, D: 0, P: 0 };
for (const book of source.books) {
  const name = BOOKS[book.usfm];
  if (!name) throw new Error('Libro desconocido: ' + book.usfm);
  const chapters = [];
  const entries = {};
  // Headings printed after a chapter's last verse open the next chapter ("El amor" before 1 Corinthians 13).
  let pending = [];
  for (const chapter of book.chapters) {
    const c = Number(chapter.usfm.split('.')[1]);
    const verses = [];
    let last = 0;
    for (const item of chapter.items) {
      const text = lineText(item);
      if (item.type === 'verse') {
        for (const n of item.verse_numbers) {
          // A new verse takes the headings waiting above it; a continuation just adds its text.
          if (verses[n - 1] === undefined && pending.length) { entries[c + ':' + n] = { h: pending }; pending = []; }
          verses[n - 1] = verses[n - 1] ? verses[n - 1] + ' ' + text : text;
          last = Math.max(last, n);
        }
        continue;
      }
      if (!text) continue;
      if (item.type === 'label' && isSelah(text)) {
        if (last) { verses[last - 1] += ' ' + text; counts.selah++; }
        continue;
      }
      let kind = null;
      if (item.type === 'section1') kind = 'M';                                      // LIBRO I … V
      else if (item.type === 'section2') {                                          // "Salmos 1–41" joins its LIBRO
        const previous = pending[pending.length - 1];
        if (previous && previous[0] === 'M') { previous[1] += ' · ' + text; continue; }
        kind = 'M';
      } else if (isHebrewLetter(text)) {
        // Psalm 119 opens each stanza with its letter; elsewhere (Psalms 111-112 in the NVI) the letters
        // fall in the middle of verses, where the app cannot show them.
        if (chapter.usfm !== 'PSA.119') continue;
        kind = 'P';
      } else if (book.usfm === 'SNG' && speakerOf(text)) {
        pending.push(['P', speakerOf(text)]); counts.P++;
        continue;
      } else if (item.type === 'heading1' || item.type === 'heading2') {
        if (/^Salmo \d+$/.test(text)) continue;                                     // repeats the chapter number
        kind = 'S';
      } else if (item.type === 'label') kind = 'D';
      if (kind) { pending.push([kind, text]); counts[kind]++; }
    }
    for (let i = 0; i < verses.length; i++) {
      if (verses[i] === undefined) { verses[i] = null; counts.omitted.push(`${name} ${c}:${i + 1}`); continue; }
      // In print, a » opening a paragraph says the same person goes on speaking; in a verse shown on
      // its own it reads as a stray mark. A closing » always follows a word, never a space.
      const before = verses[i];
      verses[i] = verses[i].replace(/(^|\s)»\s*/g, '$1');
      if (verses[i] !== before) counts.continuation++;
      counts.verses++;
    }
    chapters[c - 1] = verses;
  }
  // After the book's last verse there is no verse to stand above (Habakkuk 3 ends with a note for the singer).
  if (pending.length) console.warn('Sin versículo después, omitido (' + name + '):', pending.map(h => h[1]).join(' · '));
  bible[name] = chapters;
  titles[name] = entries;
}

const dataDir = path.join(__dirname, '..', 'assets', 'data');
fs.writeFileSync(path.join(dataDir, `biblia-${id}.json`), JSON.stringify(bible));
fs.writeFileSync(path.join(dataDir, `${id}-titulos.json`), JSON.stringify(titles));
console.log(`${source.local_abbreviation}: ${Object.keys(bible).length} libros, ${counts.verses} versículos`);
console.log(`versículos sin el » de continuación: ${counts.continuation}`);
console.log(`títulos de sección ${counts.S} | divisiones ${counts.M} | títulos de salmos ${counts.D} | letras del Salmo 119 ${counts.P} | Selah ${counts.selah}`);
console.log(`versículos que la traducción no incluye en el texto: ${counts.omitted.length}`, counts.omitted.join(', '));
