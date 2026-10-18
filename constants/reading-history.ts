import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedDefaultPDFs } from './default-pdfs';
import { PDFLibraryService } from './pdf-library-service';

// Collections on the shelf; a saved reading of a removed collection (the old TaNakh) is ignored.
const SHELF_COLLECTIONS = new Set(['rv1960', 'catolica', 'nbv']);

const LAST_BIBLE_KEY = '@last_bible_reading_v1';

export type BibleReading = {
  kind: 'bible'; collectionId: string; book: string; chapter: number; tanakhLanguage: 'es' | 'he'; at: number;
};
export type PdfReading = { kind: 'pdf'; id: string; title: string; page: number; totalPages: number; at: number };
export type LastReading = BibleReading | PdfReading;

// The RV1960 data uses unaccented book names ("Genesis"); show them properly.
const ACCENTED: Record<string, string> = {
  Genesis: 'Génesis', Exodo: 'Éxodo', Levitico: 'Levítico', Numeros: 'Números', Josue: 'Josué',
  '1 Cronicas': '1 Crónicas', '2 Cronicas': '2 Crónicas', Nehemias: 'Nehemías', Eclesiastes: 'Eclesiastés',
  Isaias: 'Isaías', Jeremias: 'Jeremías', Amos: 'Amós', Abdias: 'Abdías', Jonas: 'Jonás', Nahum: 'Nahúm',
  Sofonias: 'Sofonías', Zacarias: 'Zacarías', Malaquias: 'Malaquías', Galatas: 'Gálatas', Filemon: 'Filemón',
  // Catholic books (the Platense data uses these spellings).
  Sabiduria: 'Sabiduría', Ecclesiastico: 'Eclesiástico',
};
export const displayBookName = (book: string) => ACCENTED[book] ?? book;

export async function saveBibleReading(reading: Omit<BibleReading, 'kind' | 'at'>): Promise<void> {
  const value: BibleReading = { kind: 'bible', ...reading, at: Date.now() };
  await AsyncStorage.setItem(LAST_BIBLE_KEY, JSON.stringify(value)).catch(() => undefined);
}

async function loadBibleReading(): Promise<BibleReading | null> {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(LAST_BIBLE_KEY)) || 'null');
    if (!raw || typeof raw.collectionId !== 'string' || !SHELF_COLLECTIONS.has(raw.collectionId) || typeof raw.book !== 'string' ||
      !Number.isInteger(raw.chapter) || raw.chapter < 1) return null;
    return { kind: 'bible', collectionId: raw.collectionId, book: raw.book, chapter: raw.chapter,
      tanakhLanguage: raw.tanakhLanguage === 'he' ? 'he' : 'es', at: Number(raw.at) || 0 };
  } catch { return null; }
}

async function loadPdfReading(): Promise<PdfReading | null> {
  try {
    const { books } = await PDFLibraryService.loadLibrary();
    // Only documents actually opened (their page count is known once the reader has run).
    const opened = books.filter(book => book.totalPages > 0).sort((a, b) => b.lastOpened - a.lastOpened)[0];
    return opened ? {
      kind: 'pdf', id: opened.id, title: opened.displayName, page: Math.max(1, opened.currentPage || 1),
      totalPages: opened.totalPages, at: opened.lastOpened,
    } : null;
  } catch { return null; }
}

/** The most recent reading across the Bibles and the PDF library, plus the PDF count for the shelf. */
export async function loadLastReadings(): Promise<{ bible: BibleReading | null; latest: LastReading | null; pdfCount: number }> {
  await seedDefaultPDFs();
  const [bible, pdf, pdfCount] = await Promise.all([
    loadBibleReading(),
    loadPdfReading(),
    PDFLibraryService.loadLibrary().then(library => library.books.length).catch(() => 0),
  ]);
  const latest = [bible, pdf].filter((item): item is LastReading => !!item).sort((a, b) => b.at - a.at)[0] ?? null;
  return { bible, latest, pdfCount };
}
