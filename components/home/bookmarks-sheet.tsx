import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Sheet } from '@/components/ui/sheet';
import { Bookmark, loadAllBookmarks, withVerseText } from '@/constants/bookmarks';
import { useAppSettings } from '@/constants/app-settings';
import { displayBookName } from '@/constants/reading-history';
import { SACRED_BOOKS, type SacredBook } from '@/constants/scripture';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

/**
 * Quick access to the marked verses: first one option per Bible on the shelf, then that Bible's
 * bookmarks grouped by book. Tapping a bookmark hands it to `onOpen` (which opens the reader there).
 */
export function BookmarksSheet({ visible, onClose, onOpen }: {
  visible: boolean; onClose: () => void; onOpen: (bookmark: Bookmark) => void;
}) {
  const { theme } = useAppSettings();
  const ui = theme.ui;
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState<Record<string, Bookmark[]> | null>(null);
  const [collection, setCollection] = useState<SacredBook | null>(null);
  // Verse texts, tagged with the list they belong to so a stale result is never shown.
  const [texts, setTexts] = useState<{ of: Bookmark[]; items: Bookmark[] } | null>(null);

  // Read the bookmarks fresh every time the sheet opens (they change while reading).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void loadAllBookmarks().then(result => { if (alive) setAll(result); });
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
  const close = () => { setCollection(null); onClose(); };
  const goBack = () => (collection ? setCollection(null) : close());

  return <Sheet visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={goBack}>
    <Pressable style={styles.backdrop} accessibilityLabel="Cerrar marcadores" onPress={close} />
    <View style={[styles.sheet, { backgroundColor: ui.page }]}>
      <View style={styles.header}>
        {collection ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => setCollection(null)} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={22} color={ui.primary} />
          </Pressable>
        ) : <MaterialIcons name="bookmarks" size={22} color={ui.accent} style={styles.headerIcon} />}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: ui.text }]} numberOfLines={1}>{collection ? collection.title : 'Marcadores'}</Text>
          <Text style={[styles.subtitle, { color: ui.muted }]} numberOfLines={1}>
            {collection ? countLabel(list.length) : 'Elige una Biblia para ver sus marcadores'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={styles.iconButton}>
          <MaterialIcons name="close" size={22} color={ui.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: 34 + insets.bottom }]}>
        {!all ? <ActivityIndicator style={styles.loading} color={ui.primary} /> : !collection ? (
          SACRED_BOOKS.map(item => {
            const count = all[item.id]?.length ?? 0;
            return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Marcadores de la ' + item.title}
              onPress={() => setCollection(item)}
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
          })
        ) : list.length === 0 ? (
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
                accessibilityLabel={'Abrir ' + displayBookName(item.book) + ' ' + item.chapter + ':' + item.verse}
                onPress={() => { setCollection(null); onOpen(item); }}
                style={({ pressed }) => [styles.mark, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
                <View style={[styles.markRibbon, { backgroundColor: collection.colors.cover }]} />
                <View style={styles.markText}>
                  <Text style={[styles.markRef, { color: ui.text }]}>{displayBookName(item.book)} {item.chapter}:{item.verse}</Text>
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
  loading: { marginVertical: 30 },
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
  markPlaceholder: { height: 10, borderRadius: 5, width: '80%' },
});
