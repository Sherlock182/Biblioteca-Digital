import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Sheet } from '@/components/ui/sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BibleSearch } from '@/components/home/bible-search';
import { DropCapText, type DropCapSpan } from '@/components/reader/drop-cap-text';
import { getChapterExtras, hasChapterExtras, noteSegments, type HeadingKind, type VerseExtras } from '@/constants/bible-extras';
import * as Haptics from 'expo-haptics';
import { AppTheme, GARAMOND, useAppSettings } from '@/constants/app-settings';
import { displayBookName, saveBibleReading } from '@/constants/reading-history';
import { useBibleSpeech } from '@/hooks/use-bible-speech';

import {
    getCatholicBookList,
    COLLECTION_CREDITS,
    NEW_TESTAMENT_BOOKS,
    TANAKH_BOOK_LIST,
    fetchChapterContent,
    getBooksForCollection,
    getCollectionChapterCount,
    getCollectionById,
    type ChapterContent,
    type CollectionBookListItem,
    type TanakhLanguage,
    type TestamentType,
    type VerseLine,
} from '@/constants/scripture';

/** Who wrote the notes of each Bible (title and credit of the note sheet). */
const NOTE_SOURCES: Record<string, { title: string; source: string }> = {
  catolica: { title: 'NOTA DE MONS. STRAUBINGER', source: 'Biblia Platense (1948) · Dominio público' },
  nbv: { title: 'NOTA DE LA TRADUCCIÓN', source: 'Nueva Biblia Viva © 2008 Biblica, Inc. · CC BY-SA 4.0' },
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Paragraph layout: the source texts have no paragraph marks, so verses are grouped into blocks
 * that end at a sentence end (4 to 9 verses). Each block measures its position, so the reader can
 * still scroll to a verse (bookmarks, search, reading aloud).
 */
function paragraphBlocks(verses: VerseLine[], headingVerses: Set<number>) {
  const blocks: VerseLine[][] = [];
  let current: VerseLine[] = [];
  for (const verse of verses) {
    // A section heading always starts a new paragraph.
    if (headingVerses.has(verse.number) && current.length) { blocks.push(current); current = []; }
    current.push(verse);
    const sentenceEnd = /[.!?»”"’)]\s*$/.test(verse.text);
    if ((current.length >= 4 && sentenceEnd) || current.length >= 9) { blocks.push(current); current = []; }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

const TANAKH_HEBREW_BOOK_LABELS: Record<string, string> = {
  'Bereshit (Génesis)': 'בראשית',
  'Shemot (Éxodo)': 'שמות',
  'Vayikrá (Levítico)': 'ויקרא',
  'Bamidbar (Números)': 'במדבר',
  'Devarim (Deuteronomio)': 'דברים',
  'Yehoshúa (Josué)': 'יהושע',
  'Shoftim (Jueces)': 'שופטים',
  'Shmuel (Samuel)': 'שמואל',
  'Melajim (Reyes)': 'מלכים',
  'Yeshayahu (Isaías)': 'ישעיהו',
  'Yirmeyahu (Jeremías)': 'ירמיהו',
  'Yejezkel (Ezequiel)': 'יחזקאל',
  'Hoshea (Oseas)': 'הושע',
  'Yoel (Joel)': 'יואל',
  'Amos (Amós)': 'עמוס',
  'Ovadia (Abdías)': 'עובדיה',
  'Yonah (Jonás)': 'יונה',
  'Mijá (Miqueas)': 'מיכה',
  'Najum (Nahúm)': 'נחום',
  'Jabaquq (Habacuc)': 'חבקוק',
  'Tzefania (Sofonías)': 'צפניה',
  'Jagai (Hageo)': 'חגי',
  'Zejaria (Zacarías)': 'זכריה',
  'Malají (Malaquías)': 'מלאכי',
  'Tehilim (Salmos)': 'תהילים',
  'Mishlei (Proverbios)': 'משלי',
  'Iyov (Job)': 'איוב',
  'Shir Hashirim (Cantar de los Cantares)': 'שיר השירים',
  'Rut (Rut)': 'רות',
  'Eijá (Lamentaciones)': 'איכה',
  'Kohelet (Eclesiastés)': 'קהלת',
  'Ester (Ester)': 'אסתר',
  'Daniel (Daniel)': 'דניאל',
  'Ezra–Nejemia (Esdras–Nehemías)': 'עזרא נחמיה',
  'Divrei Hayamim (Crónicas)': 'דברי הימים',
};

const TANAKH_HEBREW_SECTION_LABELS: Record<string, string> = {
  'Torah (La Ley)': 'תורה',
  "Nevi'im (Los Profetas)": 'נביאים',
  'Ketuvim (Los Escritos)': 'כתובים',
};

const TANAKH_HEBREW_SUBSECTION_LABELS: Record<string, string> = {
  'Profetas anteriores': 'נביאים ראשונים',
  'Profetas posteriores': 'נביאים אחרונים',
};

export default function ChapterReaderScreen() {
  const params = useLocalSearchParams();
  const readingKey = JSON.stringify([params.collectionId, params.book, params.chapter, params.tanakhLanguage, params.autoplay, params.verse]);
  return <ChapterReaderContent key={readingKey} />;
}

/** The reader's styles recolored for the chosen theme; the classic theme is the original design. */
function themeReaderStyles(theme: AppTheme): typeof baseStyles {
  if (theme.id === 'clasico') return baseStyles;
  const ui = theme.ui;
  const overrides: Partial<Record<keyof typeof baseStyles, object>> = {
    listenButtonActive: { backgroundColor: 'rgba(255,255,255,0.32)', borderColor: '#F6EFD2' },
    languageToggleButton: { backgroundColor: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.22)' },
    languageToggleButtonActive: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: '#F6EFD2' },
    overlayBg: { backgroundColor: 'rgba(0,0,0,0.5)' },
    panelCard: { backgroundColor: ui.page, borderColor: ui.border },
    panelTitle: { color: ui.text }, panelSub: { color: ui.muted },
    panelClose: { backgroundColor: ui.soft }, panelCloseText: { color: ui.text },
    testamentButton: { backgroundColor: ui.card, borderColor: ui.border },
    testamentButtonActive: { backgroundColor: ui.primary, borderColor: ui.primary },
    testamentText: { color: ui.text }, testamentTextActive: { color: ui.primaryText },
    panelSectionLine: { backgroundColor: ui.border }, panelSectionTitle: { color: theme.reader.number },
    panelSubsectionTitle: { color: ui.muted },
    panelBookRow: { backgroundColor: ui.card, borderColor: ui.border },
    panelBookText: { color: ui.text }, panelBookArrow: { color: ui.muted },
    chapterChip: { backgroundColor: ui.card, borderColor: ui.border },
    chapterChipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
    chapterChipText: { color: ui.text }, chapterChipTextActive: { color: ui.primaryText },
    optionsCard: { backgroundColor: ui.page, borderColor: ui.border },
    optionsTitle: { color: ui.text }, optionsHint: { color: ui.muted },
    optionsButton: { backgroundColor: ui.primary, borderColor: ui.primary },
    optionsButtonCancel: { backgroundColor: ui.muted, borderColor: ui.muted },
    optionsButtonText: { color: ui.primaryText },
    selectionInfoBar: { backgroundColor: theme.reader.selected, borderColor: ui.accent },
    selectionInfoText: { color: ui.text }, selectionInfoHint: { color: ui.muted },
    emptyState: { backgroundColor: ui.card, borderColor: ui.border },
    emptyTitle: { color: ui.text }, emptyText: { color: ui.muted },
    retryButton: { backgroundColor: ui.primary }, retryButtonText: { color: ui.primaryText },
    loadingText: { color: ui.muted },
  };
  const merged = { ...baseStyles } as Record<string, object>;
  for (const [key, value] of Object.entries(overrides)) merged[key] = [(baseStyles as Record<string, object>)[key], value];
  return merged as typeof baseStyles;
}

function ChapterReaderContent() {
  // Hooks de navegación y safe area
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const collectionId = readParam(params.collectionId) ?? '';
  const book = readParam(params.book) ?? '';
  const chapterValue = Number(readParam(params.chapter) ?? '0');
  const tanakhLanguageParam = readParam(params.tanakhLanguage);

  // Estado para versículos marcados
  const [highlightedVerses, setHighlightedVerses] = useState<{ [key: string]: number[] }>({});
  const [highlightMode, setHighlightMode] = useState(false);

  // Validar parámetros - TODOS deben estar presentes y válidos
  const isValidChapter = collectionId && book && typeof chapterValue === 'number' && chapterValue > 0;
  const highlightStorageKey = isValidChapter ? `highlights_${collectionId}_${book}_${chapterValue}` : '';

  // Marked verses of this chapter (AsyncStorage also works on web, through localStorage).
  useEffect(() => {
    if (!highlightStorageKey) return;
    let cancelled = false;
    void AsyncStorage.getItem(highlightStorageKey).then(raw => {
      let verses: number[] = [];
      try {
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) verses = parsed.filter((n): n is number => typeof n === 'number' && n > 0);
      } catch { /* damaged entry: start empty */ }
      if (!cancelled) setHighlightedVerses(prev => ({ ...prev, [highlightStorageKey]: verses }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [highlightStorageKey]);

  const saveHighlights = (verses: number[]) => {
    if (!highlightStorageKey) return;
    setHighlightedVerses(prev => ({ ...prev, [highlightStorageKey]: verses }));
    void AsyncStorage.setItem(highlightStorageKey, JSON.stringify(verses)).catch(() => undefined);
  };

  const collection = getCollectionById(collectionId);
  const chapterCount = getCollectionChapterCount(collectionId, book);
  const { theme, settings } = useAppSettings();
  const styles = useMemo(() => themeReaderStyles(theme), [theme]);
  // Theme colors and the chosen text size (Bibles only) layered over the base styles.
  const themed = useMemo(() => {
    const colors = theme.reader;
    const scale = settings.textScale;
    return {
      page: { backgroundColor: colors.page },
      header: { backgroundColor: colors.header, borderBottomColor: colors.headerBorder },
      heading: { color: colors.heading, fontSize: 18 * scale, lineHeight: 26 * scale },
      headingHebrew: { lineHeight: 30 * scale },
      verseNumber: { color: colors.number, fontSize: 15 * scale, lineHeight: 24 * scale, width: Math.round(24 * scale) },
      verseText: { color: colors.text, fontSize: 18 * scale, lineHeight: 30 * scale },
      verseTextHebrew: { fontSize: 22 * scale, lineHeight: 38 * scale },
      highlighted: { backgroundColor: colors.highlight },
      selected: { backgroundColor: colors.selected },
      markedText: { color: colors.text },
      // "Libro" typeface (Garamond); custom fonts need their own bold file instead of fontWeight.
      font: settings.readerFont === 'libro' ? { fontFamily: GARAMOND.regular } : null,
      fontBold: settings.readerFont === 'libro' ? { fontFamily: GARAMOND.bold, fontWeight: 'normal' as const } : null,
      // Paragraph layout: small raised verse numbers inside the running text.
      inlineNumber: { color: colors.number, fontSize: 12 * scale, fontWeight: '700' as const },
    };
  }, [settings.readerFont, settings.textScale, theme]);
  const optionIcon = theme.id === 'clasico' ? '#F6EFD2' : theme.ui.primaryText;
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerBook, setChapterPickerBook] = useState<string | null>(null);
  const [chapterPickerFromHeader, setChapterPickerFromHeader] = useState(false);
  // Opens on the testament of the book being read.
  const [bookPickerTestament, setBookPickerTestament] = useState<TestamentType>(NEW_TESTAMENT_BOOKS.includes(book) ? 'nuevo' : 'antiguo');
  const [tanakhLanguage, setTanakhLanguage] = useState<TanakhLanguage>(tanakhLanguageParam === 'he' ? 'he' : 'es');

  // Bibles organized in Old / New Testament.
  const isRv1960 = collection?.id === 'rv1960' || collection?.id === 'nbv' || collection?.id === 'catolica';
  const isJewishCollection = collection?.id === 'jewish';
  const isCompactCollection = collection?.id === 'jewish' || collection?.id === 'catolica';
  const isHebrewTanakh = isJewishCollection && tanakhLanguage === 'he';
  // Hebrew reads right to left, so it keeps one verse per line.
  const paragraphLayout = settings.verseLayout === 'parrafo' && !isHebrewTanakh;

  const getDisplayBookName = (bookName: string) => {
    if (!isHebrewTanakh) {
      return displayBookName(bookName);
    }

    return TANAKH_HEBREW_BOOK_LABELS[bookName] ?? bookName;
  };

  const getDisplaySectionName = (label: string) => {
    if (!isHebrewTanakh) {
      return label;
    }

    return TANAKH_HEBREW_SECTION_LABELS[label] ?? label;
  };

  const getDisplaySubsectionName = (label: string) => {
    if (!isHebrewTanakh) {
      return label;
    }

    return TANAKH_HEBREW_SUBSECTION_LABELS[label] ?? label;
  };

  const onChangeTanakhLanguage = (nextLanguage: TanakhLanguage) => {
    if (nextLanguage === tanakhLanguage) {
      return;
    }

    setTanakhLanguage(nextLanguage);

    setLoading(true);
  };

  const bookPickerItems = (() => {
    if (!collection) {
      return [] as CollectionBookListItem[];
    }

    if (collection.id === 'jewish') {
      return TANAKH_BOOK_LIST;
    }

    if (collection.id === 'catolica') {
      return getCatholicBookList(bookPickerTestament);
    }

    if (collection.id === 'rv1960' || collection.id === 'nbv') {
      return getBooksForCollection(collection.id, bookPickerTestament).map((item) => ({
        type: 'book' as const,
        label: item,
        book: item,
      }));
    }

    return getBooksForCollection(collection.id).map((item) => ({
      type: 'book' as const,
      label: item,
      book: item,
    }));
  })();

  const [loading, setLoading] = useState(Boolean(collection && book && Number.isInteger(chapterValue) && chapterValue > 0));
  const [chapterContent, setChapterContent] = useState<ChapterContent>({ source: 'missing', verses: [], note: 'No se pudo abrir la lectura. Revisa el libro y el capítulo seleccionados.' });
  const [retryCount, setRetryCount] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [optionsVerseNumber, setOptionsVerseNumber] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);

  const selectedVerseSet = useMemo(() => new Set(selectedVerseNumbers), [selectedVerseNumbers]);

  const activeVerseNumbers = useMemo(() => {
    // While selecting, copy/share always act on the whole selection.
    if (selectionMode && selectedVerseNumbers.length > 0) {
      return selectedVerseNumbers;
    }

    if (optionsVerseNumber !== null) {
      return [optionsVerseNumber];
    }

    return selectedVerseNumbers;
  }, [optionsVerseNumber, selectedVerseNumbers, selectionMode]);

  // Remember this chapter for "Continuar leyendo" once it actually loaded.
  useEffect(() => {
    if (chapterContent.verses.length === 0 || !collectionId || !book || chapterValue <= 0) return;
    void saveBibleReading({ collectionId, book, chapter: chapterValue, tanakhLanguage });
  }, [book, chapterContent, chapterValue, collectionId, tanakhLanguage]);

  useEffect(() => {
    const activeCollection = getCollectionById(collectionId);
    if (!activeCollection || !book || !Number.isInteger(chapterValue) || chapterValue <= 0) return;
    let cancelled = false;
    const language: TanakhLanguage = activeCollection.id === 'jewish' ? tanakhLanguage : 'es';
    void fetchChapterContent(activeCollection.id, book, chapterValue, { tanakhLanguage: language })
      .then(content => { if (!cancelled) setChapterContent(content); })
      .catch(() => { if (!cancelled) setChapterContent({ source: 'missing', verses: [], note: 'No se pudo cargar este capítulo. Vuelve a intentarlo.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collectionId, book, chapterValue, retryCount, tanakhLanguage]);

  // Space the bottom sheets keep above the phone's navigation buttons.
  const sheetBottom = Math.max(24, insets.bottom + 16);

  // ---- Lectura en voz alta: misma voz, velocidad, tono y segundo plano que el lector de PDF.
  const scrollRef = useRef<ScrollView>(null);
  const verseY = useRef<Record<number, number>>({});
  const { speaking, readingVerse, toggle: toggleReading } = useBibleSpeech({
    collectionId,
    book,
    chapter: chapterValue,
    chapterCount,
    verses: chapterContent.verses,
    ready: !loading,
    autoplay: readParam(params.autoplay) === '1',
    versionTitle: collection?.title ?? 'Biblia',
    goToChapter: (chapter, autoplay) => router.replace({
      pathname: '/chapter-reader',
      params: { collectionId, book, chapter: String(chapter), tanakhLanguage, ...(autoplay ? { autoplay: '1' } : {}) },
    }),
    showVerse: (verse) => {
      const y = verseY.current[verse];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    },
  });

  // Opened from a bookmark or a search result: go to that verse and mark it for a moment.
  const targetVerse = Number(readParam(params.verse) ?? '0');
  const [flashVerse, setFlashVerse] = useState<number | null>(targetVerse > 0 ? targetVerse : null);
  // While set, every new position of the target verse scrolls to it again: the section headings load
  // a moment after the text and push the verses down. Cleared after a while or when the user scrolls.
  const pendingTarget = useRef(targetVerse > 0 ? targetVerse : 0);
  const scrollToVerse = (verse: number, animated: boolean) => {
    const y = verseY.current[verse];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated });
  };
  /** Positions measured on the direct children of the scroll content (a verse row or a paragraph). */
  const recordLayout = (verses: number[], y: number) => {
    for (const verse of verses) verseY.current[verse] = y;
    if (pendingTarget.current && verses.includes(pendingTarget.current)) scrollToVerse(pendingTarget.current, false);
  };
  useEffect(() => {
    if (loading || targetVerse <= 0 || chapterContent.verses.length === 0) return;
    // Android ignores (clamps) a scroll asked for before it knows the chapter's full height, so the
    // jump is repeated while the chapter settles; onContentSizeChange below also retries it.
    const retries = [80, 250, 500, 900, 1400, 2000].map(delay => setTimeout(() => {
      if (pendingTarget.current) scrollToVerse(pendingTarget.current, false);
    }, delay));
    const settle = setTimeout(() => { pendingTarget.current = 0; }, 2600);
    const clear = setTimeout(() => setFlashVerse(null), 3000);
    return () => { retries.forEach(clearTimeout); clearTimeout(settle); clearTimeout(clear); };
  }, [chapterContent, loading, targetVerse]);

  const getSortedVerseNumbers = (verseNumbers: number[]) => [...verseNumbers].sort((left, right) => left - right);

  const buildCitationReference = (verseNumbers: number[]) => {
    const sortedVerseNumbers = getSortedVerseNumbers(verseNumbers);
    if (sortedVerseNumbers.length === 0) {
      return '';
    }

    // Consecutive verses become ranges: 3, 4, 5, 7 → "3-5, 7".
    const parts: string[] = [];
    for (let i = 0; i < sortedVerseNumbers.length; i++) {
      const start = sortedVerseNumbers[i];
      while (sortedVerseNumbers[i + 1] === sortedVerseNumbers[i] + 1) i++;
      parts.push(start === sortedVerseNumbers[i] ? String(start) : start + '-' + sortedVerseNumbers[i]);
    }
    return `${getDisplayBookName(book)} ${chapterValue}:${parts.join(', ')}`;
  };

  const buildCitationText = (verseNumbers: number[]) => {
    const sortedVerseNumbers = getSortedVerseNumbers(verseNumbers);
    if (sortedVerseNumbers.length === 0) {
      return '';
    }

    const versionLabelByCollectionId: Record<string, string> = {
      rv1960: 'Reina-Valera 1960',
      jewish: isHebrewTanakh ? 'TaNakh Hebreo (Masorético)' : 'TaNakh',
      nbv: 'Nueva Biblia Viva (NBV)',
      quran: 'El Corán',
      catolica: 'Biblia Platense (Straubinger)',
    };
    const versionLabel = versionLabelByCollectionId[collection?.id ?? '']
      ?? collection?.shortName
      ?? collection?.title
      ?? 'Texto sagrado';
    const reference = buildCitationReference(sortedVerseNumbers);

    const verseLines = sortedVerseNumbers
      .map((verseNumber) => {
        const verse = chapterContent.verses.find((item) => item.number === verseNumber);
        // A leading "»" continues a quotation from an earlier verse: out of context it only looks odd.
        return verse ? `*${verse.label ?? verse.number}.* ${verse.text.replace(/^»/, '')}` : null;
      })
      .filter(Boolean)
      .join('\n'); // Espacios más cerrados entre versículos

    const header = `*${versionLabel}*\n${reference}`;
    return verseLines ? `${header}\n\n${verseLines}` : header;
  };

  // A tap marks/unmarks in bookmark mode, or adds/removes the verse while selecting.
  const onTapVerse = (verseNumber: number) => {
    if (highlightMode) {
      const current = highlightedVerses[highlightStorageKey] || [];
      saveHighlights(current.includes(verseNumber)
        ? current.filter((v) => v !== verseNumber)
        : [...current, verseNumber].sort((a, b) => a - b));
    }
    if (selectionMode) onPressVerse(verseNumber);
  };

  // ---- Section headings (Catholic and NBV) and Straubinger's notes, loaded once the verses are on screen.
  const [extras, setExtras] = useState<Record<number, VerseExtras>>({});
  const [noteVerse, setNoteVerse] = useState<number | null>(null);
  useEffect(() => {
    if (loading || !hasChapterExtras(collectionId)) return;
    const timer = setTimeout(() => {
      // Extras of a verse that is not shown (omitted, like Mark 9:44 in the Platense, or inside a printed
      // range) go to the previous verse on screen, so no heading or note is lost.
      const lines = chapterContent.verses.map(verse => verse.number);
      const placed: Record<number, VerseExtras> = {};
      for (const [key, value] of Object.entries(getChapterExtras(collectionId, book, chapterValue))) {
        const verse = Number(key);
        const at = lines.includes(verse) ? verse : [...lines].reverse().find(line => line < verse) ?? lines[0];
        if (at === undefined) continue;
        const target = (placed[at] ??= {});
        if (value.h) target.h = [...(target.h ?? []), ...value.h];
        if (value.n) target.n = [...(target.n ?? []), ...value.n];
      }
      setExtras(placed);
    }, 0);
    return () => clearTimeout(timer);
  }, [book, chapterContent, chapterValue, collectionId, loading]);
  const headingVerses = useMemo(() => new Set(Object.entries(extras).filter(([, e]) => e.h).map(([verse]) => Number(verse))), [extras]);

  const scale = settings.textScale;
  const headingStyle: Record<HeadingKind, object> = {
    // "I. DESDE LA CREACIÓN…" / "Primer canto": small spaced capitals.
    M: [styles.majorHeading, { color: theme.reader.number, fontSize: 12 * scale, lineHeight: 18 * scale }],
    // "La torre de Babel": italic, centered.
    S: [styles.sectionHeading, themed.font, { color: theme.reader.heading, fontSize: 16 * scale, lineHeight: 23 * scale }],
    // "Salmo de David, cuando huía…": the psalm's own title, quieter than a section heading.
    D: [styles.psalmTitle, themed.font, { color: theme.reader.number, fontSize: 14 * scale, lineHeight: 20 * scale }],
    // "La amada": who speaks next in the Song of Songs.
    P: [styles.speakerLabel, { color: theme.reader.number, fontSize: 11 * scale, lineHeight: 16 * scale }],
  };
  const renderHeadings = (verseNumber: number) => extras[verseNumber]?.h?.map(([kind, text], i) => (
    <Text key={'h' + verseNumber + i} style={headingStyle[kind] ?? headingStyle.S}>
      {kind === 'P' ? text.toUpperCase() : text}
    </Text>
  ));

  // Small tappable icon after a verse that has a note.
  const noteMark = (verseNumber: number) => extras[verseNumber]?.n ? (
    <Text accessibilityRole="button" accessibilityLabel={'Nota del versículo ' + verseNumber} onPress={() => setNoteVerse(verseNumber)}>
      {' '}<MaterialIcons name="sticky-note-2" size={Math.round(15 * settings.textScale)} color={theme.reader.number} />
    </Text>
  ) : null;

  // ---- Large initial letter of the chapter (with an opening quote or ¿ ¡ kept beside it).
  const firstVerse = chapterContent.verses[0];
  const capMatch = !isHebrewTanakh && firstVerse ? /^([«“"‘'¿¡(]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/.exec(firstVerse.text) : null;
  const dropCap = capMatch && firstVerse ? { letter: capMatch[1], rest: firstVerse.text.slice(capMatch[1].length) } : null;
  const dropCapLetterStyle = [{ color: theme.reader.number }, settings.readerFont === 'libro' ? { fontFamily: GARAMOND.bold, fontWeight: 'normal' as const } : styles.dropCapSerif];

  const onLongPressVerse = (verseNumber: number) => {
    // A soft vibration confirms the long press.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setOptionsVerseNumber(verseNumber);
    setOptionsOpen(true);
  };

  // Marcar versículo (activar modo de marcado múltiple)
  const onHighlightVerse = () => {
    setHighlightMode(true);
    setOptionsOpen(false);
  };

  // Marcar/desmarcar versículo con un click en modo de marcado
  // (Implementación fusionada con la función original más abajo)

  // Desactivar modo de marcado múltiple (SIN perder los datos marcados)
  const onUnhighlightVerse = () => {
    // Only leaves the mode: every tap was already saved.
    setHighlightMode(false);
    setOptionsOpen(false);
  };

  // (Eliminado: no desactivar highlightMode automáticamente al cambiar de capítulo/libro)

  const onToggleSelectionMode = () => {
    if (optionsVerseNumber === null) {
      return;
    }

    setSelectedVerseNumbers((currentSelection) => {
      if (currentSelection.includes(optionsVerseNumber)) {
        return currentSelection;
      }

      return [optionsVerseNumber];
    });

    setSelectionMode(true);
    setOptionsOpen(false);
  };

   
  const onPressVerse = (verseNumber: number) => {
    if (!selectionMode) {
      return;
    }

    // Any combination is allowed (3 and 7); the citation joins them as "3, 7".
    if (selectedVerseSet.has(verseNumber)) {
      const remainingVerses = selectedVerseNumbers.filter((item) => item !== verseNumber);
      setSelectedVerseNumbers(remainingVerses);
      if (remainingVerses.length === 0) setSelectionMode(false);
      return;
    }
    setSelectedVerseNumbers(getSortedVerseNumbers([...selectedVerseNumbers, verseNumber]));
  };

  // Short message over the text ("Copiado"), gone by itself.
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const endSelection = () => {
    setOptionsOpen(false);
    setOptionsVerseNumber(null);
    setSelectionMode(false);
    setSelectedVerseNumbers([]);
  };

  const onCopySelection = async () => {
    const payload = buildCitationText(activeVerseNumbers);
    if (!payload) return;
    const many = activeVerseNumbers.length > 1;
    await Clipboard.setStringAsync(payload);
    endSelection();
    setToast(many ? 'Versículos copiados' : 'Versículo copiado');
  };

  // The phone's own share menu: WhatsApp, Telegram, Facebook, mail, messages…
  const onShareSelection = async () => {
    const payload = buildCitationText(activeVerseNumbers);
    if (!payload) return;
    try {
      const result = await Share.share({ message: payload });
      if (result.action !== Share.dismissedAction) endSelection();
    } catch {
      Alert.alert('No se pudo compartir', 'Intenta de nuevo o usa «Copiar».');
    }
  };

  const onSelectBookFromHeader = (bookName: string) => {
    setBookPickerOpen(false);
    setChapterPickerBook(bookName);
  };

  const onSelectChapterFromPanel = (chapter: number) => {
    const targetBook = chapterPickerFromHeader ? book : (chapterPickerBook ?? book);

    router.replace({
      pathname: '/chapter-reader',
      params: {
        collectionId,
        book: targetBook,
        chapter: String(chapter),
        tanakhLanguage,
      },
    });

    setChapterPickerBook(null);
    setChapterPickerFromHeader(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, themed.page]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.reader.statusBar} />

      <View style={[styles.header, themed.header]}>
        <View style={styles.headerTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regresar"
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerPressed]}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF3DF" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.collectionLabel} numberOfLines={1}>{collection?.title ?? 'Lectura'}</Text>
            <View style={styles.chapterTitleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Libro: ${getDisplayBookName(book)}. Cambiar de libro`}
                onPress={() => setBookPickerOpen(true)}
                style={({ pressed }) => [styles.bookSelectorButton, pressed && styles.headerPressed]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.chapterTitle, isCompactCollection && styles.chapterTitleCompact, isHebrewTanakh && styles.chapterTitleHebrew]}>
                  {getDisplayBookName(book)}
                </Text>
                <MaterialIcons name="expand-more" size={20} color="#E9D9B8" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Capítulo ${chapterValue}. Cambiar de capítulo`}
                onPress={() => setChapterPickerFromHeader(true)}
                style={({ pressed }) => [styles.chapterBadge, pressed && styles.headerPressed]}>
                <Text style={styles.chapterBadgeText}>{chapterValue > 0 ? chapterValue : '-'}</Text>
                <MaterialIcons name="expand-more" size={16} color="#FFF3DF" />
              </Pressable>
            </View>
            <Text style={styles.chapterMeta}>
              {chapterCount > 0 && chapterValue > 0 ? `Capítulo ${chapterValue} de ${chapterCount}` : 'Capítulo seleccionado'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar en esta Biblia"
            onPress={() => setSearchOpen(true)}
            hitSlop={6}
            style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerPressed]}>
            <MaterialIcons name="search" size={22} color="#FFF3DF" />
          </Pressable>
          {!isHebrewTanakh ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speaking ? 'Detener la lectura en voz alta' : 'Escuchar este libro en voz alta'}
              disabled={loading || chapterContent.verses.length === 0}
              onPress={toggleReading}
              hitSlop={6}
              style={({ pressed }) => [styles.headerIconButton, speaking && styles.listenButtonActive, pressed && styles.headerPressed]}>
              <MaterialIcons name={speaking ? 'stop' : 'volume-up'} size={22} color="#FFF3DF" />
            </Pressable>
          ) : (
            // Keeps the title centered when there is no listen button.
            <View style={styles.headerIconSpacer} />
          )}
        </View>
          {isJewishCollection ? (
            <View style={styles.languageRow}>
              <View style={styles.languageToggleWrap}>
                <Pressable
                  style={[styles.languageToggleButton, tanakhLanguage === 'es' && styles.languageToggleButtonActive]}
                  onPress={() => onChangeTanakhLanguage('es')}>
                  <Text style={[styles.languageToggleText, tanakhLanguage === 'es' && styles.languageToggleTextActive]}>ES</Text>
                </Pressable>
                <Pressable
                  style={[styles.languageToggleButton, tanakhLanguage === 'he' && styles.languageToggleButtonActive]}
                  onPress={() => onChangeTanakhLanguage('he')}>
                  <Text style={[styles.languageToggleText, tanakhLanguage === 'he' && styles.languageToggleTextActive]}>עברית</Text>
                </Pressable>
              </View>
              <Text style={styles.languageStatus}>
                {isHebrewTanakh ? 'Idioma actual: Hebreo' : 'Idioma actual: Español'}
              </Text>
            </View>
          ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        onScrollBeginDrag={() => { pendingTarget.current = 0; }}
        // The chapter's height is now known: the jump to a bookmarked verse can no longer be clamped.
        onContentSizeChange={() => { if (pendingTarget.current) scrollToVerse(pendingTarget.current, false); }}
        contentContainerStyle={[styles.content, themed.page, { paddingBottom: Math.max(24, insets.bottom + 14) }]}
        showsVerticalScrollIndicator={false}>
        {chapterContent.heading ? <Text style={[styles.heading, themed.heading, themed.fontBold, isHebrewTanakh && styles.headingHebrew, isHebrewTanakh && themed.headingHebrew]}>{chapterContent.heading}</Text> : null}

        {selectionMode && selectedVerseNumbers.length > 0 ? (
          <View style={styles.selectionInfoBar}>
            <Text style={styles.selectionInfoText}>
              Seleccionados: {buildCitationReference(selectedVerseNumbers)}
            </Text>
            <Text style={styles.selectionInfoHint}>
              Toca más versículos para agregarlos o usa las opciones del menú
            </Text>
          </View>
        ) : selectionMode ? (
          <View style={styles.selectionInfoBar}>
            <Text style={styles.selectionInfoText}>Modo selección activo</Text>
            <Text style={styles.selectionInfoHint}>
              Toca los versículos que deseas seleccionar
            </Text>
          </View>
        ) : highlightMode ? (
          <View style={styles.selectionInfoBar}>
            <Text style={styles.selectionInfoText}>Modo marcador activo</Text>
            <Text style={styles.selectionInfoHint}>
              Toca los versículos para marcar/desmarcar
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#6B7280" />
            <Text style={styles.loadingText}>Cargando versículos…</Text>
          </View>
        ) : chapterContent.verses.length > 0 && paragraphLayout ? (
          paragraphBlocks(chapterContent.verses, headingVerses).map((block, blockIndex) => {
            const paragraphStyle = [styles.verseText, styles.paragraphText, themed.verseText, themed.font];
            // Each verse is two spans (its small number and its text) sharing the same touch and color.
            const spans: DropCapSpan[] = block.flatMap((verse, i) => {
              const marked = highlightedVerses[highlightStorageKey]?.includes(verse.number);
              const active = selectedVerseSet.has(verse.number) || readingVerse === verse.number || flashVerse === verse.number;
              const look = [marked && themed.highlighted, active && themed.selected, (marked || active) && [styles.verseTextSelected, themed.markedText, themed.fontBold]];
              const touch = { onPress: () => onTapVerse(verse.number), onLongPress: () => onLongPressVerse(verse.number) };
              const opensChapter = blockIndex === 0 && i === 0 && dropCap;
              return [
                ...(opensChapter ? [] : [{ key: 'n' + verse.number, text: (verse.label ?? verse.number) + ' ', style: [look, themed.inlineNumber], ...touch }]),
                { key: 'v' + verse.number, text: (opensChapter ? dropCap.rest : verse.text) + ' ', style: look, ...touch, after: noteMark(verse.number) },
              ];
            });
            return (
              // Measured here, on the scroll content's direct child: the inner views report offsets inside it.
              <View key={block[0].number} onLayout={(event) => recordLayout(block.map(verse => verse.number), event.nativeEvent.layout.y)}>
                {renderHeadings(block[0].number)}
                <View style={styles.paragraph}>
                  {blockIndex === 0 && dropCap ? (
                    <DropCapText letter={dropCap.letter} spans={spans} textStyle={paragraphStyle} letterStyle={dropCapLetterStyle} lineHeight={30 * settings.textScale} />
                  ) : (
                    <Text style={paragraphStyle}>
                      {spans.map(span => (
                        <Text key={span.key} style={span.style} onPress={span.onPress} onLongPress={span.onLongPress}>{span.text}{span.after}</Text>
                      ))}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        ) : chapterContent.verses.length > 0 ? (
          chapterContent.verses.map((verse, index) => {
            const marked = (highlightedVerses[highlightStorageKey] || []).includes(verse.number);
            const verseTextStyle = [
              styles.verseText,
              themed.verseText,
              themed.font,
              isHebrewTanakh && [styles.verseTextHebrew, themed.verseTextHebrew],
              selectedVerseSet.has(verse.number) && [styles.verseTextSelected, themed.markedText, themed.fontBold],
              marked && [styles.verseTextHighlighted, themed.markedText, themed.fontBold],
            ];
            const opensChapter = index === 0 && dropCap;
            return (
            <View key={verse.number} onLayout={(event) => recordLayout([verse.number], event.nativeEvent.layout.y)}>
            {renderHeadings(verse.number)}
            <Pressable
              style={[
                styles.verseRow,
                isHebrewTanakh && styles.verseRowHebrew,
                selectedVerseSet.has(verse.number) && [styles.verseRowSelected, themed.selected],
                readingVerse === verse.number && [styles.verseRowSelected, themed.selected],
                marked && [styles.verseRowHighlighted, themed.highlighted],
                flashVerse === verse.number && [styles.verseRowSelected, themed.selected],
              ]}
              onLongPress={() => onLongPressVerse(verse.number)}
              onPress={() => onTapVerse(verse.number)}
              delayLongPress={280}>
              {opensChapter ? (
                // The first verse opens with the large initial instead of its number.
                <View style={styles.dropCapVerse}>
                  <DropCapText letter={dropCap.letter} textStyle={[verseTextStyle, styles.noFlex]} letterStyle={dropCapLetterStyle}
                    lineHeight={30 * settings.textScale} spans={[{ key: 'v', text: dropCap.rest, after: noteMark(verse.number) }]} />
                </View>
              ) : <>
                <Text style={[styles.verseNumber, themed.verseNumber, verse.label ? styles.verseNumberRange : null, isHebrewTanakh && styles.verseNumberHebrew]}>{verse.label ?? verse.number}</Text>
                <Text style={verseTextStyle}>{verse.text}{noteMark(verse.number)}</Text>
              </>}
            </Pressable>
            </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No se pudo cargar</Text>
            <Text style={styles.emptyText}>{chapterContent.note}</Text>
            <Pressable style={styles.retryButton} onPress={() => { setLoading(true); setRetryCount((n) => n + 1); }}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {collection && COLLECTION_CREDITS[collection.id] && !loading && chapterContent.verses.length > 0 ? (
          <Text style={[styles.creditText, { color: theme.reader.number }]}>{COLLECTION_CREDITS[collection.id]}</Text>
        ) : null}
      </ScrollView>

      <Sheet visible={bookPickerOpen} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setBookPickerOpen(false)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setBookPickerOpen(false)} />
          <View style={[styles.panelCard, isCompactCollection && styles.panelCardCompact, { paddingBottom: sheetBottom }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Seleccionar libro</Text>
              <Pressable style={styles.panelClose} onPress={() => setBookPickerOpen(false)}>
                <Text style={styles.panelCloseText}>✕</Text>
              </Pressable>
            </View>

            {isRv1960 && (
              <View style={styles.testamentWrap}>
                <Pressable
                  style={[styles.testamentButton, bookPickerTestament === 'antiguo' && styles.testamentButtonActive]}
                  onPress={() => setBookPickerTestament('antiguo')}>
                  <Text style={[styles.testamentText, bookPickerTestament === 'antiguo' && styles.testamentTextActive]}>
                    Antiguo
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.testamentButton, bookPickerTestament === 'nuevo' && styles.testamentButtonActive]}
                  onPress={() => setBookPickerTestament('nuevo')}>
                  <Text style={[styles.testamentText, bookPickerTestament === 'nuevo' && styles.testamentTextActive]}>
                    Nuevo
                  </Text>
                </Pressable>
              </View>
            )}

            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelBookList} showsVerticalScrollIndicator={false}>
              {bookPickerItems.map((item, index) => {
                if (item.type === 'section') {
                  const sectionLabel = isHebrewTanakh ? getDisplaySectionName(item.label) : item.label;

                  return (
                    <View key={`section-${item.label}-${index}`} style={[styles.panelSectionBlock, index > 0 && styles.panelSectionBlockSpaced]}>
                      <View style={styles.panelSectionLine} />
                      <Text style={[styles.panelSectionTitle, isCompactCollection && styles.panelSectionTitleCompact, isHebrewTanakh && styles.panelSectionTitleHebrew]}>{sectionLabel}</Text>
                    </View>
                  );
                }

                if (item.type === 'subsection') {
                  const subsectionLabel = isHebrewTanakh ? getDisplaySubsectionName(item.label) : item.label;

                  return (
                    <Text key={`subsection-${item.label}-${index}`} style={[styles.panelSubsectionTitle, isCompactCollection && styles.panelSubsectionTitleCompact, isHebrewTanakh && styles.panelSubsectionTitleHebrew]}>
                      {subsectionLabel}
                    </Text>
                  );
                }

                const itemLabel = isHebrewTanakh ? getDisplayBookName(item.book) : displayBookName(item.label);

                return (
                  <Pressable
                    key={item.book}
                    style={[styles.panelBookRow, isCompactCollection && styles.panelBookRowCompact]}
                    onPress={() => onSelectBookFromHeader(item.book)}>
                    <Text numberOfLines={2} style={[styles.panelBookText, isCompactCollection && styles.panelBookTextCompact, isHebrewTanakh && styles.panelBookTextHebrew]}>{itemLabel}</Text>
                    <Text style={styles.panelBookArrow}>›</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Sheet>

      <Sheet visible={chapterPickerBook !== null || chapterPickerFromHeader} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => {
        setChapterPickerBook(null);
        setChapterPickerFromHeader(false);
      }}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => {
            setChapterPickerBook(null);
            setChapterPickerFromHeader(false);
          }} />
          <View style={[styles.panelCard, { paddingBottom: sheetBottom }]}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={[styles.panelTitle, isHebrewTanakh && styles.panelTitleHebrew]}>
                  {chapterPickerFromHeader ? getDisplayBookName(book) : (chapterPickerBook ? getDisplayBookName(chapterPickerBook) : '')}
                </Text>
                <Text style={styles.panelSub}>
                  {getCollectionChapterCount(collectionId, chapterPickerFromHeader ? book : (chapterPickerBook ?? '')) || 1} capítulos
                </Text>
              </View>
              <Pressable style={styles.panelClose} onPress={() => {
                setChapterPickerBook(null);
                setChapterPickerFromHeader(false);
              }}>
                <Text style={styles.panelCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.chapterGrid} showsVerticalScrollIndicator={false}>
              {Array.from({ length: getCollectionChapterCount(collectionId, chapterPickerFromHeader ? book : (chapterPickerBook ?? '')) || 1 }, (_, idx) => idx + 1).map((chapter) => {
                // Only the chapter being read is marked, not the same number in another book.
                const current = chapter === chapterValue && (chapterPickerFromHeader || chapterPickerBook === book);
                return (
                  <Pressable key={chapter} style={[styles.chapterChip, current && styles.chapterChipActive]} onPress={() => onSelectChapterFromPanel(chapter)}>
                    <Text style={[styles.chapterChipText, current && styles.chapterChipTextActive]}>{chapter}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Sheet>

      <Sheet visible={optionsOpen} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setOptionsOpen(false)} />
          <View style={[styles.optionsCard, { marginBottom: 26 + insets.bottom }]}>
            {/* MODO SELECCIÓN DE VERSÍCULOS */}
            {selectionMode && selectedVerseNumbers.length > 0 ? (
              <>
                <Text style={styles.optionsTitle}>{buildCitationReference(selectedVerseNumbers)}</Text>
                <Text style={styles.optionsHint}>
                  {selectedVerseNumbers.length === 1 ? '1 versículo seleccionado' : selectedVerseNumbers.length + ' versículos seleccionados'}
                </Text>
                <Pressable style={styles.optionsButton} onPress={onCopySelection}>
                  <MaterialIcons name="content-copy" size={18} color={optionIcon} />
                  <Text style={styles.optionsButtonText}>Copiar texto completo</Text>
                </Pressable>
                <Pressable style={styles.optionsButton} onPress={onShareSelection}>
                  <MaterialIcons name="share" size={18} color={optionIcon} />
                  <Text style={styles.optionsButtonText}>Compartir…</Text>
                </Pressable>
                <Pressable style={[styles.optionsButton, styles.optionsButtonCancel]} onPress={() => {
                  setSelectionMode(false);
                  setSelectedVerseNumbers([]);
                  setOptionsOpen(false);
                }}>
                  <Text style={styles.optionsButtonText}>Cancelar selección</Text>
                </Pressable>
              </>
            ) : selectionMode ? (
              <>
                <Text style={styles.optionsTitle}>Modo selección</Text>
                <Text style={styles.optionsHint}>Toca los versículos que deseas seleccionar</Text>
                <Pressable style={[styles.optionsButton, styles.optionsButtonCancel]} onPress={() => {
                  setSelectionMode(false);
                  setSelectedVerseNumbers([]);
                  setOptionsOpen(false);
                }}>
                  <Text style={styles.optionsButtonText}>Cancelar selección</Text>
                </Pressable>
              </>
            ) : /* MODO MARCADO */ highlightMode ? (
              <>
                <Text style={styles.optionsTitle}>Modo marcador</Text>
                <Text style={styles.optionsHint}>Toca los versículos para marcar/desmarcar</Text>
                <Pressable style={[styles.optionsButton, styles.optionsButtonCancel]} onPress={onUnhighlightVerse}>
                  <Text style={styles.optionsButtonText}>Salir del marcador</Text>
                </Pressable>
              </>
            ) : /* MENÚ PRINCIPAL */ (
              <>
                <Text style={styles.optionsTitle}>
                  {optionsVerseNumber !== null ? buildCitationReference([optionsVerseNumber]) : 'Opciones del versículo'}
                </Text>
                <View style={styles.optionsRow}>
                  <Pressable style={[styles.optionsButton, styles.optionsButtonHalf]} onPress={onCopySelection}>
                    <MaterialIcons name="content-copy" size={18} color={optionIcon} />
                    <Text style={styles.optionsButtonText}>Copiar</Text>
                  </Pressable>
                  <Pressable style={[styles.optionsButton, styles.optionsButtonHalf]} onPress={onShareSelection}>
                    <MaterialIcons name="share" size={18} color={optionIcon} />
                    <Text style={styles.optionsButtonText}>Compartir</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.optionsButton} onPress={onToggleSelectionMode}>
                  <Text style={styles.optionsButtonText}>Seleccionar versículos</Text>
                </Pressable>
                <Pressable style={styles.optionsButton} onPress={onHighlightVerse}>
                  <Text style={styles.optionsButtonText}>Marcar versículos</Text>
                </Pressable>
                {typeof optionsVerseNumber === 'number' && (highlightedVerses[highlightStorageKey] || []).includes(optionsVerseNumber) && (
                  <Pressable
                    style={styles.optionsButton}
                    onPress={() => {
                      saveHighlights((highlightedVerses[highlightStorageKey] || []).filter((v) => v !== optionsVerseNumber));
                      setOptionsOpen(false);
                      setOptionsVerseNumber(null);
                    }}>
                    <Text style={styles.optionsButtonText}>Desmarcar este versículo</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.optionsButton, styles.optionsButtonCancel]} onPress={() => {
                  setOptionsOpen(false);
                  setOptionsVerseNumber(null);
                }}>
                  <Text style={styles.optionsButtonText}>Salir</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Sheet>

      {/* Search without leaving the chapter: a result opens its verse here; a book opens its chapters. */}
      <Sheet visible={searchOpen} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setSearchOpen(false)} />
          <View style={[styles.searchSheet, { backgroundColor: theme.ui.page, paddingTop: 14 }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: theme.ui.text }]}>Buscar en {collection?.shortName ?? 'esta Biblia'}</Text>
              <Pressable style={styles.panelClose} accessibilityLabel="Cerrar búsqueda" onPress={() => setSearchOpen(false)}>
                <Text style={styles.panelCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: sheetBottom }} showsVerticalScrollIndicator={false}>
              <BibleSearch collectionId={collectionId} theme={theme} autoFocus onActiveChange={() => undefined}
                onOpenVerse={(targetBook, chapter, verse) => {
                  setSearchOpen(false);
                  router.replace({
                    pathname: '/chapter-reader',
                    params: { collectionId, book: targetBook, chapter: String(chapter), tanakhLanguage, ...(verse ? { verse: String(verse) } : {}) },
                  });
                }}
                onPickBook={(targetBook) => { setSearchOpen(false); setChapterPickerBook(targetBook); }} />
            </ScrollView>
          </View>
        </View>
      </Sheet>

      {/* Mons. Straubinger's note(s) for the tapped verse. */}
      <Sheet visible={noteVerse !== null} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setNoteVerse(null)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setNoteVerse(null)} />
          <View style={[styles.noteSheet, { backgroundColor: theme.reader.page, paddingBottom: sheetBottom }]}>
            <View style={styles.panelHeader}>
              <View style={styles.noteHeaderText}>
                <Text style={[styles.noteKicker, { color: theme.reader.number }]}>{NOTE_SOURCES[collectionId]?.title ?? 'NOTA'}</Text>
                <Text style={[styles.panelTitle, { color: theme.reader.heading }]}>
                  {noteVerse !== null ? `${getDisplayBookName(book)} ${chapterValue}:${noteVerse}` : ''}
                </Text>
              </View>
              <Pressable style={styles.panelClose} accessibilityLabel="Cerrar nota" onPress={() => setNoteVerse(null)}>
                <Text style={styles.panelCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.noteBody}>
              {(noteVerse !== null ? extras[noteVerse]?.n ?? [] : []).map(([label, text], i) => (
                <View key={i} style={styles.noteItem}>
                  {label && label !== String(noteVerse) ? (
                    <Text style={[styles.noteLabel, { color: theme.reader.number }]}>v. {label}</Text>
                  ) : null}
                  <Text style={[styles.noteText, themed.font, { color: theme.reader.text, fontSize: 16 * settings.textScale, lineHeight: 25 * settings.textScale }]}>
                    {noteSegments(text).map((segment, j) => segment.italic
                      ? <Text key={j} style={styles.noteItalic}>{segment.text}</Text>
                      : segment.text)}
                  </Text>
                </View>
              ))}
              {NOTE_SOURCES[collectionId] ? (
                <Text style={[styles.noteSource, { color: theme.reader.number }]}>{NOTE_SOURCES[collectionId].source}</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Sheet>

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { bottom: 40 + insets.bottom }]}>
          <MaterialIcons name="check-circle" size={18} color="#FFF7E9" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  verseNumberRange: {
    width: 'auto',
    minWidth: 24,
  },
  creditText: {
    marginTop: 18,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F6EFD2',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#2F1E12',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
    zIndex: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerIconSpacer: {
    width: 42,
  },
  headerPressed: {
    opacity: 0.7,
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  listenButtonActive: {
    backgroundColor: '#A3542A',
    borderColor: '#E0A06A',
  },
  bookSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: 6,
    paddingRight: 2,
    borderRadius: 10,
  },
  collectionLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(246,239,210,0.72)',
    fontWeight: '700',
  },
  chapterTitle: {
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 30,
    color: '#FFF8E7',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  chapterTitleCompact: {
    fontSize: 19,
    lineHeight: 26,
  },
  chapterTitleHebrew: {
    writingDirection: 'rtl',
    // ...existing code...
    letterSpacing: 0.2,
  },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 11,
    paddingRight: 5,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  chapterBadgeText: {
    fontSize: 15,
    color: '#FFF8E7',
    fontWeight: '800',
  },
  chapterMeta: {
    fontSize: 12,
    color: 'rgba(246,239,210,0.66)',
  },
  languageRow: {
    marginTop: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  languageToggleWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  languageStatus: {
    fontSize: 12,
    color: '#D9C7A8',
    fontWeight: '600',
  },
  languageToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#8A5A33',
    backgroundColor: '#4A2F1A',
  },
  languageToggleButtonActive: {
    backgroundColor: '#6A4325',
    borderColor: '#D9C7A8',
  },
  languageToggleText: {
    fontSize: 12,
    color: '#D9C7A8',
    fontWeight: '700',
  },
  languageToggleTextActive: {
    color: '#FFF7E9',
  },
  content: {
    // On tablets the text keeps a comfortable line length instead of spanning the whole screen.
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 7,
    backgroundColor: '#F6EFD2',
  },
  heading: {
    fontSize: 18,
    lineHeight: 26,
    color: '#3E2D1A',
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  headingHebrew: {
    textAlign: 'right',
    writingDirection: 'rtl',
    // ...existing code...
    lineHeight: 30,
  },
  paragraph: {
    marginBottom: 6,
  },
  paragraphText: {
    flex: 0,
    textAlign: 'justify',
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E6D9BA',
  },
  verseRowHebrew: {
    flexDirection: 'row-reverse',
  },
  verseRowSelected: {
    backgroundColor: '#EADBBC',
    borderRadius: 10,
    paddingHorizontal: 8,
    borderBottomColor: '#B98A50',
  },
  verseRowHighlighted: {
    backgroundColor: '#FFF9C4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  verseNumber: {
    width: 24,
    fontSize: 15,
    lineHeight: 24,
    color: '#8A6F4D',
    fontWeight: '700',
    textAlign: 'right',
  },
  verseNumberHebrew: {
    textAlign: 'left',
  },
  verseText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 30,
    color: '#2F2418',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  verseTextHebrew: {
    textAlign: 'right',
    writingDirection: 'rtl',
    // ...existing code...
    fontSize: 22,
    lineHeight: 38,
    letterSpacing: 0.15,
  },
  verseTextSelected: {
    color: '#24170F',
    fontWeight: '600',
  },
  verseTextHighlighted: {
    backgroundColor: 'transparent',
    color: '#2F2418',
    fontWeight: '600',
  },
  selectionInfoBar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B98A50',
    backgroundColor: '#EADBBC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  selectionInfoText: {
    fontSize: 13,
    color: '#5B4732',
    fontWeight: '700',
    textAlign: 'center',
  },
  selectionInfoHint: {
    fontSize: 11,
    color: '#7A6248',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCCFB3',
    backgroundColor: '#F3E8CC',
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#3E2D1A',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#5B4732',
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingState: {
    marginTop: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#7A6243',
  },
  overlayWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panelScroll: {
    flexShrink: 1,
  },
  overlayBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(106, 67, 37, 0.5)',
  },
  panelCard: {
    maxHeight: '74%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#D2B48C',
    borderWidth: 1,
    borderColor: '#5C3E24',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  panelCardCompact: {
    maxHeight: '70%',
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2F1E12',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  panelTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  panelSub: {
    fontSize: 13,
    color: '#7A6243',
  },
  panelClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A2F1A',
  },
  panelCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F6EFD2',
  },
  optionsCard: {
    marginHorizontal: 18,
    marginBottom: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#5C3E24',
    backgroundColor: '#D2B48C',
    padding: 16,
    gap: 10,
  },
  optionsTitle: {
    fontSize: 18,
    color: '#2F1E12',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  majorHeading: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 10,
  },
  sectionHeading: {
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  psalmTitle: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  speakerLabel: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 10,
    marginBottom: 2,
  },
  dropCapVerse: {
    flex: 1,
  },
  dropCapSerif: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  noFlex: {
    flex: 0,
  },
  noteSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 18,
    maxHeight: '80%',
  },
  noteHeaderText: {
    flex: 1,
    gap: 2,
  },
  noteKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  noteBody: {
    gap: 14,
    paddingBottom: 8,
  },
  noteItem: {
    gap: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  noteText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  noteItalic: {
    fontStyle: 'italic',
  },
  noteSource: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 4,
  },
  searchSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    height: '88%',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionsButtonHalf: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(30,20,12,0.92)',
  },
  toastText: {
    color: '#FFF7E9',
    fontSize: 14,
    fontWeight: '700',
  },
  optionsButton: {
    borderRadius: 12,
    backgroundColor: '#6A4325',
    borderWidth: 1,
    borderColor: '#8A5A33',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionsButtonText: {
    fontSize: 15,
    color: '#F6EFD2',
    fontWeight: '700',
  },
  optionsHint: {
    fontSize: 13,
    color: '#5C4A3C',
    fontStyle: 'italic',
    marginTop: 2,
  },
  optionsButtonCancel: {
    backgroundColor: '#8A5A33',
    borderColor: '#6A4325',
  },
  panelBookList: {
    gap: 8,
    paddingBottom: 6,
  },
  panelSectionBlock: {
    marginTop: 2,
    gap: 6,
  },
  panelSectionBlockSpaced: {
    marginTop: 12,
  },
  panelSectionLine: {
    height: 1,
    backgroundColor: '#C9B791',
  },
  panelSectionTitle: {
    marginBottom: 2,
    paddingHorizontal: 4,
    fontSize: 14,
    color: '#6A4325',
    fontWeight: '900',
  },
  panelSectionTitleCompact: {
    fontSize: 13,
  },
  panelSectionTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  panelSubsectionTitle: {
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 6,
    fontSize: 13,
    color: '#8A6F4D',
    fontWeight: '800',
  },
  panelSubsectionTitleCompact: {
    fontSize: 12,
  },
  panelSubsectionTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  testamentWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  testamentButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  testamentButtonActive: {
    backgroundColor: '#2F1E12',
    borderColor: '#1A1410',
  },
  testamentText: {
    fontSize: 14,
    color: '#1F1F1F',
    fontWeight: '700',
  },
  testamentTextActive: {
    color: '#FFFFFF',
  },
  panelBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCCFB3',
    backgroundColor: '#F6EFD2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  panelBookRowCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  panelBookText: {
    flex: 1,
    fontSize: 16,
    color: '#2F2418',
    fontWeight: '600',
  },
  panelBookTextCompact: {
    fontSize: 14,
    lineHeight: 19,
  },
  panelBookTextHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  panelTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  panelBookArrow: {
    fontSize: 20,
    color: '#8A6F4D',
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  chapterChip: {
    width: 52,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCCFB3',
    backgroundColor: '#F6EFD2',
  },
  chapterChipActive: {
    backgroundColor: '#6A4325',
    borderColor: '#8A5A33',
  },
  chapterChipText: {
    fontSize: 16,
    color: '#2F2418',
    fontWeight: '700',
  },
  chapterChipTextActive: {
    color: '#F6EFD2',
  },
});
