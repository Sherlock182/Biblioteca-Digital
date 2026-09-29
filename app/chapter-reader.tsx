import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppTheme, useAppSettings } from '@/constants/app-settings';
import { saveBibleReading } from '@/constants/reading-history';

import {
    CATHOLIC_BOOK_LIST,
    COLLECTION_CREDITS,
    TANAKH_BOOK_LIST,
    fetchChapterContent,
    getBooksForCollection,
    getCollectionChapterCount,
    getCollectionById,
    type ChapterContent,
    type CollectionBookListItem,
    type TanakhLanguage,
    type TestamentType,
} from '@/constants/scripture';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  const readingKey = JSON.stringify([params.collectionId, params.book, params.chapter, params.tanakhLanguage]);
  return <ChapterReaderContent key={readingKey} />;
}

/** The reader's styles recolored for the chosen theme; the classic theme is the original design. */
function themeReaderStyles(theme: AppTheme): typeof baseStyles {
  if (theme.id === 'clasico') return baseStyles;
  const ui = theme.ui;
  const onHeader = { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.24)' };
  const overrides: Partial<Record<keyof typeof baseStyles, object>> = {
    bookSelectorButton: onHeader, chapterBadge: onHeader, backButtonInline: onHeader,
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
  const highlightsRef = useRef<{ [key: string]: number[] }>({});

  // Validar parámetros - TODOS deben estar presentes y válidos
  const isValidChapter = collectionId && book && typeof chapterValue === 'number' && chapterValue > 0;
  const highlightStorageKey = isValidChapter ? `highlights_${collectionId}_${book}_${chapterValue}` : '';

  // Helper: Cargar datos del storage (AsyncStorage -> localStorage)
  const loadFromStorage = useCallback(async (key: string): Promise<string | null> => {
    if (!key) {
      console.warn('⚠️ Intento de cargar con clave vacía');
      return null;
    }

    try {
      let value: string | null = null;

      if (Platform.OS === 'web') {
        // WEB: localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            value = window.localStorage.getItem(key) || null;
            if (value) {
              console.log(`📂 [localStorage/Web] Cargado: ${key}`);
            }
          } catch (e) {
            console.warn(`⚠️ Error en localStorage:`, e);
          }
        }
      } else {
        // NATIVO: AsyncStorage
        try {
          const asyncValue = await AsyncStorage.getItem(key);
          value = asyncValue || null;
          if (value) {
            console.log(`📂 [AsyncStorage/Mobile] Cargado: ${key}`);
          }
        } catch (asyncStorageError) {
          console.warn(`⚠️ Error en AsyncStorage:`, asyncStorageError);
        }
      }

      return value;
    } catch (e) {
      console.error(`❌ Error fatal en loadFromStorage(${key}):`, e);
      return null;
    }
  }, []);

  // Helper: Guardar datos en storage (AsyncStorage -> localStorage)
  const saveToStorage = useCallback(async (key: string, value: string): Promise<void> => {
    if (!key || !value) {
      console.warn(`⚠️ Intento de guardar con parámetros inválidos: key="${key}", value="${value?.substring(0, 20)}..."`);
      return;
    }

    try {
      let savedSuccessfully = false;

      if (Platform.OS === 'web') {
        // WEB: localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(key, value);
            console.log(`✅ [localStorage/Web] Guardado: ${key} = ${value.substring(0, 50)}...`);
            savedSuccessfully = true;
          } catch (e) {
            console.error(`❌ localStorage.setItem fallo para ${key}:`, e);
          }
        }
      } else {
        // NATIVO: AsyncStorage
        try {
          await AsyncStorage.setItem(key, value);
          console.log(`✅ [AsyncStorage/Mobile] Guardado: ${key} = ${value.substring(0, 50)}...`);
          savedSuccessfully = true;
        } catch (asyncStorageError) {
          console.error(`❌ AsyncStorage error:`, asyncStorageError);
        }

        if (!savedSuccessfully) {
          console.error(`❌ CRÍTICO: No se pudo guardar ${key} en AsyncStorage`);
        }
      }
    } catch (e) {
      console.error(`❌ Error fatal en saveToStorage(${key}):`, e);
    }
  }, []);

  // ============ CARGAR HIGHLIGHTS AL CAMBIAR CAPÍTULO ============
  useEffect(() => {
    if (!highlightStorageKey) {
      console.log('🔄 highlightStorageKey vacía, limpiando highlights...');
      return;
    }

    const loadHighlightsForChapter = () => {
      console.log(`🔄 Iniciando carga de highlights para: ${highlightStorageKey}`);

        (async () => {
          try {
            const rawData = await loadFromStorage(highlightStorageKey);
          
            if (!rawData) {
              console.log(`ℹ️ No hay datos en storage para ${highlightStorageKey}, inicializando vacío`);
              setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: [] }));
              return;
            }

            // Intentar parsear
            let parsed: number[];
            try {
              parsed = JSON.parse(rawData);
            } catch (parseErr) {
              console.error(`❌ Error al parsear JSON para ${highlightStorageKey}:`, parseErr);
              console.log(`   Valor raw: "${rawData}"`);
              setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: [] }));
              return;
            }

            // Validar que es un array de números
            if (!Array.isArray(parsed)) {
              console.warn(`⚠ Datos no son un array para ${highlightStorageKey}, reiniciando`);
              setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: [] }));
              return;
            }

            // Validar que son todos números
            const validNumbers = parsed.every((n) => typeof n === 'number' && n > 0);
            if (!validNumbers) {
              console.warn(`⚠ Array contiene valores no válidos para ${highlightStorageKey}`, parsed);
              const cleaned = parsed.filter((n) => typeof n === 'number' && n > 0);
              setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: cleaned }));
              return;
            }

            // ✅ Éxito
            console.log(`✅ Highlights cargados correctamente: ${highlightStorageKey} = [${parsed.join(', ')}]`);
            setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: parsed }));
            highlightsRef.current[highlightStorageKey] = parsed;
          } catch (error) {
            console.error(`❌ Error inesperado cargando highlights de ${highlightStorageKey}:`, error);
            setHighlightedVerses((prev) => ({ ...prev, [highlightStorageKey]: [] }));
          }
        })();
    };

    loadHighlightsForChapter();
  }, [highlightStorageKey, loadFromStorage]);

  // ============ GUARDAR HIGHLIGHTS ============
  const saveHighlights = (verses: number[]): Promise<void> => {
    return new Promise((resolve) => {
      if (!highlightStorageKey) {
        console.warn('⚠ Cannot save highlights: invalid storage key');
        resolve();
        return;
      }

      try {
        // 1. Actualizar estado INMEDIATAMENTE (síncrono)
        setHighlightedVerses((prev) => {
          const updated = { ...prev, [highlightStorageKey]: verses };
          console.log(`📝 State actualizado para ${highlightStorageKey}: ${verses.length} versículos`);
          return updated;
        });

        // 2. Guardar en storage DE FORMA SÍNCRONA
        saveToStorage(highlightStorageKey, JSON.stringify(verses));
        
        // 3. Actualizar ref para acceso inmediato
        highlightsRef.current[highlightStorageKey] = verses;

        console.log(`✅ Highlights guardados permanentemente: ${highlightStorageKey} = [${verses.join(', ')}]`);
        resolve();
      } catch (e) {
        console.error('❌ Error en saveHighlights:', e);
        resolve();
      }
    });
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
    };
  }, [settings.textScale, theme]);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerBook, setChapterPickerBook] = useState<string | null>(null);
  const [chapterPickerFromHeader, setChapterPickerFromHeader] = useState(false);
  const [bookPickerTestament, setBookPickerTestament] = useState<TestamentType>('antiguo');
  const [tanakhLanguage, setTanakhLanguage] = useState<TanakhLanguage>(tanakhLanguageParam === 'he' ? 'he' : 'es');

  // Bibles organized in Old / New Testament.
  const isRv1960 = collection?.id === 'rv1960' || collection?.id === 'nbv';
  const isJewishCollection = collection?.id === 'jewish';
  const isCompactCollection = collection?.id === 'jewish' || collection?.id === 'catolica';
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
      return CATHOLIC_BOOK_LIST;
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
  const [optionsVerseNumber, setOptionsVerseNumber] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<number[]>([]);

  const selectedVerseSet = useMemo(() => new Set(selectedVerseNumbers), [selectedVerseNumbers]);

  const activeVerseNumbers = useMemo(() => {
    if (optionsVerseNumber !== null && selectedVerseSet.has(optionsVerseNumber) && selectedVerseNumbers.length > 0) {
      return selectedVerseNumbers;
    }

    if (optionsVerseNumber !== null) {
      return [optionsVerseNumber];
    }

    return selectedVerseNumbers;
  }, [optionsVerseNumber, selectedVerseNumbers, selectedVerseSet]);

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

  const getSortedVerseNumbers = (verseNumbers: number[]) => [...verseNumbers].sort((left, right) => left - right);

  const buildCitationReference = (verseNumbers: number[]) => {
    const sortedVerseNumbers = getSortedVerseNumbers(verseNumbers);
    if (sortedVerseNumbers.length === 0) {
      return '';
    }

    const startVerse = sortedVerseNumbers[0];
    const endVerse = sortedVerseNumbers[sortedVerseNumbers.length - 1];

    const displayBook = getDisplayBookName(book);

    return startVerse === endVerse
      ? `${displayBook} ${chapterValue}:${startVerse}`
      : `${displayBook} ${chapterValue}:${startVerse}-${endVerse}`;
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
      quran: 'El Coran',
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
        return verse ? `*${verse.number}.* ${verse.text}` : null;
      })
      .filter(Boolean)
      .join('\n'); // Espacios más cerrados entre versículos

    const header = `*${versionLabel}*\n${reference}`;
    return verseLines ? `${header}\n\n${verseLines}` : header;
  };

  const onLongPressVerse = (verseNumber: number) => {
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
    // Importante: Aquí NO limpiamos los datos, solo salimos del modo
    // Los highlights ya se guardan automáticamente en cada click
    console.log(`✅ Saliendo del modo marcador - ${highlightedVerses[highlightStorageKey]?.length || 0} versículos marcados`);
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

    const sortedVerseNumbers = getSortedVerseNumbers(selectedVerseNumbers);
    if (sortedVerseNumbers.length === 0) {
      setSelectedVerseNumbers([verseNumber]);
      return;
    }

    const minVerse = sortedVerseNumbers[0];
    const maxVerse = sortedVerseNumbers[sortedVerseNumbers.length - 1];

    if (selectedVerseSet.has(verseNumber)) {
      const remainingVerses = sortedVerseNumbers.filter((item) => item !== verseNumber);

      if (remainingVerses.length === 0) {
        setSelectedVerseNumbers([]);
        setSelectionMode(false);
        return;
      }

      const isStillContiguous = remainingVerses.every((item, index) => index === 0 || item === remainingVerses[index - 1] + 1);
      if (isStillContiguous) {
        setSelectedVerseNumbers(remainingVerses);
        return;
      }

      const lowerBlock = remainingVerses.filter((item) => item < verseNumber);
      const upperBlock = remainingVerses.filter((item) => item > verseNumber);

      setSelectedVerseNumbers(lowerBlock.length >= upperBlock.length ? lowerBlock : upperBlock);

      return;
    }

    if (verseNumber === minVerse - 1 || verseNumber === maxVerse + 1) {
      setSelectedVerseNumbers(getSortedVerseNumbers([...sortedVerseNumbers, verseNumber]));
      return;
    }

    Alert.alert('Seleccion consecutiva', 'Solo puedes marcar versiculos consecutivos en orden ascendente o descendente.');
  };

  const onCopySelection = async () => {
    const payload = buildCitationText(activeVerseNumbers);
    if (!payload) {
      return;
    }

    await Clipboard.setStringAsync(payload);
    setOptionsOpen(false);
    setOptionsVerseNumber(null);
    setSelectionMode(false);
    setSelectedVerseNumbers([]);
    Alert.alert('Copiado', 'La cita biblica completa se copio al portapapeles.');
  };

  const onShareToWhatsApp = async () => {
    const payload = buildCitationText(activeVerseNumbers);
    if (!payload) {
      return;
    }

    try {
      await Clipboard.setStringAsync(payload);
    } catch (e) {
      console.warn('Error copying to clipboard:', e);
    }

    const encodedPayload = encodeURIComponent(payload);
    const nativeUrl = `whatsapp://send?text=${encodedPayload}`;
    const webUrl = `https://wa.me/?text=${encodedPayload}`;

    try {
      let canOpen = false;
      try {
        if (Platform.OS !== 'web') {
          canOpen = await Linking.canOpenURL(nativeUrl);
        }
      } catch {
        canOpen = false;
      }

      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }

      setOptionsOpen(false);
      setOptionsVerseNumber(null);
      setSelectionMode(false);
      setSelectedVerseNumbers([]);
    } catch (e) {
      console.warn('Error opening WhatsApp:', e);
      Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp en este dispositivo.');
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
        <View style={styles.headerTextWrap}>
          <Text style={styles.collectionLabel}>{collection?.title ?? 'Lectura'}</Text>
          <View style={styles.chapterTitleRow}>
            <Pressable style={[styles.bookSelectorButton, isCompactCollection && styles.bookSelectorButtonCompact]} onPress={() => setBookPickerOpen(true)}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.chapterTitle, isCompactCollection && styles.chapterTitleCompact, isHebrewTanakh && styles.chapterTitleHebrew]}>
                {getDisplayBookName(book)} ▾
              </Text>
            </Pressable>
            <Pressable style={styles.chapterBadge} onPress={() => setChapterPickerFromHeader(true)}>
              <Text style={styles.chapterBadgeText}>Cap. {chapterValue > 0 ? chapterValue : '-'} ▾</Text>
            </Pressable>
            <View style={styles.chapterTitleSpacer} />
            <Pressable style={styles.backButtonInline} onPress={() => router.back()}>
              <Text style={styles.backButtonInlineText}>Regresar</Text>
            </Pressable>
          </View>
          <Text style={styles.chapterMeta}>
            {chapterCount > 0 ? `${chapterCount} capitulos en este libro` : 'Capitulo seleccionado'}
          </Text>
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
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, themed.page, { paddingBottom: Math.max(24, insets.bottom + 14) }]}
        showsVerticalScrollIndicator={false}>
        {chapterContent.heading ? <Text style={[styles.heading, themed.heading, isHebrewTanakh && styles.headingHebrew, isHebrewTanakh && themed.headingHebrew]}>{chapterContent.heading}</Text> : null}

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
            <Text style={styles.loadingText}>Cargando versiculos...</Text>
          </View>
        ) : chapterContent.verses.length > 0 ? (
          chapterContent.verses.map((verse) => (
            <Pressable
              key={verse.number}
              style={[
                styles.verseRow,
                isHebrewTanakh && styles.verseRowHebrew,
                selectedVerseSet.has(verse.number) && [styles.verseRowSelected, themed.selected],
                (highlightedVerses[highlightStorageKey] || []).includes(verse.number) && [styles.verseRowHighlighted, themed.highlighted],
              ]}
              onLongPress={() => onLongPressVerse(verse.number)}
              onPress={() => {
                if (highlightMode) {
                  if (!highlightStorageKey) {
                    console.warn('⚠ No se puede marcar: highlightStorageKey inválida');
                    return;
                  }

                  const current = highlightedVerses[highlightStorageKey] || [];
                  let updated: number[];

                  if (current.includes(verse.number)) {
                    // Desmarcar: filtrar el versículo
                    updated = current.filter((v) => v !== verse.number);
                    console.log(`🔴 Desmarcando: ${verse.number} | Antes: [${current.join(', ')}] | Después: [${updated.join(', ')}]`);
                  } else {
                    // Marcar: agregar el versículo
                    updated = [...current, verse.number].sort((a, b) => a - b);
                    console.log(`🟢 Marcando: ${verse.number} | Antes: [${current.join(', ')}] | Después: [${updated.join(', ')}]`);
                  }

                  // Guardar y actualizar
                  saveHighlights(updated).catch((err) => {
                    console.error('❌ Error al guardar highlights:', err);
                  });
                }

                if (selectionMode) {
                  onPressVerse(verse.number);
                }
              }}
              delayLongPress={280}>
              <Text style={[styles.verseNumber, themed.verseNumber, verse.label ? styles.verseNumberRange : null, isHebrewTanakh && styles.verseNumberHebrew]}>{verse.label ?? verse.number}</Text>
              <Text style={[
                styles.verseText,
                themed.verseText,
                isHebrewTanakh && [styles.verseTextHebrew, themed.verseTextHebrew],
                selectedVerseSet.has(verse.number) && [styles.verseTextSelected, themed.markedText],
                (highlightedVerses[highlightStorageKey] || []).includes(verse.number) && [styles.verseTextHighlighted, themed.markedText],
              ]}>{verse.text}</Text>
            </Pressable>
          ))
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

      <Modal visible={bookPickerOpen} transparent animationType="slide" onRequestClose={() => setBookPickerOpen(false)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setBookPickerOpen(false)} />
          <View style={[styles.panelCard, isCompactCollection && styles.panelCardCompact]}>
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

            <ScrollView contentContainerStyle={styles.panelBookList} showsVerticalScrollIndicator={false}>
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

                const itemLabel = isHebrewTanakh ? getDisplayBookName(item.book) : item.label;

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
      </Modal>

      <Modal visible={chapterPickerBook !== null || chapterPickerFromHeader} transparent animationType="slide" onRequestClose={() => {
        setChapterPickerBook(null);
        setChapterPickerFromHeader(false);
      }}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => {
            setChapterPickerBook(null);
            setChapterPickerFromHeader(false);
          }} />
          <View style={styles.panelCard}>
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

            <ScrollView contentContainerStyle={styles.chapterGrid} showsVerticalScrollIndicator={false}>
              {Array.from({ length: getCollectionChapterCount(collectionId, chapterPickerFromHeader ? book : (chapterPickerBook ?? '')) || 1 }, (_, idx) => idx + 1).map((chapter) => (
                <Pressable key={chapter} style={[styles.chapterChip, chapter === chapterValue && styles.chapterChipActive]} onPress={() => onSelectChapterFromPanel(chapter)}>
                  <Text style={[styles.chapterChipText, chapter === chapterValue && styles.chapterChipTextActive]}>{chapter}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setOptionsOpen(false)} />
          <View style={styles.optionsCard}>
            {/* MODO SELECCIÓN DE VERSÍCULOS */}
            {selectionMode && selectedVerseNumbers.length > 0 ? (
              <>
                <Text style={styles.optionsTitle}>Versículos seleccionados: {selectedVerseNumbers.length}</Text>
                <Pressable style={styles.optionsButton} onPress={onCopySelection}>
                  <Text style={styles.optionsButtonText}>Copiar texto completo</Text>
                </Pressable>
                <Pressable style={styles.optionsButton} onPress={onShareToWhatsApp}>
                  <Text style={styles.optionsButtonText}>Compartir por WhatsApp</Text>
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
                <Text style={styles.optionsTitle}>Opciones del versículo</Text>
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
                      if (typeof optionsVerseNumber !== 'number') {
                        console.error('❌ optionsVerseNumber no es un número válido');
                        return;
                      }

                      if (!highlightStorageKey) {
                        console.error('❌ highlightStorageKey está vacía');
                        return;
                      }

                      const current = highlightedVerses[highlightStorageKey] || [];
                      const updated = current.filter((v: number) => v !== optionsVerseNumber);

                      console.log(`🔴 Desmarcando desde menú: versículo ${optionsVerseNumber}`);
                      console.log(`   Antes: [${current.join(', ')}]`);
                      console.log(`   Después: [${updated.join(', ')}]`);

                      // Guardar los cambios
                      saveHighlights(updated)
                        .then(() => {
                          console.log('✅ Versículo desmarcado y guardado');
                          setOptionsOpen(false);
                          setOptionsVerseNumber(null);
                        })
                        .catch((err) => {
                          console.error('❌ Error al desmarcar:', err);
                        });
                    }}>
                    <Text style={styles.optionsButtonText}>Desmarcar este versículo</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    minHeight: 108,
    borderBottomWidth: 1,
    borderBottomColor: '#6A4325',
    backgroundColor: '#2F1E12',
    gap: 12,
  },
  headerTextWrap: {
    gap: 4,
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2F1E12',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#5C3E24',
  },
  chapterTitleSpacer: {
    flex: 1,
  },
  backButtonInline: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#6A4325',
    borderWidth: 1,
    borderColor: '#8A5A33',
  },
  backButtonInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F6EFD2',
  },
  bookSelectorButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#6A4325',
    borderWidth: 1,
    borderColor: '#8A5A33',
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '70%',
  },
  bookSelectorButtonCompact: {
    maxWidth: '62%',
  },
  collectionLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#D9C7A8',
    fontWeight: '700',
  },
  chapterTitle: {
    fontSize: 16,
    lineHeight: 26,
    color: '#F6EFD2',
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
  },
  chapterTitleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  chapterTitleHebrew: {
    writingDirection: 'rtl',
    // ...existing code...
    letterSpacing: 0.2,
  },
  chapterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#8A5A33',
    backgroundColor: '#6A4325',
  },
  chapterBadgeText: {
    fontSize: 13,
    color: '#F6EFD2',
    fontWeight: '700',
  },
  chapterMeta: {
    fontSize: 13,
    color: '#D9C7A8',
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
  optionsButton: {
    borderRadius: 12,
    backgroundColor: '#6A4325',
    borderWidth: 1,
    borderColor: '#8A5A33',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    paddingBottom: 8,
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
