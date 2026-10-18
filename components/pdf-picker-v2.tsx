import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { seedDefaultPDFs } from '@/constants/default-pdfs';
import { createPDFBookmark, PDFBookmark } from '@/constants/pdf-books';
import { PDFLibraryService } from '@/constants/pdf-library-service';
import { MAX_PDF_BYTES, PDFStorageService } from '@/constants/pdf-storage-service';
import { readFileAsBase64Safe } from '@/constants/safe-file-reader';
import { AppTheme, mergeStyles, useAppSettings } from '@/constants/app-settings';
import { usePDFAnalyzer } from './pdf-analyzer';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DimensionValue, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

class RejectedPDFError extends Error {}

const CLASSIC_ICONS = {
  nav: '#493725', muted: '#7C6B58', accent: '#65482F', danger: '#8E5447', empty: '#87633D', spinner: '#79583C', onPrimary: '#FFF', chevron: '#8B755C',
};

/** Library colors for the chosen theme; the classic theme is the original design. */
function libraryTheme(theme: AppTheme) {
  if (theme.id === 'clasico') return { styles: baseStyles, icons: CLASSIC_ICONS };
  const ui = theme.ui;
  return {
    icons: {
      nav: ui.text, muted: ui.muted, accent: ui.accent, danger: ui.danger, empty: ui.accent, spinner: ui.accent, onPrimary: ui.primaryText, chevron: ui.muted,
    },
    styles: mergeStyles(baseStyles, {
      screen: { backgroundColor: ui.page }, brand: { color: ui.muted },
      badge: { backgroundColor: ui.soft }, badgeText: { color: ui.accent },
      title: { color: ui.text }, subtitle: { color: ui.muted },
      addButton: { backgroundColor: ui.primary }, addText: { color: ui.primaryText }, hint: { color: ui.muted },
      search: { backgroundColor: ui.card, borderColor: ui.border }, searchInput: { color: ui.text },
      count: { color: ui.muted }, sortText: { color: ui.accent },
      card: { backgroundColor: ui.card, borderColor: ui.border },
      cover: { backgroundColor: ui.accent, borderLeftColor: ui.primary },
      bookTitle: { color: ui.text }, bookMeta: { color: ui.muted },
      track: { backgroundColor: ui.soft }, fill: { backgroundColor: ui.accent },
      emptyIcon: { backgroundColor: ui.soft }, emptyTitle: { color: ui.text }, emptyDescription: { color: ui.muted },
    }),
  };
}

export default function PDFLibrary() {
  const router = useRouter();
  const analyzer = usePDFAnalyzer();
  const { theme } = useAppSettings();
  const { styles, icons } = useMemo(() => libraryTheme(theme), [theme]);
  const [stage, setStage] = useState('');
  const [books, setBooks] = useState<PDFBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  // Only the first load shows the spinner; coming back from the reader refreshes the list in place.
  const load = useCallback(async () => {
    setError('');
    try {
      await seedDefaultPDFs();
      setBooks((await PDFLibraryService.loadLibrary()).books);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la biblioteca.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return books.filter(book => normalize(book.displayName).includes(normalize(query.trim())))
      .sort((a, b) => sort === 'name' ? a.displayName.localeCompare(b.displayName, 'es') : b.lastOpened - a.lastOpened);
  }, [books, query, sort]);
  const open = (book: PDFBookmark) => router.push({ pathname: '/pdf-reader-v2', params: { bookmarkId: book.id } });
  const add = async () => {
    if (busyRef.current || error) return;
    busyRef.current = true; setBusy(true);
    let copied: string | undefined;
    let saved = false;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf',
        // Android: keep the content:// URI. Expo Go denies both file-system APIs access to the
        // picker's cache copy, but the legacy copyAsync can read content URIs through the resolver.
        copyToCacheDirectory: Platform.OS !== 'android', multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_PDF_BYTES) throw new Error('Selecciona un PDF de hasta 40 MB.');
      setStage('Copiando documento…');
      copied = await PDFStorageService.copyPDFPermanently(asset.uri, asset.size);
      setStage('Comprobando que tenga texto…');
      const analysis = await analyzer.analyze(await readFileAsBase64Safe(copied));
      if (analysis.verdict === 'scanned') throw new RejectedPDFError(
        'Este PDF está hecho de imágenes escaneadas y no contiene texto real, así que la app no puede leerlo ni escucharlo. ' +
        'Si lo necesitas, conviértelo primero con una herramienta de OCR (reconocimiento de texto) y vuelve a importarlo.');
      if (analysis.verdict === 'garbled') throw new RejectedPDFError(
        'El texto de este PDF está mal escrito: tiene letras encimadas o repetidas, palabras pegadas sin espacios ' +
        'o una codificación ilegible. Se vería y se escucharía con errores, por eso no se importó. ' +
        'Prueba con otra copia o edición del documento.');
      const name = asset.name || 'Documento.pdf';
      const bookmark = createPDFBookmark(copied, name, name.replace(/\.pdf$/i, '').slice(0, 100), analysis.numPages);
      await PDFLibraryService.addBook(bookmark);
      saved = true;
      setBooks(current => [bookmark, ...current]);
      if (analysis.verdict === 'mixed') Alert.alert('Documento importado',
        'Algunas páginas de este PDF son solo imágenes. Se mostrarán, pero se omitirán al escuchar.');
      open(bookmark);
    } catch (cause) {
      if (copied && !saved) await PDFStorageService.deleteOwnedPDF(copied).catch(() => undefined);
      Alert.alert(cause instanceof RejectedPDFError ? 'PDF no compatible' : 'No se pudo importar',
        cause instanceof Error ? cause.message : 'Intenta seleccionar el archivo otra vez.');
    } finally { busyRef.current = false; setBusy(false); setStage(''); }
  };
  const remove = (book: PDFBookmark) => {
    Alert.alert('Eliminar de la biblioteca', 'Se eliminará la copia de “' + book.displayName + '” y su progreso. El archivo original se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true);
        void (async () => {
          await PDFLibraryService.removeBook(book.id);
          setBooks(current => current.filter(item => item.id !== book.id));
          try { await PDFStorageService.deleteOwnedPDF(book.fileUri); }
          catch { Alert.alert('Documento retirado', 'Se quitó de la biblioteca, pero no se pudo liberar el espacio de su copia local.'); }
        })().catch(() => Alert.alert('No se pudo eliminar', 'Tu documento sigue en la biblioteca.'))
          .finally(() => { busyRef.current = false; setBusy(false); });
      } },
    ]);
  };
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <StatusBar style={theme.ui.statusBar} />
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al inicio" onPress={() => router.back()} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={icons.nav} />
        </Pressable>
        <Text style={styles.brand}>BIBLIOTECA DIGITAL</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>PDF</Text></View>
      </View>
      <View style={styles.intro}>
        <Text style={styles.title}>Tu espacio de lectura</Text>
        <Text style={styles.subtitle}>Guarda tus documentos y retoma donde te quedaste.</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || loading || !!error || Platform.OS === 'web' }}
          disabled={busy || loading || !!error || Platform.OS === 'web'} onPress={() => void add()}
          style={({ pressed }) => [styles.addButton, (busy || loading || !!error || Platform.OS === 'web' || pressed) && styles.dimmed]}>
          {busy ? <ActivityIndicator color={icons.onPrimary} /> : <MaterialIcons name="add" size={22} color={icons.onPrimary} />}
          <Text style={styles.addText}>{busy ? stage || 'Preparando documento…' : 'Importar PDF'}</Text>
        </Pressable>
        <Text style={styles.hint}>{Platform.OS === 'web' ? 'Importación y lectura disponibles en Android y iPhone.' : 'Copia local en tu dispositivo · Hasta 40 MB por archivo'}</Text>
      </View>
      <View style={styles.search}>
        <MaterialIcons name="search" size={22} color={icons.muted} />
        <TextInput style={styles.searchInput} accessibilityLabel="Buscar documento" placeholder="Buscar en tu biblioteca" placeholderTextColor={icons.muted}
          value={query} onChangeText={setQuery} autoCorrect={false} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => setQuery('')} style={styles.iconButton}><MaterialIcons name="close" size={20} color={icons.muted} /></Pressable>}
      </View>
      <View style={styles.listHeader}>
        <Text style={styles.count}>{books.length} {books.length === 1 ? 'documento' : 'documentos'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar orden de documentos" onPress={() => setSort(value => value === 'recent' ? 'name' : 'recent')} style={styles.sortButton}>
          <MaterialIcons name="sort" size={18} color={icons.accent} /><Text style={styles.sortText}>{sort === 'recent' ? 'Recientes' : 'Nombre A–Z'}</Text>
        </Pressable>
      </View>
      {error ? <View style={styles.empty}><Text style={styles.emptyTitle}>No se pudo cargar la biblioteca</Text><Text style={styles.subtitle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={styles.addButton}><Text style={styles.addText}>Reintentar</Text></Pressable></View>
        : loading ? <View style={styles.empty}><ActivityIndicator size="large" color={icons.spinner} /></View>
        : <FlatList data={filtered} keyExtractor={item => item.id} contentContainerStyle={styles.list}
          refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
          ListEmptyComponent={<View style={styles.empty}>
            <View style={styles.emptyIcon}><MaterialIcons name="auto-stories" size={42} color={icons.empty} /></View>
            <Text style={styles.emptyTitle}>{query ? 'Sin coincidencias' : 'Tu próxima lectura empieza aquí'}</Text>
            <Text style={styles.emptyDescription}>{query ? 'Prueba con otro título o borra la búsqueda.' : 'Importa un estudio, un libro o tus apuntes en PDF para tenerlos a mano.'}</Text>
          </View>}
          renderItem={({ item }) => {
            const progress = item.totalPages > 0 ? Math.min(100, Math.max(0, item.currentPage / item.totalPages * 100)) : 0;
            return <View style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={'Leer ' + item.displayName} onPress={() => open(item)} style={styles.bookMain}>
                <View style={styles.cover}><MaterialIcons name="description" size={28} color="#FFF8EE" /><Text style={styles.coverText}>PDF</Text></View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{item.displayName}</Text>
                  <Text style={styles.bookMeta}>{item.totalPages > 0 ? 'Página ' + item.currentPage + ' de ' + item.totalPages : 'Listo para empezar'}</Text>
                  <View style={styles.track}><View style={[styles.fill, { width: (progress + '%') as DimensionValue }]} /></View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={icons.chevron} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Eliminar ' + item.displayName} disabled={busy} onPress={() => remove(item)} style={styles.deleteButton}>
                <MaterialIcons name="delete-outline" size={20} color={icons.danger} />
              </Pressable>
            </View>;
          }} />}
      {analyzer.element}
    </SafeAreaView>
  </>;
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F3EB' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { flex: 1, fontSize: 10, letterSpacing: 1.2, color: '#766149', fontWeight: '700' },
  badge: { backgroundColor: '#E9DEC9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#765536', fontSize: 11, fontWeight: '800' },
  intro: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18, gap: 10 },
  title: { fontSize: 29, fontWeight: '700', color: '#30271F', letterSpacing: -0.8 },
  subtitle: { color: '#6C5D4E', fontSize: 15, lineHeight: 22 },
  addButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#65482F', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, marginTop: 8 },
  addText: { color: '#FFF', fontSize: 15, fontWeight: '700' }, dimmed: { opacity: 0.45 },
  hint: { color: '#7D6B56', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  search: { marginHorizontal: 24, backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#DED3C3', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  searchInput: { flex: 1, minHeight: 48, paddingHorizontal: 8, color: '#30271F', fontSize: 14 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12 },
  count: { color: '#7D6B56', fontSize: 12 }, sortButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortText: { color: '#65482F', fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 },
  card: { backgroundColor: '#FFFDF9', borderRadius: 18, borderWidth: 1, borderColor: '#E5DCCF', marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  bookMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cover: { width: 52, height: 72, borderRadius: 8, backgroundColor: '#8C6D4B', alignItems: 'center', justifyContent: 'center', gap: 4, borderLeftWidth: 4, borderLeftColor: '#65482F' },
  coverText: { color: '#FFF8EE', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  bookInfo: { flex: 1, gap: 6 }, bookTitle: { color: '#30271F', fontSize: 16, fontWeight: '600', lineHeight: 21 },
  bookMeta: { color: '#7C6B58', fontSize: 12 }, track: { height: 3, backgroundColor: '#EDE6DA', borderRadius: 3, marginTop: 2 },
  fill: { height: 3, backgroundColor: '#A6814D', borderRadius: 3 },
  deleteButton: { minWidth: 44, minHeight: 60, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  emptyIcon: { backgroundColor: '#ECE2D2', padding: 24, borderRadius: 28 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#4B3928', textAlign: 'center' },
  emptyDescription: { fontSize: 14, color: '#7C6B58', lineHeight: 22, textAlign: 'center', maxWidth: 280 },
});

