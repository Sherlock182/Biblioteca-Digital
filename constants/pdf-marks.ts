import AsyncStorage from '@react-native-async-storage/async-storage';

// Kept apart from the Bible's `highlights_*` keys, which the Bible bookmarks list reads by prefix.
const STORAGE_KEY = '@pdf_marks_v1';

/**
 * A passage the reader highlighted on a PDF page: its text, an optional note, and its boxes on the page
 * ([left, top, width, height] as fractions of the page) so the highlight is drawn at any zoom.
 * A mark without boxes covers the whole page (pages that are only an image).
 */
export type PDFMark = { id: string; docId: string; page: number; text: string; note?: string; rects?: number[][]; createdAt: number };

function isMark(value: unknown): value is PDFMark {
  const mark = value as PDFMark;
  return !!mark && typeof mark.id === 'string' && typeof mark.docId === 'string' && typeof mark.text === 'string' &&
    Number.isInteger(mark.page) && mark.page > 0;
}

export async function loadPDFMarks(): Promise<PDFMark[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMark) : [];
  } catch { return []; }
}

let writes: Promise<unknown> = Promise.resolve();
function mutate(change: (marks: PDFMark[]) => PDFMark[]): Promise<void> {
  const next = writes.then(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(change(await loadPDFMarks())));
  });
  writes = next.catch(() => undefined);
  return next;
}

export async function addPDFMark(docId: string, page: number, text: string, note?: string, rects?: number[][]): Promise<PDFMark> {
  const mark: PDFMark = {
    id: 'mark_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    docId, page, text: text.trim(), createdAt: Date.now(),
    ...(note?.trim() ? { note: note.trim() } : {}),
    ...(rects?.length ? { rects } : {}),
  };
  await mutate(marks => [...marks, mark]);
  return mark;
}

export function removePDFMark(id: string): Promise<void> {
  return mutate(marks => marks.filter(mark => mark.id !== id));
}

/** Called when a document leaves the library: its marks go with it. */
export function removePDFMarksOf(docId: string): Promise<void> {
  return mutate(marks => marks.filter(mark => mark.docId !== docId));
}

