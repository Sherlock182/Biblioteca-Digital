/**
 * Builds assets/data/rv1960-titulos.json: section headings, the divisions of Psalms (LIBRO I…V), the
 * psalm titles and the Hebrew letters of Psalm 119 of the Reina-Valera 1960, shown above their verse.
 * The Bible text itself is not touched. Source: RVR1960_vid_149.json from
 * https://github.com/mrk214/bible-data-es-spa
 *
 *   node scripts/generate-rv1960-titulos.js <RVR1960_vid_149.json>
 *
 * Output: { [book]: { "chapter:verse": { h: [kind, text][] } } } (kinds as in constants/bible-extras.ts).
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

/** The heading kind of a non-verse item, or null to leave it out. */
function kindOf(item, chapterUsfm) {
  const text = item.lines.join(' ').trim();
  if (item.type === 'section1' || item.type === 'section2') return 'M';      // LIBRO I … LIBRO V
  if (item.type === 'heading1' || item.type === 'heading2') return 'S';      // La creación
  if (item.type !== 'label') return null;
  // "Selah" / "Higaion. Selah" are already inside the verse text of the app.
  if (/^(Higaion\.\s*)?Selah\.?$/i.test(text)) return null;
  if (chapterUsfm === 'PSA.119') return 'P';                                  // Alef, Bet… (Psalm 119)
  return 'D';                                                                 // psalm titles
}

const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = {};
const counts = { M: 0, S: 0, D: 0, P: 0 };
const skipped = [];
for (const book of source.books) {
  const name = BOOKS[book.usfm];
  if (!name) continue;
  const entries = {};
  for (const chapter of book.chapters) {
    const c = Number(chapter.usfm.split('.')[1]);
    let pending = [];
    for (const item of chapter.items) {
      if (item.type === 'verse') {
        if (pending.length) { entries[c + ':' + item.verse_numbers[0]] = { h: pending }; pending = []; }
        continue;
      }
      const kind = kindOf(item, chapter.usfm);
      if (kind) { pending.push([kind, item.lines.join(' ').replace(/\s+/g, ' ').trim()]); counts[kind]++; }
    }
    // A heading after the last verse has no verse to stand above (Habakkuk 3: a note that ends verse 19).
    for (const [, text] of pending) skipped.push(chapter.usfm + ': ' + text);
  }
  out[name] = entries;
}
const target = path.join(__dirname, '..', 'assets', 'data', 'rv1960-titulos.json');
fs.writeFileSync(target, JSON.stringify(out));
console.log('títulos de sección', counts.S, '| divisiones', counts.M, '| títulos de salmos', counts.D, '| letras del Salmo 119', counts.P);
if (skipped.length) console.log('sin versículo después (omitidos):', skipped.join(' · '));
