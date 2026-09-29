import AsyncStorage from '@react-native-async-storage/async-storage';
import { PDFBookmark, PDFLibrary } from './pdf-books';

const STORAGE_KEY = '@pdf_library_v1';
let writes: Promise<unknown> = Promise.resolve();
function mutate(change: (library: PDFLibrary) => void): Promise<void> {
  const next = writes.then(async () => {
    const library = await PDFLibraryService.loadLibrary();
    change(library);
    await PDFLibraryService.saveLibrary(library);
  });
  writes = next.catch(() => undefined);
  return next;
}

export class PDFLibraryService {
  static async loadLibrary(): Promise<PDFLibrary> {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return { books: [] };
    let parsed: PDFLibrary;
    try { parsed = JSON.parse(data); }
    catch { throw new Error('No se pudo leer la biblioteca guardada. Tus archivos no se han eliminado.'); }
    if (!parsed || !Array.isArray(parsed.books) || parsed.books.some(book =>
      !book || typeof book.id !== 'string' || typeof book.fileUri !== 'string' ||
      typeof book.displayName !== 'string'
    )) throw new Error('La biblioteca guardada tiene un formato no válido.');
    return parsed;
  }
  static async saveLibrary(library: PDFLibrary): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }
  static addBook(book: PDFBookmark): Promise<void> {
    return mutate(library => { if (!library.books.some(b => b.id === book.id)) library.books.push(book); });
  }
  static removeBook(id: string): Promise<void> {
    return mutate(library => { library.books = library.books.filter(b => b.id !== id); });
  }
  static updateBook(book: PDFBookmark): Promise<void> {
    return mutate(library => {
      const index = library.books.findIndex(b => b.id === book.id);
      if (index >= 0) library.books[index] = book;
    });
  }
  static updateProgress(id: string, page: number, totalPages: number): Promise<void> {
    if (!Number.isInteger(page) || !Number.isInteger(totalPages) || totalPages < 1) return Promise.resolve();
    return mutate(library => {
      const book = library.books.find(b => b.id === id);
      if (book) Object.assign(book, {
        currentPage: Math.max(1, Math.min(page, totalPages)), totalPages, lastOpened: Date.now(),
      });
    });
  }
  static async getBook(id: string): Promise<PDFBookmark | null> {
    return (await this.loadLibrary()).books.find(b => b.id === id) || null;
  }
}

