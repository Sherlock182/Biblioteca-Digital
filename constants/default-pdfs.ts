import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { createPDFBookmark } from './pdf-books';
import { PDFLibraryService } from './pdf-library-service';
import { PDFStorageService } from './pdf-storage-service';

/** Ids of the bundled books already added once. A book the user deletes is never added back. */
const SEEDED_KEY = '@pdf_default_books_v1';

// Books bundled with the app (new public-domain translations made for Iglesia Peniel).
const DEFAULT_PDFS = [
  {
    id: 'didaje-diogneto',
    module: require('@/assets/pdfs/didaje-y-carta-a-diogneto.pdf'),
    fileName: 'didaje-y-carta-a-diogneto.pdf',
    displayName: 'La Didajé y la Carta a Diogneto',
  },
  {
    id: 'martires-iglesia-primitiva',
    module: require('@/assets/pdfs/martires-de-la-iglesia-primitiva.pdf'),
    fileName: 'martires-de-la-iglesia-primitiva.pdf',
    displayName: 'Los Mártires de la Iglesia Primitiva',
  },
];

let seeding: Promise<void> | null = null;

/** Copies the bundled books into the PDF library the first time the app runs. Safe to call often. */
export function seedDefaultPDFs(): Promise<void> {
  if (!seeding) seeding = run().catch(() => { seeding = null; });
  return seeding;
}

async function run() {
  if (Platform.OS === 'web') return;
  let done: string[] = [];
  try { done = JSON.parse((await AsyncStorage.getItem(SEEDED_KEY)) || '[]'); } catch { /* start over */ }
  for (const book of DEFAULT_PDFS) {
    if (done.includes(book.id)) continue;
    const asset = Asset.fromModule(book.module);
    await asset.downloadAsync();
    if (!asset.localUri) continue;
    // Stored like an imported PDF, so it can be read, highlighted and deleted the same way.
    const uri = await PDFStorageService.copyPDFPermanently(asset.localUri);
    const bookmark = createPDFBookmark(uri, book.fileName, book.displayName, 0);
    bookmark.lastOpened = 0; // not opened yet: keeps it out of "Continuar leyendo"
    await PDFLibraryService.addBook(bookmark);
    done.push(book.id);
    await AsyncStorage.setItem(SEEDED_KEY, JSON.stringify(done));
  }
}
