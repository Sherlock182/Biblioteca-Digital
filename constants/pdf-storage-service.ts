import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { readFileAsBase64Safe } from './safe-file-reader';

export const MAX_PDF_BYTES = 40 * 1024 * 1024;

/** Size of a local file, or null when it is missing. Uses the legacy API because the
 *  new File.exists/size report picker cache files as missing in Expo Go. */
export async function getLocalFileSize(uri: string): Promise<number | null> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    if (info.exists && !info.isDirectory) return info.size ?? 0;
  } catch { /* fall through to the new API */ }
  try {
    const file = new File(uri);
    if (file.exists) return file.size ?? 0;
  } catch { /* unavailable */ }
  return null;
}

function storageDirectory(): string {
  const root = LegacyFileSystem.documentDirectory;
  if (!root) throw new Error('El almacenamiento local no está disponible en este dispositivo.');
  return root.replace(/\/?$/, '/') + 'pdf_storage/';
}

export class PDFStorageService {
  static readPDFAsBase64 = readFileAsBase64Safe;

  static async copyPDFPermanently(sourceUri: string, expectedSize?: number | null): Promise<string> {
    if (Platform.OS === 'web') throw new Error('Importa tus documentos desde la app de Android o iPhone.');
    const size = (await getLocalFileSize(sourceUri)) ?? expectedSize ?? null;
    if (size === null) throw new Error('El documento no está disponible. Selecciónalo de nuevo.');
    if (size === 0) throw new Error('El documento está vacío. Selecciona otro PDF.');
    if (size > MAX_PDF_BYTES) throw new Error('Selecciona un PDF de hasta 40 MB.');
    const directory = storageDirectory();
    const destination = directory + `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.pdf`;
    // Only the legacy API is used here: Expo Go scopes file access to the experience's own
    // directories, which the new File/Paths API does not respect, and denies reading the
    // picker's cache copy. On Android the picker hands us a content:// URI instead.
    const dirInfo = await LegacyFileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) await LegacyFileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await LegacyFileSystem.copyAsync({ from: sourceUri, to: destination });
    if (!(await getLocalFileSize(destination))) {
      await LegacyFileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
      throw new Error('No se pudo guardar una copia del documento. Revisa el espacio disponible.');
    }
    return destination;
  }

  static async deleteOwnedPDF(uri: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const prefix = storageDirectory();
    // Only delete the app's copy, never the user's source document.
    if (!uri.startsWith(prefix) || !/^pdf_[a-zA-Z0-9_]+\.pdf$/.test(uri.slice(prefix.length))) return;
    await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
  }
}
