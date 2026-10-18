import { PDFBookmark } from '@/constants/pdf-books';
import { PDFLibraryService } from '@/constants/pdf-library-service';
import { AppTheme, mergeStyles, ThemeId, useAppSettings } from '@/constants/app-settings';
import { buildSpeechQueue, prepareSpeech } from '@/constants/pdf-speech-text';
import { ReaderAudio } from '@/modules/reader-audio';
import { loadSpanishVoices, loadSpeechSettings, saveSpeechSettings, speakWithFallback } from '@/constants/speech-engine';
import { DEFAULT_SPEECH_SETTINGS, pickVoice, SpeechSettings } from '@/constants/speech-voices';
import { VoiceSettingsSheet } from '@/components/voice-settings-sheet';
import { getLocalFileSize, MAX_PDF_BYTES, resolveOwnedPDFUri } from '@/constants/pdf-storage-service';
import { isViewerNavigation, loadPDFViewerSource, PDFViewerSource, sendPDFData } from '@/constants/pdf-webview-bridge';
import { readFileAsBase64Safe } from '@/constants/safe-file-reader';
import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Alert, AppState, DimensionValue, PermissionsAndroid, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const RATES = [0.75, 1, 1.25, 1.5, 2];
// Stop looking for readable text after this many consecutive image-only pages.
const MAX_SKIPPED_PAGES = 15;
const PARAGRAPH_PAUSE_MS = 350;
const MAX_UTTERANCE_CHARS = 400;
const VOICE_FALLBACK_NOTICE = 'La voz elegida no respondió; se usa la voz predeterminada del teléfono. Puedes cambiarla en «Voz».';

/** A reading handed to the native background service (APK only). */
type BackgroundReading = { session: number; started: boolean; chain: Promise<void> };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const utteranceLimit = () => Number.isFinite(Speech.maxSpeechInputLength)
  ? Math.min(MAX_UTTERANCE_CHARS, Math.max(32, Speech.maxSpeechInputLength - 32)) : MAX_UTTERANCE_CHARS;

function Button({ title, onPress, disabled = false, primary = false }: {
  title: string; onPress: () => void; disabled?: boolean; primary?: boolean;
}) {
  const { styles } = readerTheme(useAppSettings().theme);
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primary, (disabled || pressed) && styles.dimmed]}>
    <Text style={[styles.buttonText, primary && styles.primaryText]}>{title}</Text>
  </Pressable>;
}

const CLASSIC_DOCUMENT_BACKGROUND = '#E9E3D9';
const readerStylesCache = new Map<ThemeId, { styles: typeof baseStyles; icon: string; spinner: string; onPrimary: string; documentBackground: string }>();

/** Reader chrome colors for the chosen theme (the PDF page itself stays white); cached per theme. */
function readerTheme(theme: AppTheme) {
  const cached = readerStylesCache.get(theme.id);
  if (cached) return cached;
  const ui = theme.ui;
  const documentBackground = theme.id === 'clasico' ? CLASSIC_DOCUMENT_BACKGROUND : theme.id === 'noche' ? '#0B0C10' : ui.soft;
  const value = theme.id === 'clasico'
    ? { styles: baseStyles, icon: '#4A3625', spinner: '#79583C', onPrimary: '#FFF', documentBackground }
    : {
      icon: ui.text, spinner: ui.accent, onPrimary: ui.primaryText, documentBackground,
      styles: mergeStyles(baseStyles, {
        screen: { backgroundColor: ui.page }, eyebrow: { color: ui.accent }, title: { color: ui.text },
        progress: { backgroundColor: ui.border }, progressFill: { backgroundColor: ui.accent },
        document: { backgroundColor: documentBackground }, webview: { backgroundColor: documentBackground },
        loading: { backgroundColor: ui.page }, errorTitle: { color: ui.text }, message: { color: ui.muted },
        footer: { backgroundColor: ui.card },
        pagePill: { backgroundColor: ui.soft, borderColor: ui.border },
        pageInput: { backgroundColor: ui.card, color: ui.text, borderColor: ui.border },
        pageTotal: { color: ui.muted }, goButton: { backgroundColor: ui.primary }, goText: { color: ui.primaryText },
        segment: { backgroundColor: ui.soft, borderColor: ui.border }, divider: { backgroundColor: ui.border },
        control: { backgroundColor: ui.soft, borderColor: ui.border }, controlPressed: { backgroundColor: ui.border },
        controlText: { color: ui.text },
        listen: { backgroundColor: ui.primary, shadowColor: ui.primary }, listenActive: { backgroundColor: ui.danger, shadowColor: ui.danger },
        listenText: { color: ui.primaryText },
        button: { backgroundColor: ui.soft }, buttonText: { color: ui.text },
        primary: { backgroundColor: ui.primary }, primaryText: { color: ui.primaryText },
        notice: { backgroundColor: ui.notice }, noticeText: { color: ui.noticeText },
      }),
    };
  readerStylesCache.set(theme.id, value);
  return value;
}

/** Footer control: a soft pill, or a flat cell when it lives inside a segmented group. */
function Control({ label, icon, iconAfter = false, iconOnly = false, flat = false, disabled = false, onPress, style }: {
  label: string; icon?: keyof typeof MaterialIcons.glyphMap; iconAfter?: boolean; iconOnly?: boolean; flat?: boolean;
  disabled?: boolean; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { styles, icon: iconColor } = readerTheme(useAppSettings().theme);
  const glyph = icon ? <MaterialIcons name={icon} size={iconOnly ? 22 : 20} color={iconColor} /> : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.control, flat && styles.controlFlat, style, pressed && styles.controlPressed, disabled && styles.dimmed]}>
    {!iconAfter && glyph}
    {!iconOnly && <Text style={styles.controlText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>}
    {iconAfter && glyph}
  </Pressable>;
}

export default function PDFReader() {
  const router = useRouter();
  const { theme: appTheme } = useAppSettings();
  const { styles, spinner, onPrimary, documentBackground } = readerTheme(appTheme);
  const params = useLocalSearchParams<{ bookmarkId?: string | string[] }>();
  const id = Array.isArray(params.bookmarkId) ? params.bookmarkId[0] : params.bookmarkId;
  const [book, setBook] = useState<PDFBookmark | null>(null);
  const [source, setSource] = useState<PDFViewerSource | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'opening' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [transfer, setTransfer] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(1);
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(DEFAULT_SPEECH_SETTINGS);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState('');
  const viewer = useRef<WebView>(null);
  const data = useRef('');
  const initialPage = useRef(1);
  const injected = useRef(false);
  const speechSession = useRef(0);
  const skipped = useRef({ total: 0, streak: 0 });
  const mounted = useRef(true);
  const totalRef = useRef(0);
  const pageRef = useRef(1);
  const settingsRef = useRef<SpeechSettings>(DEFAULT_SPEECH_SETTINGS);
  const voiceBroken = useRef(false);
  const voicesChecked = useRef(false);
  const attemptRef = useRef(0);
  const titleRef = useRef('');
  const background = useRef<BackgroundReading | null>(null);
  const backgroundBroken = useRef(false);
  const inject = useCallback((script: string) => {
    viewer.current?.injectJavaScript(script + ';true;');
  }, []);
  const stopBackground = useCallback(() => {
    if (!background.current) return;
    background.current = null;
    inject('window.cancelPageTexts()');
    void ReaderAudio?.stop().catch(() => undefined);
  }, [inject]);
  const stopSpeech = useCallback(() => {
    speechSession.current += 1;
    if (mounted.current) setSpeaking(false);
    stopBackground();
    return Speech.stop().catch(() => undefined);
  }, [stopBackground]);
  // Shows the page the background reader is on, and saves it even if the viewer is asleep.
  const followBackgroundPage = useCallback((number: number) => {
    if (!Number.isInteger(number) || number < 1) return;
    if (number !== pageRef.current) inject('window.goToPage(' + number + ')');
    if (id && totalRef.current) void PDFLibraryService.updateProgress(id, number, totalRef.current).catch(() => undefined);
  }, [id, inject]);
  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => {
      // Background reading is meant to survive this; plain reading cannot.
      if (state !== 'active' && !background.current) { stopSpeech(); return; }
      if (state === 'active' && background.current && ReaderAudio) {
        void ReaderAudio.getState().then(current => {
          if (!mounted.current || !background.current) return;
          if (current.active && current.page) followBackgroundPage(current.page);
          else if (!current.active && background.current.started) { background.current = null; setSpeaking(false); }
        }).catch(() => undefined);
      }
    });
    return () => {
      mounted.current = false;
      speechSession.current += 1;
      void Speech.stop().catch(() => undefined);
      if (background.current) { background.current = null; void ReaderAudio?.stop().catch(() => undefined); }
      listener.remove();
    };
  }, [followBackgroundPage, stopSpeech]);
  useEffect(() => {
    const audio = ReaderAudio;
    if (!audio) return;
    const mine = (session: number) => background.current?.session === session;
    const subscriptions = [
      audio.addListener('onProgress', event => { if (mine(event.session)) followBackgroundPage(event.page); }),
      audio.addListener('onState', event => {
        if (!mine(event.session)) return;
        if (event.stopped) { background.current = null; speechSession.current += 1; setSpeaking(false); }
        else setSpeaking(event.playing);
      }),
      audio.addListener('onFinished', event => { if (mine(event.session)) setNotice('Has terminado de escuchar el documento.'); }),
      audio.addListener('onError', event => { if (background.current) setNotice(event.message); }),
      audio.addListener('onVoiceFallback', () => { if (background.current) setNotice(VOICE_FALLBACK_NOTICE); }),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [followBackgroundPage]);
  useEffect(() => {
    void loadSpeechSettings().then(saved => {
      if (!mounted.current) return;
      settingsRef.current = saved; setSpeechSettings(saved);
    });
  }, []);
  useEffect(() => {
    let cancelled = false;
    attemptRef.current = attempt;
    // This effect starts a new external file/WebView session when the document or retry changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading'); setError(''); setSource(null); setNotice(''); setTransfer(0);
    setZoom(1); injected.current = false; stopSpeech();
    const timeout = setTimeout(() => {
      if (!cancelled) { cancelled = true; setError('La preparación del documento tardó demasiado. Vuelve a intentarlo.'); setStatus('error'); }
    }, 45000);
    void (async () => {
      if (Platform.OS === 'web') throw new Error('Abre este lector en Expo Go para Android o iPhone.');
      if (!id) throw new Error('Selecciona un documento desde tu biblioteca.');
      const saved = await PDFLibraryService.getBook(id);
      if (!saved) throw new Error('Este documento ya no está en tu biblioteca.');
      const fileUri = resolveOwnedPDFUri(saved.fileUri);
      const size = await getLocalFileSize(fileUri);
      if (size !== null && size > MAX_PDF_BYTES) throw new Error('Este documento supera 40 MB. Importa una copia más pequeña.');
      const [base64, viewerSource] = await Promise.all([readFileAsBase64Safe(fileUri), loadPDFViewerSource()]);
      if (cancelled) return;
      initialPage.current = Number.isInteger(saved.currentPage) && saved.currentPage > 0 ? saved.currentPage : 1;
      data.current = base64;
      pageRef.current = initialPage.current;
      titleRef.current = saved.displayName;
      setBook(saved); setPage(initialPage.current); setPageInput(String(initialPage.current));
      setTotal(saved.totalPages || 0); totalRef.current = saved.totalPages || 0;
      setSource(viewerSource); setStatus('opening');
    })().catch(cause => {
      if (!cancelled) { setError(errorText(cause)); setStatus('error'); }
    }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [id, attempt, stopSpeech]);
  useEffect(() => {
    if (status !== 'opening') return;
    const timer = setTimeout(() => {
      setError('El documento no respondió. Puedes reintentar o seleccionar otro archivo.');
      setStatus('error');
    }, 90000);
    return () => clearTimeout(timer);
  }, [status]);
  const requestSpeech = useCallback((number: number, session: number) => {
    inject('window.requestPageText(' + number + ',' + session + ')');
  }, [inject]);
  const finishSpeech = useCallback((message: string) => {
    stopSpeech(); setNotice(message);
  }, [stopSpeech]);
  const readText = useCallback(async (text: string, number: number, session: number) => {
    if (session !== speechSession.current || !mounted.current) return;
    const paragraphs = prepareSpeech(text, utteranceLimit());
    const last = number >= totalRef.current;
    if (!paragraphs.length) {
      skipped.current.total += 1; skipped.current.streak += 1;
      if (skipped.current.streak >= MAX_SKIPPED_PAGES) {
        finishSpeech('No se encontró texto en las siguientes ' + MAX_SKIPPED_PAGES + ' páginas; parecen ser imágenes.');
      } else if (last) {
        finishSpeech(skipped.current.total > 1 ? 'Fin del documento. Se omitieron ' + skipped.current.total + ' páginas sin texto.' : 'Esta página no contiene texto que se pueda leer.');
      } else {
        setNotice('Página ' + number + ' sin texto (imagen): se omite.');
        requestSpeech(number + 1, session);
      }
      return;
    }
    skipped.current.streak = 0;
    const alive = () => session === speechSession.current && mounted.current;
    try {
      for (let p = 0; p < paragraphs.length; p++) {
        // A short silence between paragraphs, like a human reader.
        if (p > 0) { await new Promise(resolve => setTimeout(resolve, PARAGRAPH_PAUSE_MS)); }
        for (const sentence of paragraphs[p]) {
          if (!alive()) return;
          const { voiceId, rate, pitch } = settingsRef.current;
          const fellBack = await speakWithFallback(sentence, { voiceId: voiceBroken.current ? null : voiceId, rate, pitch, isActive: alive });
          if (fellBack && !voiceBroken.current && alive()) {
            voiceBroken.current = true;
            setNotice(VOICE_FALLBACK_NOTICE);
          }
        }
      }
      if (session !== speechSession.current || !mounted.current) return;
      if (!last) requestSpeech(number + 1, session);
      else finishSpeech('Has terminado de escuchar el documento.');
    } catch (cause) {
      if (session !== speechSession.current || !mounted.current) return;
      finishSpeech('No se pudo iniciar la voz: ' + errorText(cause));
    }
  }, [finishSpeech, requestSpeech]);
  const startSpeech = useCallback(async (from: number) => {
    const stopping = stopSpeech();
    const session = speechSession.current;
    skipped.current = { total: 0, streak: 0 };
    setSpeaking(true); setNotice('');
    await stopping;
    if (!voicesChecked.current) {
      // First time: make sure the saved voice still exists and warn if Spanish is missing.
      voicesChecked.current = true;
      const voices = await loadSpanishVoices();
      if (!voices.length) setNotice('Tu teléfono no tiene voz en español instalada. Toca «Voz» para descargar una gratis.');
      const chosen = pickVoice(voices, settingsRef.current.voiceId);
      settingsRef.current = { ...settingsRef.current, voiceId: chosen?.identifier ?? null };
    }
    if (!mounted.current || session !== speechSession.current) return;
    if (settingsRef.current.background && ReaderAudio && !backgroundBroken.current) {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        // Without it the reading still works, only the notification controls are hidden.
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => undefined);
        if (!mounted.current || session !== speechSession.current) return;
      }
      // The whole remaining text goes to the native service, which keeps reading with the screen off.
      background.current = { session, started: false, chain: Promise.resolve() };
      inject('window.requestPageTexts(' + from + ',' + totalRef.current + ',' + session + ')');
      return;
    }
    requestSpeech(from, session);
  }, [inject, requestSpeech, stopSpeech]);
  const receivePageTexts = useCallback((pages: { page: number; text: string }[], done: boolean) => {
    const reading = background.current;
    const audio = ReaderAudio;
    if (!reading || !audio) return;
    const batch = { ...buildSpeechQueue(pages, utteranceLimit()), complete: done };
    // Batches must reach the service in order, and only after it has started.
    reading.chain = reading.chain.then(async () => {
      if (background.current !== reading) return;
      if (reading.started) { await audio.append(reading.session, batch); return; }
      if (!batch.texts.length) {
        if (done) finishSpeech('No hay texto que se pueda leer desde esta página.');
        return;
      }
      const { voiceId, rate, pitch } = settingsRef.current;
      await audio.start({ session: reading.session, title: titleRef.current, voiceId, rate, pitch }, batch);
      reading.started = true;
    }).catch(cause => {
      if (background.current !== reading) return;
      // The service could not start on this phone: fall back to reading with the app open.
      backgroundBroken.current = true;
      background.current = null;
      inject('window.cancelPageTexts()');
      // It may have started and failed later: silence it so the two voices never overlap.
      void audio.stop().catch(() => undefined);
      setNotice('No se pudo leer en segundo plano (' + errorText(cause) + '). Se leerá con la app abierta.');
      requestSpeech(pages[0]?.page ?? pageRef.current, reading.session);
    });
  }, [finishSpeech, inject, requestSpeech]);
  const go = useCallback((number: number) => {
    const count = totalRef.current;
    if (!Number.isInteger(number) || number < 1 || number > count) {
      Alert.alert('Página no válida', 'Escribe un número entre 1 y ' + count + '.'); return;
    }
    stopSpeech(); setNotice(''); inject('window.goToPage(' + number + ')');
  }, [inject, stopSpeech]);
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let message;
    try { message = JSON.parse(event.nativeEvent.data); } catch { setNotice('El visor no pudo procesar una respuesta.'); return; }
    if (message.type === 'VIEWER_READY' && !injected.current) {
      injected.current = true;
      const session = attemptRef.current;
      void sendPDFData(inject, data.current, fraction => { if (mounted.current) setTransfer(fraction); },
        () => !mounted.current || attemptRef.current !== session)
        .then(sent => { if (sent) inject('window.openPDF(' + initialPage.current + ')'); });
    } else if (message.type === 'PDF_READY') {
      data.current = '';
      setStatus('ready');
    } else if (message.type === 'PAGE_CHANGED' && Number.isInteger(message.page) &&
      Number.isInteger(message.totalPages) && message.page > 0 && message.page <= message.totalPages) {
      pageRef.current = message.page;
      setPage(message.page); setPageInput(String(message.page));
      setTotal(message.totalPages); totalRef.current = message.totalPages;
      if (Number.isFinite(message.zoom)) setZoom(message.zoom);
      if (id) void PDFLibraryService.updateProgress(id, message.page, message.totalPages).catch(() => {
        if (mounted.current) setNotice('No se pudo guardar la última página. Puedes continuar leyendo.');
      });
    } else if (message.type === 'PAGE_ERROR') {
      setNotice('La página ' + message.page + ' está dañada y no se puede mostrar. Puedes seguir con las demás.');
    } else if (message.type === 'SWIPE' && (message.direction === 1 || message.direction === -1)) {
      const next = pageRef.current + message.direction;
      if (next >= 1 && next <= totalRef.current) go(next);
    } else if (message.type === 'PAGE_TEXTS' && background.current?.session === message.requestId && Array.isArray(message.pages)) {
      receivePageTexts(message.pages, !!message.done);
    } else if (message.type === 'PAGE_TEXT' && message.requestId === speechSession.current && typeof message.text === 'string') {
      void readText(message.text, message.page, message.requestId);
    } else if (message.type === 'SPEECH_ERROR' && message.requestId === speechSession.current) {
      finishSpeech(String(message.error));
    } else if (message.type === 'PDF_ERROR') {
      stopSpeech(); data.current = ''; setError(String(message.error)); setStatus('error');
    }
  }, [finishSpeech, go, id, inject, readText, receivePageTexts, stopSpeech]);
  const changeZoom = (value: number) => {
    const next = Math.max(0.5, Math.min(3, value));
    setZoom(next); inject('window.setPDFZoom(' + next + ')');
  };
  const updateSpeechSettings = (next: SpeechSettings, restart: boolean) => {
    settingsRef.current = next; setSpeechSettings(next);
    voiceBroken.current = false;
    void saveSpeechSettings(next);
    if (restart && speaking) void startSpeech(pageRef.current);
  };
  const changeRate = () => {
    // The sheet allows in-between values (1.75×): jump to the next preset above the current one.
    const next = RATES.find(value => value > speechSettings.rate + 0.001) ?? RATES[0];
    updateSpeechSettings({ ...speechSettings, rate: next }, true);
  };
  const openVoiceSheet = () => { stopSpeech(); setVoiceSheet(true); };
  const toggleSpeech = () => {
    if (speaking) stopSpeech();
    else void startSpeech(page);
  };
  // The area around the page inside the viewer follows the theme too.
  useEffect(() => {
    if (status !== 'ready') return;
    inject("document.documentElement.style.background=document.body.style.background='" + documentBackground + "'");
  }, [documentBackground, inject, status]);
  const ready = status === 'ready';
  const back = () => { stopSpeech(); router.back(); };
  const progressWidth = ((total ? page / total * 100 : 0) + '%') as DimensionValue;
  const loadingMessage = status === 'loading' ? 'Preparando tu documento…'
    : transfer > 0 && transfer < 1 ? 'Cargando documento… ' + Math.round(transfer * 100) + '%' : 'Abriendo la página…';
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <StatusBar style={appTheme.ui.statusBar} />
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Button title="‹ Biblioteca" onPress={back} />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>LECTURA PERSONAL</Text>
          <Text style={styles.title} numberOfLines={1}>{book?.displayName || 'Documento PDF'}</Text>
        </View>
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: progressWidth }]} /></View>
      <View style={styles.document}>
        {status === 'error' ? <View style={styles.center}>
          <Text style={styles.errorTitle}>No pudimos abrir el documento</Text>
          <Text style={styles.message}>{error}</Text>
          <Button title="Volver a intentar" primary onPress={() => setAttempt(value => value + 1)} />
          <Button title="Volver a la biblioteca" onPress={back} />
        </View> : <>
          {source && <WebView key={attempt} ref={viewer} source={source} onMessage={onMessage}
            originWhitelist={['*']} javaScriptEnabled bounces={false} setBuiltInZoomControls={false}
            onShouldStartLoadWithRequest={request => isViewerNavigation(request.url)}
            onError={event => { setError(event.nativeEvent.description); setStatus('error'); }}
            onRenderProcessGone={() => { stopSpeech(); setError('Android cerró el visor para liberar memoria. Intenta abrirlo de nuevo.'); setStatus('error'); }}
            onContentProcessDidTerminate={() => { stopSpeech(); setError('El visor se cerró. Vuelve a intentarlo.'); setStatus('error'); }}
            style={styles.webview} />}
          {!ready && <View style={styles.loading}>
            <ActivityIndicator size="large" color={spinner} />
            <Text style={styles.message}>{loadingMessage}</Text>
          </View>}
        </>}
      </View>
      {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={() => setNotice('')} style={styles.notice}><Text style={styles.noticeText}>{notice}  ×</Text></Pressable>}
      <View style={styles.footer}>
        <View style={styles.navRow}>
          <Control label="Anterior" icon="chevron-left" disabled={!ready || page <= 1} onPress={() => go(page - 1)} style={styles.navButton} />
          <View style={styles.pagePill}>
            <TextInput accessibilityLabel="Número de página" value={pageInput} onChangeText={setPageInput}
              onSubmitEditing={() => go(Number(pageInput))} keyboardType="number-pad" returnKeyType="go"
              selectTextOnFocus editable={ready} style={styles.pageInput} maxLength={6} />
            <Text style={styles.pageTotal}>de {total || '—'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Ir a la página" disabled={!ready} onPress={() => go(Number(pageInput))}
              style={({ pressed }) => [styles.goButton, (!ready || pressed) && styles.dimmed]}>
              <Text style={styles.goText}>Ir</Text>
            </Pressable>
          </View>
          <Control label="Siguiente" icon="chevron-right" iconAfter disabled={!ready || page >= total} onPress={() => go(page + 1)} style={styles.navButton} />
        </View>
        <View style={styles.toolRow}>
          <View style={[styles.segment, styles.zoomSegment]}>
            <Control icon="remove" label="Reducir zoom" iconOnly flat disabled={!ready || zoom <= 0.5} onPress={() => changeZoom(zoom - 0.25)} style={styles.segmentIcon} />
            <View style={styles.divider} />
            <Control label={Math.round(zoom * 100) + '% · Ajustar'} flat disabled={!ready} onPress={() => changeZoom(1)} style={styles.segmentMain} />
            <View style={styles.divider} />
            <Control icon="add" label="Aumentar zoom" iconOnly flat disabled={!ready || zoom >= 3} onPress={() => changeZoom(zoom + 0.25)} style={styles.segmentIcon} />
          </View>
          <View style={styles.segment}>
            <Control icon="record-voice-over" label="Voz" flat disabled={!ready} onPress={openVoiceSheet} style={styles.segmentItem} />
            <View style={styles.divider} />
            <Control label={speechSettings.rate + '×'} flat disabled={!ready} onPress={changeRate} style={styles.segmentItem} />
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Detener' : 'Escuchar'} accessibilityState={{ disabled: !ready }}
          disabled={!ready} onPress={toggleSpeech}
          style={({ pressed }) => [styles.listen, speaking && styles.listenActive, (!ready || pressed) && styles.dimmed]}>
          <MaterialIcons name={speaking ? 'stop' : 'play-arrow'} size={24} color={onPrimary} />
          <Text style={styles.listenText}>{speaking ? 'Detener' : 'Escuchar'}</Text>
        </Pressable>
      </View>
      <VoiceSettingsSheet visible={voiceSheet} settings={speechSettings}
        onChange={next => updateSpeechSettings(next, false)} onClose={() => setVoiceSheet(false)} />
    </SafeAreaView>
  </>;
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F3EB' },
  header: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1 }, eyebrow: { color: '#876B50', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#30271F', fontSize: 17, fontWeight: '700', marginTop: 4 },
  progress: { height: 3, backgroundColor: '#E5DCCF' }, progressFill: { height: 3, backgroundColor: '#99713E' },
  document: { flex: 1, backgroundColor: '#E9E3D9' }, webview: { flex: 1, backgroundColor: '#E9E3D9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3EB' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#30271F', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 23, color: '#6C5D4E', textAlign: 'center', marginVertical: 14 },
  footer: {
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, gap: 12, backgroundColor: '#FFFDF9',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#3B2A1A', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navButton: { flex: 1 },
  pagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, paddingLeft: 4,
    backgroundColor: '#F3ECE1', borderRadius: 14, borderWidth: 1, borderColor: '#E6DBCB',
  },
  pageInput: {
    width: 46, height: 38, borderRadius: 10, backgroundColor: '#FFF', textAlign: 'center',
    color: '#30271F', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#DDD1BF', padding: 0,
  },
  pageTotal: { color: '#7A6754', fontSize: 13, fontWeight: '500' },
  goButton: { height: 38, minWidth: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#65482F', alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  segment: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3ECE1', borderRadius: 14,
    borderWidth: 1, borderColor: '#E6DBCB', padding: 3,
  },
  zoomSegment: { flex: 1 },
  segmentIcon: { width: 40 },
  segmentMain: { flex: 1, paddingHorizontal: 6 },
  segmentItem: { paddingHorizontal: 12 },
  divider: { width: 1, height: 22, backgroundColor: '#DDD0BD' },
  control: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F3ECE1', borderWidth: 1, borderColor: '#E6DBCB',
  },
  controlFlat: { minHeight: 40, backgroundColor: 'transparent', borderWidth: 0, borderRadius: 11 },
  controlPressed: { backgroundColor: '#E8DCCB' },
  controlText: { color: '#4A3625', fontSize: 14, fontWeight: '600' },
  listen: {
    height: 52, borderRadius: 16, backgroundColor: '#65482F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#65482F', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  listenActive: { backgroundColor: '#8E5447', shadowColor: '#8E5447' },
  listenText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EBE3D6', borderRadius: 12 },
  buttonText: { color: '#493725', fontSize: 13, fontWeight: '600' },
  primary: { backgroundColor: '#65482F' }, primaryText: { color: '#FFF' }, dimmed: { opacity: 0.4 },
  notice: { backgroundColor: '#FFF0CD', padding: 12 }, noticeText: { color: '#65482F', fontSize: 13, lineHeight: 19 },
});

