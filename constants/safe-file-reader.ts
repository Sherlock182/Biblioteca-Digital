import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

async function fetchFile(uri: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(uri, { signal: controller.signal });
    if (!response.ok) throw new Error(`No se pudo leer el archivo (${response.status}).`);
    return response;
  } finally { clearTimeout(timeout); }
}

export async function readFileAsBase64Safe(uri: string): Promise<string> {
  if (Platform.OS !== 'web') {
    let result: string;
    try { result = await new File(uri).base64(); }
    catch {
      const info = await LegacyFileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('El archivo ya no está disponible. Vuelve a importarlo desde tu biblioteca.');
      result = await LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
    }
    if (!result) throw new Error('El archivo está vacío. Selecciona otro PDF.');
    return result;
  }
  const blob = await (await fetchFile(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el documento.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

export async function readFileAsTextSafe(uri: string): Promise<string> {
  if (Platform.OS !== 'web' && !/^https?:/.test(uri)) {
    try { return await new File(uri).text(); }
    catch { return LegacyFileSystem.readAsStringAsync(uri); }
  }
  return (await fetchFile(uri)).text();
}
