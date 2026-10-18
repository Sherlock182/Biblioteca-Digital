import AsyncStorage from '@react-native-async-storage/async-storage';

import { CATHOLIC_BOOK_LIST, fetchChapterContent, getBooksForCollection } from './scripture';

// The reader saves the marked verses of each chapter under `highlights_<collection>_<book>_<chapter>`.
const PREFIX = 'highlights_';

export type Bookmark = { collectionId: string; book: string; chapter: number; verse: number; text?: string };

/** Books of a collection in reading order, to sort its bookmarks as they appear in the Bible. */
function bookOrder(collectionId: string): string[] {
  if (collectionId === 'catolica') {
    return CATHOLIC_BOOK_LIST.flatMap(item => (item.type === 'book' ? [item.book] : []));
  }
  return [...getBooksForCollection(collectionId, 'antiguo'), ...getBooksForCollection(collectionId, 'nuevo')];
}

/** Every marked verse of every chapter, grouped by collection id (sorted in Bible order). */
export async function loadAllBookmarks(): Promise<Record<string, Bookmark[]>> {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(key => key.startsWith(PREFIX));
  const entries = await AsyncStorage.multiGet(keys).catch(() => [] as readonly [string, string | null][]);
  const result: Record<string, Bookmark[]> = {};
  for (const [key, raw] of entries) {
    // Collection ids have no underscore; book names may, so the chapter is whatever follows the last one.
    const rest = key.slice(PREFIX.length);
    const first = rest.indexOf('_');
    const last = rest.lastIndexOf('_');
    if (first < 1 || last <= first) continue;
    const collectionId = rest.slice(0, first);
    const book = rest.slice(first + 1, last);
    const chapter = Number(rest.slice(last + 1));
    if (!book || !Number.isInteger(chapter) || chapter < 1) continue;
    let verses: unknown;
    try { verses = JSON.parse(raw || '[]'); } catch { continue; }
    if (!Array.isArray(verses)) continue;
    for (const verse of verses) {
      if (typeof verse === 'number' && Number.isInteger(verse) && verse > 0) {
        (result[collectionId] ??= []).push({ collectionId, book, chapter, verse });
      }
    }
  }
  for (const [collectionId, list] of Object.entries(result)) {
    const order = bookOrder(collectionId);
    const rank = (book: string) => { const index = order.indexOf(book); return index < 0 ? order.length : index; };
    list.sort((a, b) => rank(a.book) - rank(b.book) || a.chapter - b.chapter || a.verse - b.verse);
  }
  return result;
}

/** Adds each bookmark's verse text (one chapter load per marked chapter). */
export async function withVerseText(bookmarks: Bookmark[]): Promise<Bookmark[]> {
  const chapters = new Map<string, Promise<Map<number, string>>>();
  const textsOf = (bookmark: Bookmark) => {
    const key = bookmark.book + '|' + bookmark.chapter;
    let texts = chapters.get(key);
    if (!texts) {
      texts = fetchChapterContent(bookmark.collectionId, bookmark.book, bookmark.chapter)
        .then(content => new Map(content.verses.map(verse => [verse.number, verse.text] as const)))
        .catch(() => new Map<number, string>());
      chapters.set(key, texts);
    }
    return texts;
  };
  return Promise.all(bookmarks.map(async bookmark => ({ ...bookmark, text: (await textsOf(bookmark)).get(bookmark.verse) })));
}
