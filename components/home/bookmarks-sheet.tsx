import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark, loadAllBookmarks, withVerseText } from '@/constants/bookmarks';
import { useAppSettings } from '@/constants/app-settings';
import { loadPDFMarks, PDFMark, removePDFMark } from '@/constants/pdf-marks';
import { PDFLibraryService } from '@/constants/pdf-library-service';
import { displayBookName } from '@/constants/reading-history';
import { SACRED_BOOKS, type SacredBook, verseReference } from '@/constants/scripture';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

type PDFMarkGroup = { docId: string; name: string; items: PDFMark[] };

/** Marks of the documents still in the library, grouped by document (by name) and in page order. */
async function loadPDFMarkGroups(): Promise<PDFMarkGroup[]> {
  const [marks, library] = await Promise.all([loadPDFMarks(), PDFLibraryService.loadLibrary().catch(() => ({ books: [] }))]);
  const names = new Map(library.books.map(book => [book.id, book.displayName] as const));
  const groups = new Map<string, PDFMarkGroup>();
  for (const mark of marks) {
    const name = names.get(mark.docId);
    if (!name) continue;
    let group = groups.get(mark.docId);
    if (!group) groups.set(mark.docId, group = { docId: mark.docId, name, items: [] });
    group.items.push(mark);
  }
  const result = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const group of result) group.items.sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
  return result;
}

/**
 * Quick access to the marked verses: first one option per Bible on the shelf (and one for the PDF
 * documents), then that Bible's bookmarks grouped by book. Tapping a bookmark hands it to `onOpen`
 * (or `onOpenPDF` for a passage marked in a PDF), which opens the reader there.
 * With `only`, the sheet shows just that Bible's bookmarks (or just the PDF marks), with no list to go back to.
 */
export function BookmarksSheet({ visible, onClose, onOpen, onOpenPDF, only }: {
  visible: boolean; onClose: () => void; onOpen?: (bookmark: Bookmark) => void; onOpenPDF?: (mark: PDFMark) => void;
  only?: SacredBook | 'pdf' | null;
}) {
  const { theme } = useAppSettings();
  const ui = theme.ui;
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState<Record<string, Bookmark[]> | null>(null);
  const [chosen, setChosen] = useState<SacredBook | null>(null);
  const [pdfChosen, setPdfChosen] = useState(false);
  const collection = only ? (only === 'pdf' ? null : only) : chosen;
  const pdfOpen = only === 'pdf' || (!only && pdfChosen);
  const [pdfGroups, setPdfGroups] = useState<PDFMarkGroup[] | null>(null);
  const pdfCount = pdfGroups?.reduce((sum, group) => sum + group.items.length, 0) ?? 0;
  // Verse texts, tagged with the list they belong to so a stale result is never shown.
  const [texts, setTexts] = useState<{ of: Bookmark[]; items: Bookmark[] } | null>(null);

  // Read the bookmarks fresh every time the sheet opens (they change while reading).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void loadAllBookmarks().then(result => { if (alive) setAll(result); });
    void loadPDFMarkGroups().then(result => { if (alive) setPdfGroups(result); });
    return () => { alive = false; };
  }, [visible]);

  // The verse texts load only for the Bible being looked at.
  const list = useMemo(() => (collection && all?.[collection.id]) || [], [all, collection]);
  useEffect(() => {
    if (list.length === 0) return;
    let alive = true;
    void withVerseText(list).then(result => { if (alive) setTexts({ of: list, items: result }); });
    return () => { alive = false; };
  }, [list]);
  const detailed = texts?.of === list ? texts.items : null;

  const groups = useMemo(() => {
    const result: { book: string; items: Bookmark[] }[] = [];
    for (const item of detailed ?? list) {
      const last = result[result.length - 1];
      if (last?.book === item.book) last.items.push(item);
      else result.push({ book: item.book, items: [item] });
    }
    return result;
  }, [detailed, list]);

  // The sheet always reopens on the three Bibles.
  const close = () => { setChosen(null); setPdfChosen(false); onClose(); };
  const goBack = () => {
    if (only || (!collection && !pdfOpen)) { close(); return; }
    setChosen(null); setPdfChosen(false);
  };
  const askRemove = (mark: PDFMark) => Alert.alert('Quitar marcador', '¿Quitar este marcador de la página ' + mark.page + '?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: () => {
      void removePDFMark(mark.id).then(loadPDFMarkGroups).then(setPdfGroups)
        .catch(() => Alert.alert('No se pudo quitar', 'Vuelve a intentarlo.'));
    } },
  ]);

  return <Sheet visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={goBack}>
    <Pressable style={styles.backdrop} accessibilityLabel="Cerrar marcadores" onPress={close} />
    <View style={[styles.sheet, { backgroundColor: ui.page }]}>
      <View style={styles.header}>
        {!only && (collection || pdfOpen) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={22} color={ui.primary} />
          </Pressable>
        ) : <MaterialIcons name="bookmarks" size={22} color={ui.accent} style={styles.headerIcon} />}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: ui.text }]} numberOfLines={1}>{collection ? collection.title : pdfOpen ? 'Documentos PDF' : 'Marcadores'}</Text>
          <Text style={[styles.subtitle, { color: ui.muted }]} numberOfLines={1}>
            {collection ? countLabel(list.length) : pdfOpen ? pdfCountLabel(pdfCount) : 'Elige una Biblia o tus documentos PDF'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={styles.iconButton}>
          <MaterialIcons name="close" size={22} color={ui.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: 34 + insets.bottom }]}>
        {pdfOpen ? (
          !pdfGroups ? <View style={styles.loading}><Skeleton color={ui.soft} blocks={[{ width: '100%', height: 64, radius: 16 }, { width: '100%', height: 64, radius: 16 }, { width: '100%', height: 64, radius: 16 }]} /></View> : pdfGroups.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: ui.card, borderColor: ui.border }]}>
              <MaterialIcons name="bookmark-border" size={36} color={ui.muted} />
              <Text style={[styles.emptyTitle, { color: ui.text }]}>Aún no hay marcadores</Text>
              <Text style={[styles.emptyText, { color: ui.muted }]}>
                Mientras lees un PDF, toca «Marcar», elige el texto importante y aparecerá aquí.
              </Text>
            </View>
          ) : pdfGroups.map(group => (
            <View key={group.docId} style={styles.group}>
              <Text style={[styles.groupTitle, { color: ui.accent }]} numberOfLines={1}>{group.name.toUpperCase()}</Text>
              {group.items.map(item => (
                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Abrir ' + group.name + ', página ' + item.page}
                  accessibilityHint="Mantén presionado para quitarlo"
                  onPress={() => { setPdfChosen(false); onOpenPDF?.(item); }} onLongPress={() => askRemove(item)}
                  style={({ pressed }) => [styles.mark, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
                  <View style={[styles.markRibbon, { backgroundColor: ui.accent }]} />
                  <View style={styles.markText}>
                    <Text style={[styles.markRef, { color: ui.text }]}>Página {item.page}</Text>
                    <Text style={[styles.markVerse, { color: ui.muted }]} numberOfLines={3}>{item.text || 'Página completa'}</Text>
                    {!!item.note && <Text style={[styles.markNote, { color: ui.accent }]} numberOfLines={2}>{item.note}</Text>}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={ui.muted} />
                </Pressable>
              ))}
            </View>
          ))
        ) : !all ? <View style={styles.loading}><Skeleton color={ui.soft} blocks={[{ width: '100%', height: 64, radius: 16 }, { width: '100%', height: 64, radius: 16 }, { width: '100%', height: 64, radius: 16 }]} /></View> : !collection ? <>
          {SACRED_BOOKS.map(item => {
            const count = all[item.id]?.length ?? 0;
            return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Marcadores de la ' + item.title}
              onPress={() => setChosen(item)}
              style={({ pressed }) => [styles.option, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
              <View style={[styles.optionBook, { backgroundColor: item.colors.cover, borderLeftColor: item.colors.spine }]}>
                <MaterialIcons name="bookmark" size={20} color={item.colors.text} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: ui.text }]}>Marcadores de la {item.title}</Text>
                <Text style={[styles.optionCount, { color: ui.muted }]}>{countLabel(count)}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={ui.muted} />
            </Pressable>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Marcadores de documentos PDF" onPress={() => setPdfChosen(true)}
            style={({ pressed }) => [styles.option, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
            <View style={[styles.optionBook, { backgroundColor: ui.soft, borderLeftColor: ui.accent }]}>
              <MaterialIcons name="picture-as-pdf" size={20} color={ui.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: ui.text }]}>Documentos PDF</Text>
              <Text style={[styles.optionCount, { color: ui.muted }]}>{pdfCountLabel(pdfCount)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={ui.muted} />
          </Pressable>
        </> : list.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: ui.card, borderColor: ui.border }]}>
            <MaterialIcons name="bookmark-border" size={36} color={ui.muted} />
            <Text style={[styles.emptyTitle, { color: ui.text }]}>Aún no hay marcadores</Text>
            <Text style={[styles.emptyText, { color: ui.muted }]}>
              Mantén presionado un versículo mientras lees, elige «Marcar versículos» y aparecerán aquí.
            </Text>
          </View>
        ) : groups.map(group => (
          <View key={group.book} style={styles.group}>
            <Text style={[styles.groupTitle, { color: ui.accent }]}>{displayBookName(group.book).toUpperCase()}</Text>
            {group.items.map(item => (
              <Pressable key={item.chapter + ':' + item.verse} accessibilityRole="button"
                accessibilityLabel={'Abrir ' + verseReference(item.collectionId, item.book, item.chapter, item.verse)}
                onPress={() => { setChosen(null); onOpen?.(item); }}
                style={({ pressed }) => [styles.mark, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
                <View style={[styles.markRibbon, { backgroundColor: collection.colors.cover }]} />
                <View style={styles.markText}>
                  <Text style={[styles.markRef, { color: ui.text }]}>{verseReference(item.collectionId, item.book, item.chapter, item.verse)}</Text>
                  {item.text ? <Text style={[styles.markVerse, { color: ui.muted }]} numberOfLines={2}>{item.text}</Text>
                    : !detailed ? <View style={[styles.markPlaceholder, { backgroundColor: ui.soft }]} /> : null}
                </View>
                <MaterialIcons name="chevron-right" size={20} color={ui.muted} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  </Sheet>;
}

const pdfCountLabel = (count: number) => count === 0 ? 'Sin marcadores' : count === 1 ? '1 texto marcado' : count + ' textos marcados';
const countLabel = (count: number) => count === 0 ? 'Sin marcadores' : count === 1 ? '1 versículo marcado' : count + ' versículos marcados';

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0007' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  headerIcon: { marginHorizontal: 11 },
  headerText: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 1 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  body: { padding: 18, paddingTop: 10, gap: 10 },
  loading: { marginTop: 4 },
  pressed: { opacity: 0.8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5 },
  optionBook: { width: 40, height: 50, borderRadius: 6, borderLeftWidth: 6, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionCount: { fontSize: 12 },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 16, borderWidth: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  group: { gap: 8 },
  groupTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 4 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 10, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  markRibbon: { alignSelf: 'stretch', width: 5, marginVertical: -10 },
  markText: { flex: 1, gap: 3, paddingLeft: 4 },
  markRef: { fontSize: 15, fontWeight: '800' },
  markVerse: { fontSize: 13, lineHeight: 19, fontFamily: SERIF },
  markNote: { fontSize: 12, fontWeight: '600' },
  markPlaceholder: { height: 10, borderRadius: 5, width: '80%' },
});
