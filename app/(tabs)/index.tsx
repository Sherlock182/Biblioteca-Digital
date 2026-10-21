import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Sheet } from '@/components/ui/sheet';
import { AppSettingsSheet } from '@/components/home/app-settings-sheet';
import { BibleSearch } from '@/components/home/bible-search';
import { BibleCover, PdfStack } from '@/components/home/bible-cover';
import { BookmarksSheet } from '@/components/home/bookmarks-sheet';
import { ContinueReadingCard } from '@/components/home/continue-reading-card';
import { VerseOfDayCard } from '@/components/home/verse-of-day-card';
import { AppTheme, useAppSettings } from '@/constants/app-settings';
import { preloadChapterExtras } from '@/constants/bible-extras';
import { pressFeedback, tapFeedback } from '@/constants/haptics';
import type { Bookmark } from '@/constants/bookmarks';
import { displayBookName, LastReading, LastReadings, loadLastReadings } from '@/constants/reading-history';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    getCollectionChapterCount,
    getCatholicBookList,
    SACRED_BOOKS,
    TANAKH_BOOK_LIST,
    chapterTitle,
    getBooksForCollection,
    hasTestaments,
    preloadCollection,
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

/** "66 libros", counted from the Bible's own book list so a newly added Bible gets it too. */
function collectionMeta(id: string) {
  const oldTestament = getBooksForCollection(id, 'antiguo');
  const newTestament = getBooksForCollection(id, 'nuevo');
  // A Bible without the split (the Catholic one) returns its whole list for both.
  const count = oldTestament === newTestament ? oldTestament.length : oldTestament.length + newTestament.length;
  return count > 0 ? count + ' libros' : '';
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? 'Buenos días, amado hermano' : hour < 19 ? 'Buenas tardes, amado hermano' : 'Buenas noches, amado hermano';
}

// Width of the small books in "Tu biblioteca"; the featured one is drawn larger.
const LIBRARY_BOOK = 84;

/** Two or more options side by side, the chosen one filled with the theme's main color. */
function Segmented<T extends string>({ options, value, onChange, theme }: {
  options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; theme: AppTheme;
}) {
  return <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: theme.ui.soft, borderColor: theme.ui.border }]}>
    {options.map(option => {
      const active = option.id === value;
      return <Pressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected: active }}
        onPress={() => { if (!active) { tapFeedback(); onChange(option.id); } }}
        style={[styles.segment, active && { backgroundColor: theme.ui.primary }]}>
        <Text style={[styles.segmentText, { color: active ? theme.ui.primaryText : theme.ui.text }]} numberOfLines={1}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

/** A square button under the featured Bible (books, listen, bookmarks). */
function FeaturedAction({ icon, label, onPress, theme }: {
  icon: ComponentProps<typeof MaterialIcons>['name']; label: string; onPress: () => void; theme: AppTheme;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tapFeedback(); onPress(); }}
    style={({ pressed }) => [styles.featuredIcon, { borderColor: theme.home.panelBorder, backgroundColor: theme.home.panel }, pressed && styles.pressedSoft]}>
    <MaterialIcons name={icon} size={22} color={theme.home.accent} />
  </Pressable>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Bookmarks are kept per Bible: the sheet opens on the featured one only.
  const [bookmarksFor, setBookmarksFor] = useState<SacredBook | null>(null);
  const openBookmark = (bookmark: Bookmark) => {
    setBookmarksFor(null);
    router.push({
      pathname: '/chapter-reader',
      params: { collectionId: bookmark.collectionId, book: bookmark.book, chapter: String(bookmark.chapter), verse: String(bookmark.verse) },
    });
  };
  const [readings, setReadings] = useState<LastReadings>({ bible: null, latest: null, pdfCount: 0, byCollection: {}, pdf: null });
  // Refresh "continue reading" every time the user comes back to this screen.
  useFocusEffect(useCallback(() => {
    let alive = true;
    void loadLastReadings().then(result => { if (alive) setReadings(result); });
    return () => { alive = false; };
  }, []));
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
  // The search bar has text: its results take the place of the list of books.
  const [searchActive, setSearchActive] = useState(false);
  const [searchKey, setSearchKey] = useState(0);

  // The Bible shown large at the top: the one picked in "Tu biblioteca", else the last one read.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const featured = SACRED_BOOKS.find(item => item.id === (pickedId ?? readings.bible?.collectionId)) ?? SACRED_BOOKS[0];
  const featuredReading = readings.byCollection[featured.id] ?? null;
  // A picked Bible rises into the featured spot.
  const [featureIn] = useState(() => new Animated.Value(1));
  // The featured Bible's cover swings open before its list of books appears.
  const [bookOpening] = useState(() => new Animated.Value(0));
  const opening = useRef(false);
  const playOpening = (value: Animated.Value, then: () => void) => {
    if (opening.current) return;
    opening.current = true;
    pressFeedback();
    Animated.timing(value, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      // The open book stays a moment on screen before the next screen appears.
      setTimeout(() => {
        then();
        // Closed again once the next screen covers this one, ready for the way back.
        setTimeout(() => { value.setValue(0); opening.current = false; }, 350);
      }, 250);
    });
  };
  // The featured Bible's text loads quietly while the home screen is idle, so "Continuar" opens its
  // chapter without a wait and nothing runs during the cover's animation.
  useEffect(() => {
    const id = featured.id;
    // After the screen has settled (and not during a pick's animation, which ends well before this).
    const timer = setTimeout(() => { preloadCollection(id); preloadChapterExtras(id); }, 1500);
    return () => clearTimeout(timer);
  }, [featured.id]);
  const openFeatured = () => playOpening(bookOpening, () => onSelectCollection(featured));
  const pickBible = (item: SacredBook) => {
    tapFeedback();
    setPickedId(item.id);
    featureIn.setValue(0);
    Animated.spring(featureIn, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
  };
  // Reads aloud where this Bible was left (or from its first chapter).
  const listenFeatured = () => {
    const book = featuredReading?.book ?? getBooksForCollection(featured.id, 'antiguo')[0];
    if (!book) return;
    router.push({
      pathname: '/chapter-reader',
      params: { collectionId: featured.id, book, chapter: String(featuredReading?.chapter ?? 1), autoplay: '1' },
    });
  };

  // Bibles organized in Old / New Testament.
  const isRv1960 = hasTestaments(openedCollection?.id);
  const isJewishCollection = openedCollection?.id === 'jewish';
  const isHebrewTanakh = isJewishCollection && tanakhLanguage === 'he';

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

  const currentBookItems = useMemo(() => {
    if (!openedCollection) {
      return [] as CollectionBookListItem[];
    }

    if (openedCollection.id === 'jewish') {
      return TANAKH_BOOK_LIST;
    }

    if (openedCollection.id === 'catolica') {
      return getCatholicBookList(selectedTestament);
    }

    return getBooksForCollection(openedCollection.id, isRv1960 ? selectedTestament : 'antiguo').map((book) => ({
      type: 'book' as const,
      label: book,
      book,
    }));
  }, [isRv1960, openedCollection, selectedTestament]);

  const onSelectCollection = (item: SacredBook) => {
    setOpenedCollection(item);
    setSearchActive(false);
    setSelectedBook(null);
    setChapterPanelBook(null);
    setTanakhLanguage('es');
    if (hasTestaments(item.id)) {
      setSelectedTestament('antiguo');
    }
  };

  const onCloseCollection = () => {
    setOpenedCollection(null);
    setSelectedBook(null);
    setChapterPanelBook(null);
  };

  // While the list of books is on screen, the Bible's text loads in the background, so the chapter
  // picked next opens without a wait.
  useEffect(() => {
    if (!openedCollection) return;
    const id = openedCollection.id;
    const timer = setTimeout(() => { preloadCollection(id); preloadChapterExtras(id); }, 500);
    return () => clearTimeout(timer);
  }, [openedCollection]);

  // Android back button with a Bible open: go back to the shelf instead of leaving the app.
  // With text in the search bar, the first press clears the search (a new key remounts the bar empty).
  useFocusEffect(useCallback(() => {
    if (!openedCollection) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchActive) {
        setSearchKey(key => key + 1);
        setSearchActive(false);
        return true;
      }
      setOpenedCollection(null);
      setSelectedBook(null);
      setChapterPanelBook(null);
      return true;
    });
    return () => subscription.remove();
  }, [openedCollection, searchActive]));

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          openedCollection ? styles.containerOpened : styles.container,
          { paddingBottom: Math.max(14, insets.bottom + 10) },
        ]}>
        {!openedCollection && (
          <View style={[styles.headerCard, { backgroundColor: theme.home.card }]}>
            <View style={styles.topBar}>
              <View style={styles.greetingWrap}>
                <Text style={[styles.greeting, { color: theme.home.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{greeting()}</Text>
                <Text style={[styles.greetingSub, { color: theme.home.muted }]}>¿Qué deseas leer hoy?</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => setSettingsOpen(true)}
                style={({ pressed }) => [styles.settingsButton, { borderColor: theme.home.panelBorder }, pressed && styles.pressedSoft]}>
                <MaterialIcons name="tune" size={22} color={theme.home.accent} />
              </Pressable>
            </View>

            <View style={[styles.featured, { backgroundColor: theme.home.feature ?? theme.home.panel, borderColor: theme.home.panelBorder }]}>
              {/* Soft light in the featured Bible's own color, behind the book. */}
              <View pointerEvents="none" style={[styles.featuredGlow, { backgroundColor: featured.colors.cover }]} />
              <Text style={[styles.featuredKicker, { color: theme.home.accent }]}>
                {featuredReading ? 'CONTINUAR LEYENDO' : 'BIBLIA SELECCIONADA'}
              </Text>
              <Animated.View style={{
                opacity: featureIn.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [
                  { translateY: featureIn.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
                  { scale: featureIn.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              }}>
                {/* Only a picture: the buttons below open the Bible, and its cover swings open here. */}
                <Animated.View accessible accessibilityLabel={featured.title}
                  style={{ transform: [{ scale: bookOpening.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
                  <BibleCover book={featured} width={150} opening={bookOpening} />
                </Animated.View>
              </Animated.View>
              <View style={styles.featuredText}>
                <Text style={[styles.featuredTitle, { color: theme.home.panelText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {featuredReading ? chapterTitle(featured.id, featuredReading.book, featuredReading.chapter) : featured.title}
                </Text>
                <Text style={[styles.featuredDetail, { color: theme.home.muted }]} numberOfLines={1}>
                  {featuredReading ? featured.title + ' · ' + collectionMeta(featured.id) : collectionMeta(featured.id)}
                </Text>
              </View>
              <View style={styles.featuredActions}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={featuredReading ? 'Continuar leyendo ' + chapterTitle(featured.id, featuredReading.book, featuredReading.chapter) : 'Abrir la ' + featured.title}
                  onPress={() => featuredReading ? playOpening(bookOpening, () => openReading(featuredReading)) : openFeatured()}
                  style={({ pressed }) => [styles.featuredPrimary, { backgroundColor: theme.home.accent }, pressed && styles.pressedSoft]}>
                  <MaterialIcons name={featuredReading ? 'play-arrow' : 'menu-book'} size={22} color={theme.home.card} />
                  <Text style={[styles.featuredPrimaryText, { color: theme.home.card }]}>{featuredReading ? 'Continuar' : 'Abrir'}</Text>
                </Pressable>
                {featuredReading && <FeaturedAction icon="format-list-bulleted" label={'Libros de la ' + featured.title}
                  onPress={openFeatured} theme={theme} />}
                <FeaturedAction icon="headphones" label={'Escuchar la ' + featured.title} onPress={listenFeatured} theme={theme} />
                <FeaturedAction icon="bookmarks" label={'Marcadores de la ' + featured.title} onPress={() => setBookmarksFor(featured)} theme={theme} />
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.home.text }]}>Tu biblioteca</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroll} contentContainerStyle={styles.libraryRow}>
              {SACRED_BOOKS.filter(item => item.id !== featured.id).map(item => {
                const reading = readings.byCollection[item.id];
                return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Elegir la ' + item.title} onPress={() => pickBible(item)}
                  style={({ pressed }) => [styles.libraryItem, pressed && styles.pressedBook]}>
                  <BibleCover book={item} width={LIBRARY_BOOK} />
                  <Text style={[styles.libraryName, { color: theme.home.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {item.title.replace(/^Biblia /, '')}
                  </Text>
                  <Text style={[styles.libraryDetail, { color: theme.home.muted }]} numberOfLines={1}>{collectionMeta(item.id)}</Text>
                  {reading && <View style={styles.libraryResume}>
                    <MaterialIcons name="play-arrow" size={14} color={theme.home.accent} />
                    <Text style={[styles.libraryDetail, { color: theme.home.accent }]} numberOfLines={1}>
                      {chapterTitle(item.id, reading.book, reading.chapter)}
                    </Text>
                  </View>}
                </Pressable>;
              })}
              <Pressable accessibilityRole="button" accessibilityLabel="Mis documentos PDF" onPress={() => { tapFeedback(); router.push('/pdf-library'); }}
                style={({ pressed }) => [styles.libraryItem, pressed && styles.pressedBook]}>
                <PdfStack width={LIBRARY_BOOK} />
                <Text style={[styles.libraryName, { color: theme.home.text }]} numberOfLines={2}>Mis PDF</Text>
                <Text style={[styles.libraryDetail, { color: theme.home.muted }]} numberOfLines={1}>
                  {readings.pdfCount > 0 ? readings.pdfCount + (readings.pdfCount === 1 ? ' documento' : ' documentos') : 'Importa tus PDF'}
                </Text>
              </Pressable>
              {/* Room for the Bibles still to come. */}
              <View style={styles.libraryItem}>
                <View style={[styles.comingSoon, { borderColor: theme.home.panelBorder }]}>
                  <MaterialIcons name="add" size={26} color={theme.home.muted} />
                </View>
                <Text style={[styles.libraryName, { color: theme.home.muted }]} numberOfLines={2}>Más Biblias</Text>
                <Text style={[styles.libraryDetail, { color: theme.home.muted }]} numberOfLines={1}>Pronto</Text>
              </View>
            </ScrollView>

            {/* The PDF keeps its own "continue reading", like each Bible, even after a Bible is read. */}
            {readings.pdf && (
              <ContinueReadingCard reading={readings.pdf} theme={theme} onPress={() => openReading(readings.pdf!)} />
            )}

            <VerseOfDayCard theme={theme} />
          </View>
        )}

        {openedCollection && (
          <View style={styles.opened}>
            <View style={styles.openedBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Volver al inicio" onPress={() => { tapFeedback(); onCloseCollection(); }}
                style={({ pressed }) => [styles.openedBack, { backgroundColor: theme.home.panel, borderColor: theme.home.panelBorder }, pressed && styles.pressedSoft]}>
                <MaterialIcons name="arrow-back" size={22} color={theme.home.accent} />
              </Pressable>
              <View style={styles.openedHeading}>
                <Text style={[styles.openedKicker, { color: theme.home.accent }]}>{collectionMeta(openedCollection.id).toUpperCase()}</Text>
                <Text style={[styles.openedTitle, { color: theme.home.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {openedCollection.title}
                </Text>
              </View>
              <BibleCover book={openedCollection} width={40} />
            </View>

            <View style={[styles.openedSheet, { backgroundColor: theme.ui.page, minHeight: Math.max(height * 0.8, 560) }]}>
              <BibleSearch key={openedCollection.id + searchKey} collectionId={openedCollection.id} theme={theme}
                onActiveChange={setSearchActive} onPickBook={(book) => setChapterPanelBook(book)}
                onOpenVerse={(book, chapter, verse) => router.push({
                  pathname: '/chapter-reader',
                  params: { collectionId: openedCollection.id, book, chapter: String(chapter), ...(verse ? { verse: String(verse) } : {}) },
                })} />

              {!searchActive && <>
                {isJewishCollection && (
                  <Segmented theme={theme} value={tanakhLanguage} onChange={setTanakhLanguage}
                    options={[{ id: 'es', label: 'Español' }, { id: 'he', label: 'עברית' }]} />
                )}
                {isRv1960 && (
                  <Segmented theme={theme} value={selectedTestament} onChange={testament => {
                    setSelectedTestament(testament);
                    setSelectedBook(null);
                    setChapterPanelBook(null);
                  }} options={[{ id: 'antiguo', label: 'Antiguo Testamento' }, { id: 'nuevo', label: 'Nuevo Testamento' }]} />
                )}

                <View style={styles.bookList}>
                  {currentBookItems.map((item, index) => {
                    if (item.type === 'section') {
                      return (
                        <Text key={`section-${item.label}-${index}`} style={[styles.collectionSectionTitle, { color: theme.ui.accent }, isHebrewTanakh && styles.collectionSectionTitleHebrew]}>
                          {getDisplaySectionName(item.label)}
                        </Text>
                      );
                    }

                    if (item.type === 'subsection') {
                      return (
                        <Text key={`subsection-${item.label}-${index}`} style={[styles.collectionSubsectionTitle, { color: theme.ui.muted }, isHebrewTanakh && styles.collectionSubsectionTitleHebrew]}>
                          {getDisplaySubsectionName(item.label)}
                        </Text>
                      );
                    }

                    const isActive = selectedBook === item.book;
                    const itemLabel = isHebrewTanakh ? getDisplayBookName(item.book) : displayBookName(item.label);
                    const chapters = getCollectionChapterCount(openedCollection.id, item.book);
                    const textColor = isActive ? theme.ui.primaryText : theme.ui.text;

                    return (
                      <Pressable
                        key={item.book}
                        accessibilityRole="button"
                        accessibilityLabel={itemLabel + (chapters ? ', ' + chapters + ' capítulos' : '')}
                        style={({ pressed }) => [
                          styles.bookRow,
                          { backgroundColor: theme.ui.card, borderColor: theme.ui.border },
                          isActive && { backgroundColor: theme.ui.primary, borderColor: theme.ui.primary },
                          pressed && styles.pressedSoft,
                        ]}
                        onPress={() => {
                          tapFeedback();
                          setSelectedBook(item.book);
                          setChapterPanelBook(item.book);
                        }}>
                        <Text style={[styles.bookRowText, { color: textColor }, isHebrewTanakh && styles.bookRowTextHebrew]}>{itemLabel}</Text>
                        {chapters > 0 && <Text style={[styles.bookRowCount, { color: isActive ? theme.ui.primaryText : theme.ui.muted }]}>{chapters} cap.</Text>}
                        <MaterialIcons name="chevron-right" size={22} color={isActive ? theme.ui.primaryText : theme.ui.muted} />
                      </Pressable>
                    );
                  })}
                </View>
              </>}
            </View>
          </View>
        )}
      </ScrollView>

      <AppSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BookmarksSheet visible={bookmarksFor !== null} only={bookmarksFor} onClose={() => setBookmarksFor(null)} onOpen={openBookmark} />

      <Sheet visible={chapterPanelBook !== null} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={() => setChapterPanelBook(null)}>
        <View style={styles.chapterOverlay}>
          <Pressable style={styles.chapterOverlayBg} accessibilityLabel="Cerrar capítulos" onPress={() => setChapterPanelBook(null)} />
          {/* The sheet reaches the bottom edge: keep the last row above the phone's navigation buttons. */}
          <View style={[styles.chapterPanel, { backgroundColor: theme.ui.page, borderColor: theme.ui.border, paddingBottom: Math.max(20, insets.bottom + 16) }]}>
            <View style={[styles.chapterHandle, { backgroundColor: theme.ui.border }]} />
            <View style={styles.chapterPanelHeader}>
              <View style={styles.chapterPanelHeading}>
                <Text style={[styles.chapterPanelTitle, { color: theme.ui.text }, isHebrewTanakh && styles.chapterPanelTitleHebrew]}>{chapterPanelBook ? getDisplayBookName(chapterPanelBook) : ''}</Text>
                <Text style={[styles.chapterPanelSub, { color: theme.ui.muted }]}>{getCollectionChapterCount(openedCollection?.id, chapterPanelBook) || '?'} capítulos · elige uno</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={6} onPress={() => setChapterPanelBook(null)}
                style={({ pressed }) => [styles.chapterClose, { backgroundColor: theme.ui.soft }, pressed && styles.pressedSoft]}>
                <MaterialIcons name="close" size={20} color={theme.ui.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.chapterScrollView} contentContainerStyle={styles.chapterGrid} showsVerticalScrollIndicator={false}>
              {Array.from({ length: getCollectionChapterCount(openedCollection?.id, chapterPanelBook) || 1 }, (_, index) => index + 1).map((chapter) => {
                // The chapter last read in this book stands out, so it is easy to pick up again.
                const lastRead = openedCollection && readings.byCollection[openedCollection.id];
                const current = !!lastRead && lastRead.book === chapterPanelBook && lastRead.chapter === chapter;
                return <Pressable key={chapter} accessibilityRole="button" accessibilityLabel={'Capítulo ' + chapter + (current ? ', último leído' : '')}
                  onPress={() => { tapFeedback(); onSelectChapter(chapter); }}
                  style={({ pressed }) => [
                    styles.chapterChip,
                    { backgroundColor: theme.ui.card, borderColor: theme.ui.border },
                    current && { backgroundColor: theme.ui.primary, borderColor: theme.ui.primary },
                    pressed && styles.pressedSoft,
                  ]}>
                  <Text style={[styles.chapterChipText, { color: current ? theme.ui.primaryText : theme.ui.text }]}>{chapter}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4EEE1',
  },
  // On tablets the home screen and the book list keep a phone-like width, centered.
  container: {
    flexGrow: 1,
    gap: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  containerOpened: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  // The home screen is one continuous surface in the theme's color (no card edge or shadow).
  headerCard: {
    flexGrow: 1,
    padding: 18,
    gap: 16,
    backgroundColor: '#1A2A3A',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingWrap: { flex: 1 },
  greeting: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  greetingSub: { fontSize: 13, marginTop: 2 },
  // A shade darker than the background in every theme, so the button stands out.
  settingsButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  pressedSoft: { opacity: 0.7 },
  pressedBook: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  featured: { borderRadius: 24, borderWidth: 1, padding: 18, paddingTop: 16, alignItems: 'center', gap: 14, overflow: 'hidden' },
  featuredGlow: { position: 'absolute', top: 16, width: 260, height: 260, borderRadius: 130, opacity: 0.35 },
  featuredKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  featuredText: { alignItems: 'center', gap: 2, alignSelf: 'stretch' },
  featuredTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  featuredDetail: { fontSize: 13, textAlign: 'center' },
  featuredActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  featuredPrimary: { flex: 1, minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  featuredPrimaryText: { fontSize: 15, fontWeight: '800' },
  featuredIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: -4 },
  // The row runs to the card's edges while scrolling, and starts aligned with the content.
  libraryScroll: { marginHorizontal: -18 },
  libraryRow: { paddingHorizontal: 18, gap: 14, paddingBottom: 2 },
  // Wide enough for the longest word of a name ("Contemporánea", "Internacional") on one line.
  libraryItem: { width: 104, alignItems: 'center', gap: 6 },
  libraryName: { fontSize: 11.5, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  libraryDetail: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  libraryResume: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: -2 },
  comingSoon: {
    width: LIBRARY_BOOK, height: LIBRARY_BOOK * 122 / 112, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  // Opened Bible: a bar in the theme's color, then the list on a sheet of the theme's paper.
  opened: { flexGrow: 1 },
  openedBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  openedBack: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  openedHeading: { flex: 1, gap: 2 },
  openedKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  openedTitle: { fontSize: 20, fontWeight: '800' },
  openedSheet: { flexGrow: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingTop: 20 },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  segment: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentText: { fontSize: 13, fontWeight: '700' },
  bookList: { gap: 8, marginBottom: 4 },
  collectionSectionTitle: { marginTop: 10, marginBottom: 2, paddingHorizontal: 4, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  collectionSectionTitleHebrew: { writingDirection: 'rtl', textAlign: 'right' },
  collectionSubsectionTitle: { marginTop: 6, marginBottom: 2, paddingHorizontal: 6, fontSize: 12, fontWeight: '700' },
  collectionSubsectionTitleHebrew: { writingDirection: 'rtl', textAlign: 'right' },
  bookRow: { minHeight: 52, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8, gap: 8 },
  bookRowText: { flex: 1, fontSize: 15, fontWeight: '700' },
  bookRowTextHebrew: { writingDirection: 'rtl', textAlign: 'right' },
  bookRowCount: { fontSize: 12, fontWeight: '600' },
  chapterOverlay: { flex: 1, justifyContent: 'flex-end' },
  chapterOverlayBg: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  chapterPanel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: 10, paddingHorizontal: 16, maxHeight: '88%' },
  chapterHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  chapterPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  chapterPanelHeading: { flex: 1 },
  chapterPanelTitle: { fontSize: 20, fontWeight: '800' },
  chapterPanelTitleHebrew: { writingDirection: 'rtl', textAlign: 'right' },
  chapterPanelSub: { fontSize: 13, marginTop: 2 },
  chapterClose: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chapterScrollView: { flexShrink: 1 },
  chapterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  chapterChip: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chapterChipText: { fontSize: 16, fontWeight: '700' },
});
