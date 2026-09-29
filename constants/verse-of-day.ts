import { displayBookName } from './reading-history';
import { fetchChapterContent } from './scripture';

/** Well-known RV1960 verses; book names match the local RV1960 data. */
export const DAILY_VERSES: { book: string; chapter: number; verse: number }[] = [
  { book: 'Juan', chapter: 3, verse: 16 }, { book: 'Salmos', chapter: 23, verse: 1 }, { book: 'Filipenses', chapter: 4, verse: 13 },
  { book: 'Jeremias', chapter: 29, verse: 11 }, { book: 'Proverbios', chapter: 3, verse: 5 }, { book: 'Isaias', chapter: 41, verse: 10 },
  { book: 'Romanos', chapter: 8, verse: 28 }, { book: 'Josue', chapter: 1, verse: 9 }, { book: 'Mateo', chapter: 11, verse: 28 },
  { book: 'Salmos', chapter: 46, verse: 1 }, { book: 'Isaias', chapter: 40, verse: 31 }, { book: 'Salmos', chapter: 119, verse: 105 },
  { book: '2 Timoteo', chapter: 1, verse: 7 }, { book: 'Mateo', chapter: 6, verse: 33 }, { book: 'Salmos', chapter: 37, verse: 5 },
  { book: 'Juan', chapter: 14, verse: 6 }, { book: 'Hebreos', chapter: 11, verse: 1 }, { book: 'Romanos', chapter: 12, verse: 2 },
  { book: 'Galatas', chapter: 5, verse: 22 }, { book: 'Salmos', chapter: 27, verse: 1 }, { book: '1 Corintios', chapter: 13, verse: 4 },
  { book: 'Proverbios', chapter: 16, verse: 3 }, { book: 'Juan', chapter: 16, verse: 33 }, { book: 'Salmos', chapter: 91, verse: 1 },
  { book: 'Mateo', chapter: 5, verse: 16 }, { book: 'Efesios', chapter: 2, verse: 8 }, { book: 'Salmos', chapter: 34, verse: 8 },
  { book: 'Lamentaciones', chapter: 3, verse: 22 }, { book: '1 Pedro', chapter: 5, verse: 7 }, { book: 'Santiago', chapter: 1, verse: 5 },
  { book: 'Salmos', chapter: 121, verse: 1 }, { book: 'Isaias', chapter: 26, verse: 3 }, { book: 'Juan', chapter: 8, verse: 32 },
  { book: 'Romanos', chapter: 15, verse: 13 }, { book: 'Salmos', chapter: 55, verse: 22 }, { book: 'Mateo', chapter: 7, verse: 7 },
  { book: 'Deuteronomio', chapter: 31, verse: 6 }, { book: 'Salmos', chapter: 16, verse: 11 }, { book: 'Colosenses', chapter: 3, verse: 23 },
  { book: 'Hebreos', chapter: 13, verse: 5 }, { book: 'Proverbios', chapter: 18, verse: 10 }, { book: '2 Corintios', chapter: 5, verse: 17 },
  { book: 'Salmos', chapter: 139, verse: 14 }, { book: 'Juan', chapter: 15, verse: 5 }, { book: 'Isaias', chapter: 43, verse: 2 },
  { book: 'Miqueas', chapter: 6, verse: 8 }, { book: 'Salmos', chapter: 100, verse: 4 }, { book: '1 Juan', chapter: 4, verse: 19 },
  { book: 'Nahum', chapter: 1, verse: 7 }, { book: 'Romanos', chapter: 5, verse: 8 }, { book: 'Salmos', chapter: 30, verse: 5 },
  { book: 'Mateo', chapter: 28, verse: 20 }, { book: 'Sofonias', chapter: 3, verse: 17 }, { book: 'Efesios', chapter: 3, verse: 20 },
  { book: 'Salmos', chapter: 143, verse: 8 }, { book: 'Eclesiastes', chapter: 3, verse: 1 }, { book: 'Juan', chapter: 11, verse: 25 },
  { book: 'Habacuc', chapter: 3, verse: 19 }, { book: 'Apocalipsis', chapter: 21, verse: 4 }, { book: 'Genesis', chapter: 1, verse: 1 },
];

export type DailyVerse = { book: string; chapter: number; verse: number; reference: string; text: string };

/** Same verse all day, a different one each day (local calendar date). */
export function dailyVerseIndex(date: Date = new Date()): number {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return ((day % DAILY_VERSES.length) + DAILY_VERSES.length) % DAILY_VERSES.length;
}

export async function getVerseOfDay(date: Date = new Date()): Promise<DailyVerse | null> {
  const start = dailyVerseIndex(date);
  // If a verse were missing from the local data, fall through to the next one.
  for (let offset = 0; offset < 5; offset++) {
    const ref = DAILY_VERSES[(start + offset) % DAILY_VERSES.length];
    try {
      const content = await fetchChapterContent('rv1960', ref.book, ref.chapter);
      const text = content.source === 'local' ? content.verses.find(item => item.number === ref.verse)?.text : undefined;
      if (text) return { ...ref, text, reference: displayBookName(ref.book) + ' ' + ref.chapter + ':' + ref.verse };
    } catch { /* try the next verse */ }
  }
  return null;
}
