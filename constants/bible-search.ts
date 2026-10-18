import { displayBookName } from './reading-history';
import {
  CATHOLIC_BOOK_LIST,
  getBooksForCollection,
  getCatholicBookList,
  getCollectionChapterCount,
  getLocalChapterVerses,
  type TestamentType,
  type VerseLine,
} from './scripture';

/**
 * Search inside one Bible, fully offline: a reference ("Juan 3:16", "jn 3 16", "1 cor 13") jumps to
 * the passage, and words find the verses that contain them, ignoring accents and capitals.
 */

export type SearchVerse = {
  book: string; chapter: number; verse: number; label: string; text: string;
  /** normalize(text) padded with one space on each side, so " word " matches whole words. */
  norm: string;
};
export type BookSuggestion = { book: string; label: string; chapter?: number; verse?: number; verseLabel?: string };
export type TextSegment = { text: string; hit: boolean };

/**
 * Lowercase without accents, anything that is not a letter or digit turned into a space. Every
 * replacement is one character for one, so positions in the result are positions in the original.
 */
export function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, char => PLAIN[char] ?? ' ');
}
const PLAIN: Record<string, string> = {};
for (const [plain, accented] of Object.entries({ a: 'áàâäã', e: 'éèêë', i: 'íìîï', o: 'óòôöõ', u: 'úùûü', n: 'ñ' })) {
  for (const char of accented) PLAIN[char] = plain;
}

/** How a book's name is shown in a Bible (accents; the Catholic list has its own labels). */
export const bookLabel = (collectionId: string, book: string) => (collectionId === 'catolica'
  ? CATHOLIC_BOOK_LIST.find(item => item.type === 'book' && item.book === book)?.label
  : undefined) ?? displayBookName(book);

function collectionBooks(collectionId: string) {
  return collectionId === 'catolica'
    ? getBooksForCollection('catolica')
    : [...getBooksForCollection(collectionId, 'antiguo'), ...getBooksForCollection(collectionId, 'nuevo')];
}

function newTestamentBooks(collectionId: string) {
  const books = collectionId === 'catolica'
    ? getCatholicBookList('nuevo').flatMap(item => (item.type === 'book' ? [item.book] : []))
    : getBooksForCollection(collectionId, 'nuevo');
  return new Set(books);
}

// ── Word search ──────────────────────────────────────────────────────────────

const indexes = new Map<string, SearchVerse[]>();

/** Every verse of a Bible with its normalized text; built once per Bible, the first time it is searched. */
export function getSearchIndex(collectionId: string): SearchVerse[] {
  let index = indexes.get(collectionId);
  if (index) return index;
  index = [];
  for (const book of collectionBooks(collectionId)) {
    const chapters = getCollectionChapterCount(collectionId, book);
    for (let chapter = 1; chapter <= chapters; chapter++) {
      for (const line of getLocalChapterVerses(collectionId, book, chapter)) {
        if (!line.text) continue;
        index.push({
          book, chapter, verse: line.number, label: line.label ?? String(line.number),
          text: line.text, norm: ' ' + normalize(line.text) + ' ',
        });
      }
    }
  }
  indexes.set(collectionId, index);
  return index;
}

/** Words and "quoted phrases" of the query, each as the list of its normalized words. */
function queryTerms(query: string): string[][] {
  const terms: string[][] = [];
  const rest = query.replace(/["“”«»]([^"“”«»]+)["“”«»]?/g, (_, phrase: string) => {
    const words = normalize(phrase).split(' ').filter(Boolean);
    if (words.length) terms.push(words);
    return ' ';
  });
  for (const word of normalize(rest).split(' ')) if (word) terms.push([word]);
  return terms;
}

function termPattern(words: string[], wholeWord: boolean, flags = '') {
  // Normalized text only has [a-z0-9 ], so the words need no escaping. Punctuation became spaces: ' +' between words.
  const body = words.join(' +');
  return new RegExp(wholeWord ? ' ' + body + ' ' : body, flags);
}

export type WordSearch = { results: SearchVerse[]; terms: string[][]; wholeWord: boolean };

/** Verses containing every word / phrase of the query, in Bible order. */
export function searchWords(collectionId: string, query: string, options: { wholeWord: boolean; testament: TestamentType | 'todo' }): WordSearch {
  const terms = queryTerms(query);
  // A lone letter would match almost everything; words need at least two characters.
  if (terms.length === 0 || terms.every(words => words.join('').length < 2)) return { results: [], terms, wholeWord: options.wholeWord };
  const patterns = terms.map(words => termPattern(words, options.wholeWord));
  const nt = options.testament === 'todo' ? null : newTestamentBooks(collectionId);
  const results = getSearchIndex(collectionId).filter(verse =>
    (!nt || nt.has(verse.book) === (options.testament === 'nuevo')) && patterns.every(pattern => pattern.test(verse.norm)));
  return { results, terms, wholeWord: options.wholeWord };
}

/** The verse text cut into plain and matching pieces, to show the found words highlighted. */
export function highlightSegments(verse: SearchVerse, search: WordSearch): TextSegment[] {
  const ranges: [number, number][] = [];
  for (const words of search.terms) {
    const pattern = termPattern(words, search.wholeWord, 'g');
    for (let match = pattern.exec(verse.norm); match; match = pattern.exec(verse.norm)) {
      let start = match.index;
      let end = start + match[0].length;
      if (search.wholeWord) { start += 1; end -= 1; pattern.lastIndex = end; } // keep the closing space for the next match
      ranges.push([start - 1, end - 1]); // norm has one leading space
    }
  }
  if (ranges.length === 0 || verse.norm.length !== verse.text.length + 2) return [{ text: verse.text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const segments: TextSegment[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (end <= at) continue;
    if (start > at) segments.push({ text: verse.text.slice(at, start), hit: false });
    segments.push({ text: verse.text.slice(Math.max(at, start), end), hit: true });
    at = end;
  }
  if (at < verse.text.length) segments.push({ text: verse.text.slice(at), hit: false });
  return segments;
}

// ── References ───────────────────────────────────────────────────────────────

// Common Spanish abbreviations that are not simply the start of the book's name.
const ABBREVIATIONS: Record<string, string> = {
  gn: 'genesis', ex: 'exodo', lv: 'levitico', nm: 'numeros', dt: 'deuteronomio', jos: 'josue', jue: 'jueces', jc: 'jueces',
  '1s': '1samuel', '2s': '2samuel', '1r': '1reyes', '2r': '2reyes', '1cr': '1cronicas', '2cr': '2cronicas',
  esd: 'esdras', neh: 'nehemias', est: 'ester', tb: 'tobit', jdt: 'judit', '1m': '1macabeos', '2m': '2macabeos',
  jb: 'job', sl: 'salmos', sal: 'salmos', pr: 'proverbios', prov: 'proverbios', ecl: 'eclesiastes', qo: 'eclesiastes',
  ct: 'cantares', cnt: 'cantares', sab: 'sabiduria', sb: 'sabiduria', eclo: 'eclesiastico', si: 'eclesiastico',
  is: 'isaias', jr: 'jeremias', lm: 'lamentaciones', ba: 'baruc', bar: 'baruc', ez: 'ezequiel', dn: 'daniel',
  os: 'oseas', jl: 'joel', am: 'amos', abd: 'abdias', jon: 'jonas', mi: 'miqueas', na: 'nahum', ha: 'habacuc',
  sof: 'sofonias', ag: 'hageo', hag: 'hageo', za: 'zacarias', zac: 'zacarias', ml: 'malaquias', mal: 'malaquias',
  mt: 'mateo', mc: 'marcos', mr: 'marcos', lc: 'lucas', jn: 'juan', hch: 'hechos', ro: 'romanos', rm: 'romanos',
  '1co': '1corintios', '2co': '2corintios', ga: 'galatas', gal: 'galatas', ef: 'efesios', flp: 'filipenses', fil: 'filipenses',
  col: 'colosenses', '1ts': '1tesalonicenses', '2ts': '2tesalonicenses', '1tm': '1timoteo', '2tm': '2timoteo',
  tt: 'tito', tit: 'tito', flm: 'filemon', hb: 'hebreos', heb: 'hebreos', stg: 'santiago', st: 'santiago', sant: 'santiago',
  '1p': '1pedro', '2p': '2pedro', '1jn': '1juan', '2jn': '2juan', '3jn': '3juan', jd: 'judas', ap: 'apocalipsis', apoc: 'apocalipsis',
};

/** The line that shows a verse; in the NBV several verses can share one line ("1-3"). */
function lineFor(lines: VerseLine[], verse: number) {
  return lines.find(line => {
    const last = line.label ? Number(line.label.split('-')[1]) : line.number;
    return verse >= line.number && verse <= last;
  });
}

/** `hasChapter`: the query is a reference with a chapter ("juan 3"), so no word search is needed. */
export type ReferenceSearch = { suggestions: BookSuggestion[]; hasChapter: boolean };

/** Books whose name starts like the query, with the chapter and verse when they exist. */
export function parseReference(collectionId: string, query: string): ReferenceSearch {
  // Punctuation (":" "." "," "-") becomes spaces; "juan3" is read as "juan 3".
  const q = normalize(query).replace(/([a-z])(\d)/g, '$1 $2').replace(/ +/g, ' ').trim();
  // [1-3] book [chapter [verse [end of a range]]]
  const match = /^(?:([123]) ?)?([a-z]+)(?: (\d+)(?: (\d+)(?: \d+)?)?)?$/.exec(q);
  if (!match) return { suggestions: [], hasChapter: false };
  const [, number = '', letters, chapterText, verseText] = match;
  const typed = number + letters;
  if (letters.length < 2 && !ABBREVIATIONS[typed]) return { suggestions: [], hasChapter: false };
  const chapter = chapterText ? Number(chapterText) : undefined;
  const verse = verseText ? Number(verseText) : undefined;

  const ranked: { book: string; label: string; rank: number; order: number }[] = [];
  collectionBooks(collectionId).forEach((book, order) => {
    const label = bookLabel(collectionId, book);
    const keys = [normalize(label).replace(/ /g, ''), normalize(book).replace(/ /g, '')];
    const rank = keys.includes(typed) ? 0 : ABBREVIATIONS[typed] && keys.includes(ABBREVIATIONS[typed]) ? 1
      : keys.some(key => key.startsWith(typed)) ? 2
      // Without a number typed, "co" also offers 1 and 2 Corintios (after the books that match fully).
      : !number && keys.some(key => /^\d/.test(key) && key.slice(1).startsWith(typed)) ? 3 : -1;
    if (rank >= 0) ranked.push({ book, label, rank, order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);

  const suggestions: BookSuggestion[] = [];
  for (const { book, label } of ranked) {
    if (suggestions.length >= 5) break;
    if (chapter === undefined) { suggestions.push({ book, label }); continue; }
    if (chapter < 1 || chapter > getCollectionChapterCount(collectionId, book)) continue;
    const line = verse !== undefined ? lineFor(getLocalChapterVerses(collectionId, book, chapter), verse) : undefined;
    suggestions.push({ book, label, chapter, verse: line?.number, verseLabel: line ? line.label ?? String(line.number) : undefined });
  }
  return { suggestions, hasChapter: chapter !== undefined };
}
