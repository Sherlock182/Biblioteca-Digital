import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { bookLabel, getSearchIndex, highlightSegments, parseReference, searchWords, type BookSuggestion } from '@/constants/bible-search';
import { AppTheme } from '@/constants/app-settings';
import { type TestamentType } from '@/constants/scripture';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });
const PAGE = 100;
const FILTERS: { id: TestamentType | 'todo'; label: string }[] = [
  { id: 'todo', label: 'Todo' }, { id: 'antiguo', label: 'Antiguo T.' }, { id: 'nuevo', label: 'Nuevo T.' },
];

/**
 * Search bar of an opened Bible: a reference ("Juan 3:16") offers to go straight there, and words
 * list the verses that contain them. While it has text the parent hides the list of books.
 */
export function BibleSearch({ collectionId, theme, autoFocus = false, onActiveChange, onOpenVerse, onPickBook }: {
  collectionId: string;
  theme: AppTheme;
  /** Opens the keyboard right away (the search sheet inside the reader). */
  autoFocus?: boolean;
  onActiveChange: (active: boolean) => void;
  onOpenVerse: (book: string, chapter: number, verse?: number) => void;
  onPickBook: (book: string) => void;
}) {
  const ui = theme.ui;
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [wholeWord, setWholeWord] = useState(true);
  const [testament, setTestament] = useState<TestamentType | 'todo'>('todo');
  const [limit, setLimit] = useState(PAGE);

  // Search a moment after the last keystroke, not on every letter.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(text.trim()); setLimit(PAGE); }, 280);
    return () => clearTimeout(timer);
  }, [text]);

  const reference = useMemo(() => (query ? parseReference(collectionId, query) : null), [collectionId, query]);
  const words = useMemo(() => (query && !reference?.hasChapter ? searchWords(collectionId, query, { wholeWord, testament }) : null),
    [collectionId, query, reference, testament, wholeWord]);

  const change = (value: string) => {
    setText(value);
    onActiveChange(value.trim().length > 0);
  };
  const clear = () => change('');
  // The first search reads the whole Bible; start that while the user is still typing.
  const warmUp = () => { setTimeout(() => getSearchIndex(collectionId), 50); };

  const openSuggestion = (item: BookSuggestion) => (item.chapter ? onOpenVerse(item.book, item.chapter, item.verse) : onPickBook(item.book));
  const pending = text.trim() !== query;
  const shown = words?.results.slice(0, limit) ?? [];

  return <View style={styles.wrap}>
    <View style={[styles.bar, { backgroundColor: ui.card, borderColor: text ? ui.primary : ui.border }]}>
      <MaterialIcons name="search" size={22} color={ui.muted} />
      <TextInput value={text} onChangeText={change} onFocus={warmUp} autoFocus={autoFocus} placeholder="Buscar cita o palabra (ej. Juan 3:16, pastor)"
        placeholderTextColor={ui.muted} style={[styles.input, { color: ui.text }]} returnKeyType="search"
        autoCorrect={false} autoCapitalize="none" accessibilityLabel="Buscar en esta Biblia" />
      {text ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={clear} hitSlop={8} style={styles.clear}>
          <MaterialIcons name="close" size={20} color={ui.muted} />
        </Pressable>
      ) : null}
    </View>

    {text.trim() ? <View style={styles.results}>
      {reference && reference.suggestions.length > 0 && <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: ui.accent }]}>{reference.hasChapter ? 'IR A' : 'LIBROS'}</Text>
        {reference.suggestions.map(item => (
          <Pressable key={item.book} accessibilityRole="button" onPress={() => openSuggestion(item)}
            style={({ pressed }) => [styles.suggestion, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
            <MaterialIcons name={item.chapter ? 'menu-book' : 'auto-stories'} size={20} color={ui.primary} />
            <Text style={[styles.suggestionText, { color: ui.text }]}>
              {item.label}{item.chapter ? ' ' + item.chapter + (item.verseLabel ? ':' + item.verseLabel : '') : ''}
            </Text>
            <Text style={[styles.suggestionHint, { color: ui.muted }]}>{item.chapter ? 'Abrir' : 'Capítulos'}</Text>
            <MaterialIcons name="chevron-right" size={20} color={ui.muted} />
          </Pressable>
        ))}
      </View>}

      {reference?.hasChapter && reference.suggestions.length === 0 && !pending && (
        <Text style={[styles.empty, { color: ui.muted }]}>Ese capítulo no existe en esta Biblia.</Text>
      )}

      {words && <View style={styles.block}>
        <View style={styles.filters}>
          {FILTERS.map(filter => {
            const active = testament === filter.id;
            return <Pressable key={filter.id} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => { setTestament(filter.id); setLimit(PAGE); }}
              style={[styles.chip, { borderColor: active ? ui.primary : ui.border, backgroundColor: active ? ui.primary : ui.card }]}>
              <Text style={[styles.chipText, { color: active ? ui.primaryText : ui.text }]}>{filter.label}</Text>
            </Pressable>;
          })}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: wholeWord }} onPress={() => { setWholeWord(value => !value); setLimit(PAGE); }}
            style={styles.wholeWord}>
            <MaterialIcons name={wholeWord ? 'check-box' : 'check-box-outline-blank'} size={20} color={wholeWord ? ui.primary : ui.muted} />
            <Text style={[styles.chipText, { color: ui.text }]}>Palabra completa</Text>
          </Pressable>
        </View>

        <Text style={[styles.count, { color: ui.muted }]}>
          {pending ? 'Buscando…' : words.results.length === 0 ? 'Sin resultados'
            : words.results.length === 1 ? '1 versículo' : words.results.length.toLocaleString('es') + ' versículos'}
        </Text>

        {!pending && words.results.length === 0 && (
          <Text style={[styles.empty, { color: ui.muted }]}>
            {wholeWord ? 'Prueba quitando «Palabra completa» para encontrar también plurales y palabras derivadas (pastor → pastores).'
              : 'Revisa cómo está escrita la palabra o prueba con otra parecida.'}
          </Text>
        )}

        {shown.map(verse => (
          <Pressable key={verse.book + verse.chapter + ':' + verse.verse} accessibilityRole="button"
            onPress={() => onOpenVerse(verse.book, verse.chapter, verse.verse)}
            style={({ pressed }) => [styles.verse, { backgroundColor: ui.card, borderColor: ui.border }, pressed && styles.pressed]}>
            <Text style={[styles.verseRef, { color: ui.primary }]}>{bookLabel(collectionId, verse.book)} {verse.chapter}:{verse.label}</Text>
            <Text style={[styles.verseText, { color: ui.text }]} numberOfLines={4}>
              {highlightSegments(verse, words).map((segment, i) => segment.hit
                ? <Text key={i} style={[styles.hit, { backgroundColor: theme.reader.highlight }]}>{segment.text}</Text>
                : segment.text)}
            </Text>
          </Pressable>
        ))}

        {words.results.length > shown.length && (
          <Pressable accessibilityRole="button" onPress={() => setLimit(value => value + PAGE)}
            style={({ pressed }) => [styles.more, { borderColor: ui.primary }, pressed && styles.pressed]}>
            <Text style={[styles.moreText, { color: ui.primary }]}>Ver más ({(words.results.length - shown.length).toLocaleString('es')} restantes)</Text>
          </Pressable>
        )}
      </View>}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, paddingLeft: 12, paddingRight: 6, minHeight: 48 },
  input: { flex: 1, fontSize: 15, paddingVertical: 10 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  results: { gap: 14 },
  block: { gap: 8 },
  blockTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  suggestionText: { flex: 1, fontSize: 15, fontWeight: '800' },
  suggestionHint: { fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700' },
  wholeWord: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  count: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 19 },
  verse: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  verseRef: { fontSize: 14, fontWeight: '800' },
  verseText: { fontSize: 15, lineHeight: 22, fontFamily: SERIF },
  hit: { fontWeight: '800' },
  more: { alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: 11 },
  moreText: { fontSize: 14, fontWeight: '800' },
});
