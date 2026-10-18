/**
 * Builds assets/data/platense-notas.json: the section headings and the footnotes of Mons. Straubinger
 * (Biblia Platense, 1948, public domain), from the CrossWire SpaPlatense module.
 *
 * Input: the module exported to JSON as { [osisBook]: { chapters: string[][] } } with the raw OSIS of
 * each verse (e.g. with pysword: bible.get(books=[b], chapters=[c], verses=[v], clean=False)).
 *
 *   node scripts/generate-platense-notas.js <raw.json>
 *
 * Output: { [book]: { "chapter:verse": { h?: [kind, text][], n?: [label, text][] } } }, book names as in
 * biblia-catolica-platense.json. kind: "M" major section, "S" section. In notes, \u0002…\u0003 marks italics.
 */
const fs = require('fs');
const path = require('path');

const OSIS = {
  Genesis: 'Gen', Exodo: 'Exod', Levitico: 'Lev', Numeros: 'Num', Deuteronomio: 'Deut', Josue: 'Josh', Jueces: 'Judg', Rut: 'Ruth',
  '1 Samuel': '1Sam', '2 Samuel': '2Sam', '1 Reyes': '1Kgs', '2 Reyes': '2Kgs', '1 Cronicas': '1Chr', '2 Cronicas': '2Chr',
  Esdras: 'Ezra', Nehemias: 'Neh', Ester: 'Esth', Job: 'Job', Salmos: 'Ps', Proverbios: 'Prov', Eclesiastes: 'Eccl', Cantares: 'Song',
  Isaias: 'Isa', Jeremias: 'Jer', Lamentaciones: 'Lam', Ezequiel: 'Ezek', Daniel: 'Dan', Oseas: 'Hos', Joel: 'Joel', Amos: 'Amos',
  Abdias: 'Obad', Jonas: 'Jonah', Miqueas: 'Mic', Nahum: 'Nah', Habacuc: 'Hab', Sofonias: 'Zeph', Hageo: 'Hag', Zacarias: 'Zech',
  Malaquias: 'Mal', Mateo: 'Matt', Marcos: 'Mark', Lucas: 'Luke', Juan: 'John', Hechos: 'Acts', Romanos: 'Rom', '1 Corintios': '1Cor',
  '2 Corintios': '2Cor', Galatas: 'Gal', Efesios: 'Eph', Filipenses: 'Phil', Colosenses: 'Col', '1 Tesalonicenses': '1Thess',
  '2 Tesalonicenses': '2Thess', '1 Timoteo': '1Tim', '2 Timoteo': '2Tim', Tito: 'Titus', Filemon: 'Phlm', Hebreos: 'Heb', Santiago: 'Jas',
  '1 Pedro': '1Pet', '2 Pedro': '2Pet', '1 Juan': '1John', '2 Juan': '2John', '3 Juan': '3John', Judas: 'Jude', Apocalipsis: 'Rev',
  Tobit: 'Tob', Judit: 'Jdt', '1 Macabeos': '1Macc', '2 Macabeos': '2Macc', Sabiduria: 'Wis', Ecclesiastico: 'Sir', Baruc: 'Bar',
};

const plain = s => s.replace(/<[^>]+>/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
const withItalics = s => plain(s.replace(/<hi type="italic">([\s\S]*?)<\/hi>/g, '\u0002$1\u0003'))
  .replace(/\u0002\s*\u0003/g, '').replace(/\u0003(\s*)\u0002/g, '$1');

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = {};
let headings = 0, notes = 0;
for (const [book, osis] of Object.entries(OSIS)) {
  const entries = {};
  raw[osis].chapters.forEach((verses, ci) => verses.forEach((verse, vi) => {
    // Linked verses (e.g. Sirach 29:16-18) repeat the same content: keep it once.
    if (vi > 0 && verse === verses[vi - 1]) return;
    const entry = {};
    for (const m of verse.matchAll(/<title type="(x-ms|x-s)"[^>]*>([\s\S]*?)<\/title>/g)) {
      const text = plain(m[2].replace(/<note[\s\S]*?<\/note>/g, ''));
      if (text) (entry.h ??= []).push([m[1] === 'x-ms' ? 'M' : 'S', text]);
    }
    for (const m of verse.matchAll(/<note[^>]*>([\s\S]*?)<\/note>/g)) {
      const label = plain((/<reference type="annotateRef">([\s\S]*?)<\/reference>/.exec(m[1]) || [])[1] || '').replace(/[.\s]+$/, '');
      const text = withItalics(m[1].replace(/<reference type="annotateRef">[\s\S]*?<\/reference>/, ''));
      if (text) (entry.n ??= []).push([label, text]);
    }
    if (entry.h || entry.n) {
      entries[(ci + 1) + ':' + (vi + 1)] = entry;
      headings += entry.h?.length ?? 0; notes += entry.n?.length ?? 0;
    }
  }));
  out[book] = entries;
}
const target = path.join(__dirname, '..', 'assets', 'data', 'platense-notas.json');
fs.writeFileSync(target, JSON.stringify(out));
console.log('títulos', headings, '| notas', notes, '|', (fs.statSync(target).size / 1048576).toFixed(1), 'MB');
