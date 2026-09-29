import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppSettingsSheet } from '@/components/home/app-settings-sheet';
import { ContinueReadingCard } from '@/components/home/continue-reading-card';
import { OpenBookIcon } from '@/components/home/open-book-icon';
import { VerseOfDayCard } from '@/components/home/verse-of-day-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTheme, useAppSettings } from '@/constants/app-settings';
import { displayBookName, LastReading, loadLastReadings } from '@/constants/reading-history';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    getCollectionChapterCount,
    CATHOLIC_BOOK_LIST,
    SACRED_BOOKS,
    TANAKH_BOOK_LIST,
    getBooksForCollection,
    type CollectionBookListItem,
    type SacredBook,
    type TanakhLanguage,
    type TestamentType,
} from '@/constants/scripture';

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

const COLLECTION_META: Record<string, string> = {
  rv1960: '66 libros · AT y NT',
  catolica: '73 libros',
  nbv: 'Español actual · 2008',
};
const collectionMeta = (id: string) => COLLECTION_META[id] ?? '';

function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** A shelf slot that slides in after the previous one and sinks slightly when pressed. */
function ShelfTile({ index, label, onPress, style, children }: {
  index: number; label: string; onPress: () => void; style: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const [appear] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1, duration: 420, delay: 180 + index * 90, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [appear, index]);
  const pressTo = (toValue: number) => Animated.spring(press, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return <Animated.View style={[style, {
    opacity: appear,
    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: press }],
  }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      onPressIn={() => pressTo(0.95)} onPressOut={() => pressTo(1)} style={styles.shelfPressable}>
      {children}
    </Pressable>
  </Animated.View>;
}

function ShelfMeta({ text, resume, title, theme }: { text: string; resume?: string | null; title?: string; theme: AppTheme }) {
  return <View style={styles.shelfMeta}>
    {title ? <Text style={[styles.shelfName, { color: theme.home.tileText }]} numberOfLines={2}>{title}</Text> : null}
    {resume ? <Text style={[styles.shelfResume, { color: theme.home.accent }]} numberOfLines={1}>▶ {resume}</Text>
      : <Text style={[styles.shelfDetail, { color: theme.home.tileText }]} numberOfLines={1}>{text}</Text>}
  </View>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readings, setReadings] = useState<Awaited<ReturnType<typeof loadLastReadings>>>({ bible: null, latest: null, pdfCount: 0 });
  // Refresh "continue reading" every time the user comes back to this screen.
  useFocusEffect(useCallback(() => {
    let alive = true;
    void loadLastReadings().then(result => { if (alive) setReadings(result); });
    return () => { alive = false; };
  }, []));
  // Colors for the opened-Bible list; the classic theme keeps the original look untouched.
  const lib = useMemo(() => {
    if (theme.id === 'clasico') return null;
    const ui = theme.ui;
    return StyleSheet.create({
      readingBoard: { backgroundColor: theme.home.card, borderColor: theme.home.panelBorder },
      readingCard: { backgroundColor: ui.page, borderColor: ui.border },
      readingTitle: { color: ui.text },
      openedBibleName: { color: ui.muted },
      selectorLabel: { color: ui.muted },
      backButton: { backgroundColor: ui.primary, borderColor: ui.primary },
      toggle: { backgroundColor: ui.card, borderColor: ui.border },
      toggleActive: { backgroundColor: ui.primary, borderColor: ui.primary },
      toggleText: { color: ui.text },
      toggleTextActive: { color: ui.primaryText },
      sectionTitle: { color: ui.text },
      subsectionTitle: { color: ui.muted },
      bookRow: { backgroundColor: ui.card, borderColor: ui.border },
      bookRowText: { color: ui.text },
      bookRowArrow: { color: ui.muted },
      chapterPanel: { backgroundColor: ui.page, borderColor: ui.border },
      chapterPanelSub: { color: ui.muted },
      chapterCloseBtn: { backgroundColor: ui.soft, borderColor: ui.border },
      chapterCloseBtnText: { color: ui.text },
      chapterChip: { backgroundColor: ui.card, borderColor: ui.border },
      chapterChipText: { color: ui.text },
    });
  }, [theme]);
  const resumeLabel = (collectionId: string) => readings.bible?.collectionId === collectionId
    ? 'Seguir en ' + displayBookName(readings.bible.book) + ' ' + readings.bible.chapter : null;
  const openReading = (reading: LastReading) => {
    if (reading.kind === 'pdf') {
      router.push({ pathname: '/pdf-reader-v2', params: { bookmarkId: reading.id } });
      return;
    }
    router.push({
      pathname: '/chapter-reader',
      params: { collectionId: reading.collectionId, book: reading.book, chapter: String(reading.chapter), tanakhLanguage: reading.tanakhLanguage },
    });
  };
  const { height } = useWindowDimensions();
  const [openedCollection, setOpenedCollection] = useState<SacredBook | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedTestament, setSelectedTestament] = useState<TestamentType>('antiguo');
  const [tanakhLanguage, setTanakhLanguage] = useState<TanakhLanguage>('es');
  const [chapterPanelBook, setChapterPanelBook] = useState<string | null>(null);
  const [boardEntrance] = useState(() => new Animated.Value(0));

  // Bibles organized in Old / New Testament.
  const isRv1960 = openedCollection?.id === 'rv1960' || openedCollection?.id === 'nbv';
  const isJewishCollection = openedCollection?.id === 'jewish';
  const isHebrewTanakh = isJewishCollection && tanakhLanguage === 'he';

  const getDisplayBookName = (bookName: string) => {
    if (!isHebrewTanakh) {
      return bookName;
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

  const currentBookItems = useMemo(() => {
    if (!openedCollection) {
      return [] as CollectionBookListItem[];
    }

    if (openedCollection.id === 'jewish') {
      return TANAKH_BOOK_LIST;
    }

    if (openedCollection.id === 'catolica') {
      return CATHOLIC_BOOK_LIST;
    }

    return getBooksForCollection(openedCollection.id, isRv1960 ? selectedTestament : 'antiguo').map((book) => ({
      type: 'book' as const,
      label: book,
      book,
    }));
  }, [isRv1960, openedCollection, selectedTestament]);

  useEffect(() => {
    Animated.timing(boardEntrance, {
      toValue: 1,
      duration: 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [boardEntrance]);

  const boardAnimatedStyle = {
    opacity: boardEntrance,
    transform: [
      { perspective: 900 },
      {
        translateY: boardEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        rotateX: boardEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: ['-8deg', '0deg'],
        }),
      },
      {
        scale: boardEntrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  const onSelectCollection = (item: SacredBook) => {
    setOpenedCollection(item);
    setSelectedBook(null);
    setChapterPanelBook(null);
    setTanakhLanguage('es');
    if (item.id === 'rv1960' || item.id === 'nbv') {
      setSelectedTestament('antiguo');
    }
  };

  const onCloseCollection = () => {
    setOpenedCollection(null);
    setSelectedBook(null);
    setChapterPanelBook(null);
  };

  const onSelectChapter = (chapter: number) => {
    if (!chapterPanelBook || !openedCollection) {
      return;
    }

    setChapterPanelBook(null);
    router.push({
      pathname: '/chapter-reader',
      params: {
        collectionId: openedCollection.id,
        book: chapterPanelBook,
        chapter: String(chapter),
        tanakhLanguage,
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.home.page }]} edges={['top']}>
      <StatusBar style={theme.home.statusBar} />
      <ScrollView
        contentContainerStyle={[
          openedCollection ? styles.containerOpened : styles.container,
          { paddingBottom: Math.max(14, insets.bottom + 10) },
        ]}>
        {!openedCollection && (
          <View style={[styles.headerCard, { backgroundColor: theme.home.card }]}>
            <View style={styles.topBar}>
              <View style={styles.greetingWrap}>
                <Text style={[styles.greeting, { color: theme.home.accent }]}>{greeting()}</Text>
                <Text style={[styles.greetingSub, { color: theme.home.muted }]}>¿Qué deseas leer hoy?</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => setSettingsOpen(true)}
                style={({ pressed }) => [styles.settingsButton, { borderColor: theme.home.panelBorder, backgroundColor: theme.home.panel }, pressed && styles.pressedSoft]}>
                <MaterialIcons name="settings" size={22} color={theme.home.accent} />
              </Pressable>
            </View>

            <Animated.View style={[styles.titleBoardWrap, boardAnimatedStyle]}>
              <View style={styles.titleBoard}>
                <View style={styles.boardWearTop} />
                <View style={styles.boardWearBottom} />
                <View style={styles.boardGrainOne} />
                <View style={styles.boardGrainTwo} />
                <View style={styles.boardScratchLong} />
                <View style={styles.boardKnotLeft} />
                <View style={styles.boardKnotRight} />
                <View style={styles.titleBoardEdge} />
                <View style={styles.boardNailLeft} />
                <View style={styles.boardNailRight} />
                <View style={styles.boardNailLeftCenter} />
                <View style={styles.boardNailRightCenter} />
                <Text style={[styles.title, { color: theme.home.title }]} numberOfLines={1} adjustsFontSizeToFit>BIBLIOTECA DIGITAL</Text>
              </View>
            </Animated.View>
            <Text style={[styles.subtitle, { color: theme.home.text }]}>
              Abre tu estante y elige la versión offline en español que deseas leer.
            </Text>
            <View style={[styles.offlineBadge, { borderColor: theme.home.panelBorder, backgroundColor: theme.home.panel }]}>
              <MaterialIcons name="offline-pin" size={15} color={theme.home.accent} />
              <Text style={[styles.offlineText, { color: theme.home.panelText }]}>Todo disponible sin internet</Text>
            </View>

            {readings.latest && (
              <ContinueReadingCard reading={readings.latest} theme={theme} onPress={() => openReading(readings.latest!)} />
            )}

            <View style={styles.shelf}>
              <View style={styles.shelfBackShade} />
              <View style={styles.shelfTopPlank} />
              <View style={styles.shelfMiddlePlank} />
              <View style={styles.shelfBottomPlank} />
              <View style={styles.shelfPostLeft} />
              <View style={styles.shelfPostRight} />
              <View style={styles.shelfBooksGrid}>
                {SACRED_BOOKS.map((item, index) => (
                  <ShelfTile key={item.id} index={index} label={item.title} onPress={() => onSelectCollection(item)}
                    style={[styles.shelfBook, { backgroundColor: theme.home.tile, borderColor: theme.home.tileBorder }]}>
                    <View style={styles.bookShape}>
                      <View style={[styles.bookSpine, { backgroundColor: item.colors.spine }]} />
                      <View style={[styles.bookCover, { backgroundColor: item.colors.cover }]}>
                        <View style={styles.bookTopBand} />
                        <View style={styles.bookTopBandShade} />
                        <View style={styles.bookShine} />
                        <View style={styles.bookSealOuter}>
                          <View style={styles.bookSealInner}>
                            {item.id === 'nbv' ? <OpenBookIcon size={32} /> : (
                              <Text style={[styles.bookIcon, { color: item.colors.text }, item.id === 'rv1960' && styles.rvCrossIcon]}>
                                {item.icon}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text numberOfLines={1} style={styles.bookMiniTitle}>
                          {item.shortName}
                        </Text>
                        <View style={styles.bookLine} />
                        <View style={styles.bookLineThin} />
                      </View>
                      <View style={styles.bookPages} />
                    </View>
                    <ShelfMeta title={item.title} text={collectionMeta(item.id)} resume={resumeLabel(item.id)} theme={theme} />
                  </ShelfTile>
                ))}

                <ShelfTile index={SACRED_BOOKS.length} label="Leer PDF" onPress={() => router.push('/pdf-library')}
                  style={[styles.shelfBook, { backgroundColor: theme.home.tile, borderColor: theme.home.tileBorder }]}>
                  <View style={styles.pdfDocumentStack}>
                    <View style={[styles.pdfSheet, { transform: [{ translateY: 8 }, { translateX: 8 }] }]} />
                    <View style={[styles.pdfSheet, { transform: [{ translateY: 4 }, { translateX: 4 }] }]} />
                    <View style={[styles.pdfSheet, styles.pdfDocumentContainer]}>
                      <View style={styles.pdfPageMain}>
                        <View style={styles.pdfTextLine} />
                        <View style={[styles.pdfTextLine, { width: '85%' }]} />
                        <View style={[styles.pdfTextLine, { marginTop: 6, width: '90%' }]} />
                        <View style={[styles.pdfTextLine, { width: '80%' }]} />
                      </View>
                      <View style={styles.pdfRibbon}>
                        <Text style={styles.pdfRibbonText}>PDF</Text>
                      </View>
                    </View>
                  </View>
                  <ShelfMeta text={readings.pdfCount > 0 ? readings.pdfCount + (readings.pdfCount === 1 ? ' documento' : ' documentos') : 'Importa tus PDF'}
                    title="Leer PDF" theme={theme} />
                </ShelfTile>
              </View>
            </View>

            <VerseOfDayCard theme={theme} />
          </View>
        )}

        {openedCollection && (
          <View style={[styles.readingBoard, lib?.readingBoard]}>
            <View style={[styles.readingCard, lib?.readingCard, { minHeight: Math.max(height * 0.78, 560) }]}>

              <View style={styles.openedBibleHeader}>
                <View>
                  <Text style={[styles.readingTitle, lib?.readingTitle]}>Biblia abierta</Text>
                  <Text style={[styles.openedBibleName, lib?.openedBibleName]}>
                    {openedCollection.icon} {openedCollection.title}
                  </Text>
                </View>
                  <Pressable style={[styles.backButton, lib?.backButton]} onPress={onCloseCollection}>
                    <IconSymbol name="house.fill" size={38} color={lib ? theme.ui.primaryText : '#F5E8D2'} />
                  </Pressable>
              </View>

              <Text style={[styles.selectorLabel, lib?.selectorLabel]}>Libro</Text>
              {isJewishCollection && (
                <View style={styles.languageToggleWrap}>
                  <Pressable
                    style={[styles.languageToggleButton, lib?.toggle, tanakhLanguage === 'es' && [styles.languageToggleButtonActive, lib?.toggleActive]]}
                    onPress={() => setTanakhLanguage('es')}>
                    <Text style={[styles.languageToggleText, lib?.toggleText, tanakhLanguage === 'es' && [styles.languageToggleTextActive, lib?.toggleTextActive]]}>
                      ES
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.languageToggleButton, lib?.toggle, tanakhLanguage === 'he' && [styles.languageToggleButtonActive, lib?.toggleActive]]}
                    onPress={() => setTanakhLanguage('he')}>
                    <Text style={[styles.languageToggleText, lib?.toggleText, tanakhLanguage === 'he' && [styles.languageToggleTextActive, lib?.toggleTextActive]]}>
                      עברית
                    </Text>
                  </Pressable>
                </View>
              )}
              {isRv1960 && (
                <View style={styles.testamentWrap}>
                  <Pressable
                    style={[styles.testamentButton, lib?.toggle, selectedTestament === 'antiguo' && [styles.testamentButtonActive, lib?.toggleActive]]}
                    onPress={() => {
                      setSelectedTestament('antiguo');
                      setSelectedBook(null);
                      setChapterPanelBook(null);
                    }}>
                    <Text style={[styles.testamentText, lib?.toggleText, selectedTestament === 'antiguo' && [styles.testamentTextActive, lib?.toggleTextActive]]}>
                      Antiguo Testamento
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.testamentButton, lib?.toggle, selectedTestament === 'nuevo' && [styles.testamentButtonActive, lib?.toggleActive]]}
                    onPress={() => {
                      setSelectedTestament('nuevo');
                      setSelectedBook(null);
                      setChapterPanelBook(null);
                    }}>
                    <Text style={[styles.testamentText, lib?.toggleText, selectedTestament === 'nuevo' && [styles.testamentTextActive, lib?.toggleTextActive]]}>
                      Nuevo Testamento
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.bookList}>
                {currentBookItems.map((item, index) => {
                  if (item.type === 'section') {
                    const sectionLabel = getDisplaySectionName(item.label);

                    return (
                      <Text key={`section-${item.label}-${index}`} style={[styles.collectionSectionTitle, lib?.sectionTitle, isHebrewTanakh && styles.collectionSectionTitleHebrew]}>
                        {sectionLabel}
                      </Text>
                    );
                  }

                  if (item.type === 'subsection') {
                    const subsectionLabel = getDisplaySubsectionName(item.label);

                    return (
                      <Text key={`subsection-${item.label}-${index}`} style={[styles.collectionSubsectionTitle, lib?.subsectionTitle, isHebrewTanakh && styles.collectionSubsectionTitleHebrew]}>
                        {subsectionLabel}
                      </Text>
                    );
                  }

                  const isActive = selectedBook === item.book;
                  const itemLabel = isHebrewTanakh ? getDisplayBookName(item.book) : item.label;

                  return (
                    <Pressable
                      key={item.book}
                      style={[styles.bookRow, lib?.bookRow, isActive && [styles.bookRowActive, lib?.toggleActive]]}
                      onPress={() => {
                        setSelectedBook(item.book);
                        setChapterPanelBook(item.book);
                      }}>
                      <Text style={[styles.bookRowText, lib?.bookRowText, isHebrewTanakh && styles.bookRowTextHebrew, isActive && [styles.bookRowTextActive, lib?.toggleTextActive]]}>{itemLabel}</Text>
                      <Text style={[styles.bookRowArrow, lib?.bookRowArrow]}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <AppSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Modal visible={chapterPanelBook !== null} transparent animationType="slide" onRequestClose={() => setChapterPanelBook(null)}>
        <View style={styles.chapterOverlay}>
          <Pressable style={styles.chapterOverlayBg} onPress={() => setChapterPanelBook(null)} />
          <View style={[styles.chapterPanel, lib?.chapterPanel]}>
            <View style={styles.chapterPanelHeader}>
              <View>
                <Text style={[styles.chapterPanelTitle, lib?.readingTitle, isHebrewTanakh && styles.chapterPanelTitleHebrew]}>{chapterPanelBook ? getDisplayBookName(chapterPanelBook) : ''}</Text>
                <Text style={[styles.chapterPanelSub, lib?.chapterPanelSub]}>{getCollectionChapterCount(openedCollection?.id, chapterPanelBook) || '?'} capítulos</Text>
              </View>
              <Pressable style={[styles.chapterCloseBtn, lib?.chapterCloseBtn]} onPress={() => setChapterPanelBook(null)}>
                <Text style={[styles.chapterCloseBtnText, lib?.chapterCloseBtnText]}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.chapterScrollView} contentContainerStyle={styles.chapterGrid} showsVerticalScrollIndicator={false}>
              {Array.from({ length: getCollectionChapterCount(openedCollection?.id, chapterPanelBook) || 1 }, (_, index) => index + 1).map((chapter) => (
                <Pressable key={chapter} style={[styles.chapterChip, lib?.chapterChip]} onPress={() => onSelectChapter(chapter)}>
                  <Text style={[styles.chapterChipText, lib?.chapterChipText]}>{chapter}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4EEE1',
  },
  container: {
    flexGrow: 1,
    padding: 18,
    gap: 16,
  },
  containerOpened: {
    flexGrow: 1,
    padding: 12,
  },
  headerCard: {
    borderRadius: 26,
    padding: 18,
    gap: 16,
    backgroundColor: '#1A2A3A',
    shadowColor: '#111',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 6,
  },
  kicker: {
    alignSelf: 'center',
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '900',
    color: '#D9C19A',
    backgroundColor: '#3B2517',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#160D08',
    textShadowColor: 'rgba(16,8,4,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: 1.5,
    fontWeight: '900',
    color: '#D9C19A',
    textAlign: 'center',
    textShadowColor: 'rgba(20,11,6,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    zIndex: 6,
  },
  titleBoardWrap: {
    marginTop: 0,
    marginHorizontal: 8,
    position: 'relative',
  },
  titleBoard: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 34,
    backgroundColor: '#3B2517',
    borderWidth: 4,
    borderColor: '#160D08',
    shadowColor: '#000',
    shadowOpacity: 0.62,
    shadowOffset: { width: 0, height: 11 },
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 2,
    transform: [{ rotate: '-0.7deg' }],
  },
  boardWearTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(12,6,4,0.5)',
  },
  boardWearBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(8,4,3,0.45)',
  },
  boardGrainOne: {
    position: 'absolute',
    top: 14,
    left: -20,
    right: -20,
    height: 18,
    backgroundColor: 'rgba(112,72,41,0.56)',
    borderRadius: 20,
  },
  boardGrainTwo: {
    position: 'absolute',
    bottom: 18,
    left: -12,
    right: -12,
    height: 14,
    backgroundColor: 'rgba(78,50,30,0.62)',
    borderRadius: 18,
  },
  boardGrainThree: {
    position: 'absolute',
    top: '52%',
    left: -18,
    right: -16,
    height: 9,
    backgroundColor: 'rgba(130,83,49,0.38)',
    borderRadius: 16,
  },
  boardScratchLong: {
    position: 'absolute',
    top: 30,
    left: 56,
    width: 84,
    height: 2,
    backgroundColor: 'rgba(17,10,7,0.78)',
    transform: [{ rotate: '-11deg' }],
  },
  boardScratchShort: {
    position: 'absolute',
    bottom: 26,
    right: 52,
    width: 48,
    height: 2,
    backgroundColor: 'rgba(18,10,7,0.76)',
    transform: [{ rotate: '9deg' }],
  },
  boardKnotLeft: {
    position: 'absolute',
    left: 34,
    top: 24,
    width: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: 'rgba(35,20,11,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(181,132,88,0.28)',
  },
  boardKnotRight: {
    position: 'absolute',
    right: 36,
    bottom: 18,
    width: 16,
    height: 16,
    borderRadius: 99,
    backgroundColor: 'rgba(34,19,11,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(181,132,88,0.24)',
  },
  boardCrackOne: {
    position: 'absolute',
    top: 22,
    right: 70,
    width: 52,
    height: 2,
    backgroundColor: 'rgba(16,8,5,0.7)',
    transform: [{ rotate: '-16deg' }],
  },
  boardCrackTwo: {
    position: 'absolute',
    bottom: 24,
    left: 82,
    width: 36,
    height: 2,
    backgroundColor: 'rgba(16,8,5,0.68)',
    transform: [{ rotate: '14deg' }],
  },
  boardChipLeft: {
    position: 'absolute',
    left: -4,
    top: 46,
    width: 10,
    height: 18,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 7,
    backgroundColor: '#24150D',
  },
  boardChipRight: {
    position: 'absolute',
    right: -4,
    bottom: 34,
    width: 11,
    height: 16,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 6,
    backgroundColor: '#24150D',
  },
  titleBoardEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  boardNailLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: '#3B3A38',
    borderWidth: 2,
    borderColor: '#171717',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  boardNailRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: '#3B3A38',
    borderWidth: 2,
    borderColor: '#171717',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  boardNailLeftRust: {
    position: 'absolute',
    left: 7,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(116,73,38,0.5)',
    backgroundColor: 'rgba(74,44,22,0.2)',
  },
  boardNailRightRust: {
    position: 'absolute',
    right: 7,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(116,73,38,0.5)',
    backgroundColor: 'rgba(74,44,22,0.2)',
  },
  boardNailLeftCenter: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#111111',
  },
  boardNailRightCenter: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#111111',
  },
  boardNailLeftSlot: {
    position: 'absolute',
    left: 11,
    top: '50%',
    marginTop: -1,
    width: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#0F0F0F',
  },
  boardNailRightSlot: {
    position: 'absolute',
    right: 11,
    top: '50%',
    marginTop: -1,
    width: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#0F0F0F',
  },
  subtitle: {
    marginTop: -4,
    fontSize: 15,
    lineHeight: 22,
    color: '#D9E6F2',
    textAlign: 'center',
  },
  shelf: {
    marginTop: 0,
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#2A1C12',
    borderWidth: 2,
    borderColor: '#5A3B26',
    overflow: 'hidden',
    position: 'relative',
  },
  shelfBooksGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    rowGap: 22,
    paddingHorizontal: 6,
    paddingTop: 8,
    zIndex: 2,
  },
  shelfBackShade: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    bottom: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(12,8,5,0.36)',
  },
  shelfTopPlank: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#5D3C26',
    borderWidth: 1,
    borderColor: '#2E1C11',
  },
  shelfMiddlePlank: {
    position: 'absolute',
    top: '51%',
    left: 8,
    right: 8,
    marginTop: -9,
    height: 18,
    borderRadius: 8,
    backgroundColor: '#5A3923',
    borderWidth: 1,
    borderColor: '#2C1A0F',
  },
  shelfBottomPlank: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#5D3C26',
    borderWidth: 1,
    borderColor: '#2E1C11',
  },
  shelfPostLeft: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    width: 16,
    borderRadius: 6,
    backgroundColor: '#4A301E',
    borderWidth: 1,
    borderColor: '#2B1A10',
  },
  shelfPostRight: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    right: 8,
    width: 16,
    borderRadius: 6,
    backgroundColor: '#4A301E',
    borderWidth: 1,
    borderColor: '#2B1A10',
  },
  shelfBook: {
    width: '48%',
    height: 222,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(238,223,196,0.26)',
    backgroundColor: 'rgba(26,18,11,0.44)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
    zIndex: 3,
  },
  bookShape: {
    width: 112,
    height: 122,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bookSpine: {
    width: 15,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  bookCover: {
    flex: 1,
    borderRadius: 8,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  bookTopBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: 'rgba(15,10,7,0.45)',
  },
  bookTopBandShade: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bookShine: {
    position: 'absolute',
    top: -18,
    left: -10,
    width: 34,
    height: 170,
    backgroundColor: 'rgba(255,255,255,0.13)',
    transform: [{ rotate: '12deg' }],
  },
  bookSealOuter: {
    width: 48,
    height: 48,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(246,214,151,0.72)',
    backgroundColor: 'rgba(30,18,9,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 4,
    elevation: 2,
  },
  bookSealInner: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,234,194,0.6)',
    backgroundColor: 'rgba(24,15,8,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIcon: {
    fontSize: 22,
    fontWeight: '900',
  },
  rvCrossIcon: {
    fontSize: 26,
    textShadowColor: '#FDE68A',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  bookMiniTitle: {
    marginTop: 8,
    maxWidth: 72,
    fontSize: 10,
    fontWeight: '900',
    color: '#F7E5C8',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bookLine: {
    marginTop: 7,
    width: 44,
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,233,191,0.56)',
  },
  bookLineThin: {
    marginTop: 4,
    width: 28,
    height: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(255,233,191,0.38)',
  },
  bookPages: {
    width: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#F3EEE4',
    borderWidth: 1,
    borderColor: '#D8CFC1',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingWrap: { flex: 1 },
  greeting: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  greetingSub: { fontSize: 13, marginTop: 2 },
  settingsButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressedSoft: { opacity: 0.7 },
  offlineBadge: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginTop: -6,
  },
  offlineText: { fontSize: 12, fontWeight: '600' },
  shelfPressable: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'space-between' },
  shelfMeta: { alignItems: 'center', gap: 3, minHeight: 52, justifyContent: 'center', paddingHorizontal: 2 },
  shelfDetail: { fontSize: 11, fontWeight: '600', opacity: 0.7, textAlign: 'center' },
  shelfResume: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  shelfName: {
    fontSize: 13,
    textAlign: 'center',
    color: '#F8FAFC',
    fontWeight: '800',
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  readingBoard: {
    borderRadius: 20,
    padding: 10,
    backgroundColor: '#3A2C1E',
    borderWidth: 2,
    borderColor: '#6A4A2F',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  readingCard: {
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#F5E9CF',
    borderWidth: 1,
    borderColor: '#D2BF9A',
    position: 'relative',
  },
  paperStainOne: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 72,
    height: 72,
    borderRadius: 99,
    backgroundColor: 'rgba(165,131,86,0.12)',
  },
  paperStainTwo: {
    position: 'absolute',
    bottom: 40,
    left: 10,
    width: 52,
    height: 52,
    borderRadius: 99,
    backgroundColor: 'rgba(139,110,69,0.1)',
  },
  readingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  openedBibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    marginBottom: 8,
    gap: 10,
  },
  openedBibleName: {
    marginTop: 2,
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  backButton: {
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2E1C10',
    backgroundColor: '#5D3D26',
    position: 'relative',
    overflow: 'hidden',
  },
  backButtonText: {
    color: '#F5E8D2',
    fontWeight: '800',
    fontSize: 12,
    textShadowColor: 'rgba(30,16,8,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  selectorLabel: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  languageToggleWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  languageToggleButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9AC78',
    backgroundColor: '#FFF7E3',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  languageToggleButtonActive: {
    backgroundColor: '#5D3D26',
    borderColor: '#1D4ED8',
  },
  languageToggleText: {
    color: '#5B3A1D',
    fontWeight: '800',
    fontSize: 12,
  },
  languageToggleTextActive: {
    color: '#FFFFFF',
  },
  testamentWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  testamentButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testamentButtonActive: {
    backgroundColor: '#5D3D26',
    borderColor: '#1D4ED8',
  },
  testamentText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 12,
  },
  testamentTextActive: {
    color: '#FFFFFF',
  },
  bookList: {
    gap: 8,
    marginBottom: 4,
  },
  collectionSectionTitle: {
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 4,
    fontSize: 13,
    color: '#5B3A1D',
    fontWeight: '900',
  },
  collectionSectionTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  collectionSubsectionTitle: {
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 6,
    fontSize: 12,
    color: '#7A5B35',
    fontWeight: '800',
  },
  collectionSubsectionTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  bookRow: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: '#D8C7A5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  bookRowActive: {
    backgroundColor: '#5D3D26',
    borderColor: '#1D4ED8',
  },
  bookRowIndex: {
    width: 28,
    fontSize: 13,
    color: '#475569',
    fontWeight: '800',
  },
  bookRowIndexActive: {
    color: '#FFFFFF',
  },
  bookRowText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
  bookRowTextHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  bookRowTextActive: {
    color: '#FFFFFF',
  },
  bookRowArrow: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '300',
  },
  chapterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chapterOverlayBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(30,20,10,0.55)',
  },
  chapterPanel: {
    backgroundColor: '#FDF3DC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#C9AC78',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    maxHeight: '88%',
  },
  chapterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  chapterPanelTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F2937',
  },
  chapterPanelTitleHebrew: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  chapterPanelSub: {
    fontSize: 12,
    color: '#6B5C42',
    marginTop: 2,
    fontWeight: '600',
  },
  chapterCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E8D8B4',
    borderWidth: 1,
    borderColor: '#B89A68',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCloseBtnText: {
    fontSize: 16,
    color: '#5C3D1E',
    fontWeight: '900',
  },
  chapterScrollView: {
    flexShrink: 1,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  chapterChip: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F5E6C0',
    borderWidth: 1,
    borderColor: '#C9AC78',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2C1A08',
  },
  // PDF Document Stack Styles
  pdfDocumentStack: {
    width: 112,
    height: 122,
    marginBottom: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfSheet: {
    position: 'absolute',
    width: 100,
    height: 110,
    backgroundColor: '#F5E6C0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C9AC78',
  },
  pdfDocumentContainer: {
    backgroundColor: '#E8E8E8',
    borderColor: '#BBB',
    zIndex: 10,
    overflow: 'hidden',
  },
  pdfPageMain: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 10,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  pdfTextLine: {
    height: 3,
    backgroundColor: '#4A4A4A',
    borderRadius: 1.5,
    marginBottom: 5,
  },
  pdfPlusCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E53935',
    top: '30%',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
  },
  pdfPlusIcon: {
    color: '#E53935',
    fontWeight: '900',
    fontSize: 32,
  },
  pdfRibbon: {
    backgroundColor: '#E53935',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 4,
  },
  pdfRibbonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  pdfSmallBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 18,
    height: 18,
    backgroundColor: '#2B2B2B',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E53935',
  },
});
