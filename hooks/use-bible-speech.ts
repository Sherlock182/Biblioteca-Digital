import { buildSpeechQueue, prepareSpeech } from '@/constants/pdf-speech-text';
import { displayBookName } from '@/constants/reading-history';
import { fetchChapterContent, spokenChapterTitle } from '@/constants/scripture';
import { loadSpanishVoices, loadSpeechSettings, speakWithFallback } from '@/constants/speech-engine';
import { pickVoice } from '@/constants/speech-voices';
import { ReaderAudio } from '@/modules/reader-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';

type Verse = { number: number; text: string };

export type BibleSpeechOptions = {
  collectionId: string;
  book: string;
  chapter: number;
  chapterCount: number;
  verses: Verse[];
  /** The chapter finished loading. */
  ready: boolean;
  /** Start reading as soon as the chapter loads (set when reading continued from the previous chapter). */
  autoplay: boolean;
  versionTitle: string;
  goToChapter: (chapter: number, autoplay: boolean) => void;
  showVerse: (verse: number) => void;
};

const MAX_CHARS = 400;
// The background service reports a "page"; for the Bible it is chapter * 1000 + verse (0 = chapter title).
const encode = (chapter: number, verse: number) => chapter * 1000 + verse;

/** The book the background service is reading. Module-level so it survives moving to the next chapter screen. */
let background: { session: number; collectionId: string; book: string; following: boolean } | null = null;

const chapterPages = (collectionId: string, book: string, chapter: number, verses: Verse[]) => [
  { page: encode(chapter, 0), text: spokenChapterTitle(collectionId, book, chapter) },
  ...verses.map(verse => ({ page: encode(chapter, verse.number), text: verse.text })),
];

/**
 * Reads the Bible aloud with the same voice, speed and tone chosen in the PDF reader. With the
 * PDF's "background reading" option on (and the APK's native service present) it keeps reading
 * the whole book with the app closed or the screen off; otherwise it reads while the app is open.
 */
export function useBibleSpeech(options: BibleSpeechOptions) {
  const [speaking, setSpeaking] = useState(false);
  const [readingVerse, setReadingVerse] = useState<number | null>(null);
  const latest = useRef(options);
  const foreground = useRef(0);
  const mounted = useRef(true);
  const backgroundBroken = useRef(false);
  const autoStarted = useRef(false);

  useEffect(() => { latest.current = options; });

  const isMine = (session: number) => background?.session === session &&
    background.collectionId === latest.current.collectionId && background.book === latest.current.book;

  const followPage = useCallback((page: number) => {
    const chapter = Math.floor(page / 1000), verse = page % 1000;
    const current = latest.current;
    if (chapter === current.chapter) {
      if (verse > 0) { setReadingVerse(verse); current.showVerse(verse); }
    } else if (chapter > 0 && background && AppState.currentState === 'active') {
      background.following = true;
      current.goToChapter(chapter, false);
    }
  }, []);

  const stop = useCallback(() => {
    foreground.current += 1;
    setSpeaking(false); setReadingVerse(null);
    if (background) { background = null; void ReaderAudio?.stop().catch(() => undefined); }
    return Speech.stop().catch(() => undefined);
  }, []);

  // Native service events, and picking up a reading that continued from the previous chapter.
  useEffect(() => {
    mounted.current = true;
    const audio = ReaderAudio;
    const subscriptions = audio ? [
      audio.addListener('onProgress', event => { if (isMine(event.session)) followPage(event.page); }),
      audio.addListener('onState', event => {
        if (!isMine(event.session)) return;
        if (event.stopped) { background = null; setSpeaking(false); setReadingVerse(null); } else setSpeaking(event.playing);
      }),
      audio.addListener('onFinished', event => {
        if (!isMine(event.session)) return;
        background = null; setSpeaking(false); setReadingVerse(null);
        Alert.alert('Libro terminado', `Has terminado de escuchar ${displayBookName(latest.current.book)}.`);
      }),
      audio.addListener('onError', event => { if (background) Alert.alert('Lectura en voz alta', event.message); }),
    ] : [];
    if (audio && background && background.collectionId === latest.current.collectionId && background.book === latest.current.book) {
      const session = background.session;
      background.following = false;
      void audio.getState().then(state => {
        if (!mounted.current || !isMine(session)) return;
        if (state.active && state.session === session) {
          setSpeaking(state.playing);
          if (state.page) followPage(state.page);
        } else background = null;
      }).catch(() => undefined);
    }
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        // Only the background service keeps going with the app closed.
        if (!background) { foreground.current += 1; setSpeaking(false); setReadingVerse(null); void Speech.stop().catch(() => undefined); }
        return;
      }
      if (background && audio) {
        const session = background.session;
        void audio.getState().then(current => {
          if (!mounted.current || !isMine(session)) return;
          if (current.active && current.page) followPage(current.page);
          else if (!current.active) { background = null; setSpeaking(false); setReadingVerse(null); }
        }).catch(() => undefined);
      }
    });
    return () => {
      mounted.current = false;
      foreground.current += 1;
      void Speech.stop().catch(() => undefined);
      // Leaving the reader stops the reading (like the PDF), unless it is only moving to the next chapter.
      if (background && !background.following) { background = null; void ReaderAudio?.stop().catch(() => undefined); }
      subscriptions.forEach(subscription => subscription.remove());
      appState.remove();
    };
  }, [followPage]);

  const readInForeground = useCallback(async (voiceId: string | null, rate: number, pitch: number) => {
    const session = foreground.current;
    const alive = () => session === foreground.current && mounted.current;
    const { collectionId, book, chapter, chapterCount, verses } = latest.current;
    let voiceBroken = false;
    const say = async (text: string) => {
      for (const paragraph of prepareSpeech(text, MAX_CHARS)) {
        for (const sentence of paragraph) {
          if (!alive()) return;
          const fellBack = await speakWithFallback(sentence, { voiceId: voiceBroken ? null : voiceId, rate, pitch, isActive: alive });
          voiceBroken = voiceBroken || fellBack;
        }
      }
    };
    try {
      await say(spokenChapterTitle(collectionId, book, chapter));
      for (const verse of verses) {
        if (!alive()) return;
        setReadingVerse(verse.number); latest.current.showVerse(verse.number);
        await say(verse.text);
      }
      if (!alive()) return;
      if (chapter < chapterCount) latest.current.goToChapter(chapter + 1, true);
      else {
        setSpeaking(false); setReadingVerse(null);
        Alert.alert('Libro terminado', `Has terminado de escuchar ${displayBookName(book)}.`);
      }
    } catch (cause) {
      if (!alive()) return;
      setSpeaking(false); setReadingVerse(null);
      Alert.alert('No se pudo leer en voz alta', cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const readInBackground = useCallback(async (voiceId: string | null, rate: number, pitch: number) => {
    const audio = ReaderAudio!;
    const { collectionId, book, chapter, chapterCount, verses, versionTitle } = latest.current;
    const session = Math.floor(Date.now() % 1_000_000_000);
    background = { session, collectionId, book, following: false };
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      // Without it the reading still works, only the notification controls are hidden.
      await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => undefined);
    }
    const alive = () => background?.session === session;
    if (!alive()) return;
    const first = buildSpeechQueue(chapterPages(collectionId, book, chapter, verses), MAX_CHARS);
    await audio.start({ session, title: `${displayBookName(book)} · ${versionTitle}`, voiceId, rate, pitch, pageMode: 'bible' },
      { ...first, complete: chapter >= chapterCount });
    // The rest of the book goes to the service chapter by chapter, so it keeps reading with the screen off.
    for (let next = chapter + 1; next <= chapterCount; next++) {
      if (!alive()) return;
      const content = await fetchChapterContent(collectionId, book, next, { tanakhLanguage: 'es' }).catch(() => ({ verses: [] as Verse[] }));
      if (!alive()) return;
      await audio.append(session, { ...buildSpeechQueue(chapterPages(collectionId, book, next, content.verses), MAX_CHARS), complete: next === chapterCount });
    }
  }, []);

  const start = useCallback(async () => {
    if (!latest.current.verses.length) return;
    await stop();
    foreground.current += 1;
    setSpeaking(true);
    const saved = await loadSpeechSettings();
    const voices = await loadSpanishVoices();
    if (!mounted.current) return;
    if (!voices.length) {
      Alert.alert('Sin voz en español', 'Tu teléfono no tiene una voz en español instalada. Puedes descargarla gratis desde el lector de PDF, en «Voz».');
    }
    const voiceId = pickVoice(voices, saved.voiceId)?.identifier ?? null;
    if (saved.background && ReaderAudio && !backgroundBroken.current) {
      try { await readInBackground(voiceId, saved.rate, saved.pitch); return; }
      catch {
        // The service could not start on this phone: read with the app open instead.
        backgroundBroken.current = true;
        background = null;
        void ReaderAudio.stop().catch(() => undefined);
      }
    }
    void readInForeground(voiceId, saved.rate, saved.pitch);
  }, [readInBackground, readInForeground, stop]);

  const { autoplay, ready, verses } = options;
  useEffect(() => {
    if (!autoplay || autoStarted.current || !ready || !verses.length) return;
    autoStarted.current = true;
    void start();
  }, [autoplay, ready, start, verses.length]);

  const toggle = useCallback(() => { if (speaking) void stop(); else void start(); }, [speaking, start, stop]);
  return { speaking, readingVerse, toggle };
}
