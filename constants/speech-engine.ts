import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Speech from 'expo-speech';
import { Linking, Platform } from 'react-native';
import { DEFAULT_SPEECH_SETTINGS, RankedVoice, rankSpanishVoices, sanitizeSpeechSettings, SpeechSettings } from './speech-voices';

const SETTINGS_KEY = '@speech_settings_v1';
// If the engine has not started talking by then, the voice is treated as broken.
const START_TIMEOUT_MS = 8000;

export async function loadSpeechSettings(): Promise<SpeechSettings> {
  try { return sanitizeSpeechSettings(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) || '{}')); }
  catch { return { ...DEFAULT_SPEECH_SETTINGS }; }
}

export async function saveSpeechSettings(settings: SpeechSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSpeechSettings(settings))).catch(() => undefined);
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Several Android engines return an empty list until they finish starting, so retry briefly. */
export async function loadSpanishVoices(): Promise<RankedVoice[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (voices.length) return rankSpanishVoices(voices);
    } catch { /* engine still starting */ }
    await wait(700);
  }
  return [];
}

type SpeakOptions = {
  voiceId: string | null; rate: number; pitch: number; onStart?: () => void;
  /** Checked before falling back, so a reading the user already stopped stays silent. */
  isActive?: () => boolean;
};

/** Speaks one utterance; rejects on engine error or if it never starts. */
export function speakUtterance(text: string, options: SpeakOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => {
      void Speech.stop().catch(() => undefined);
      finish(new Error('La voz no respondió.'));
    }, START_TIMEOUT_MS);
    try {
      Speech.speak(text, {
        // Android only understands a bare language code here; the accent comes from the voice.
        language: 'es', rate: options.rate, pitch: options.pitch,
        ...(options.voiceId ? { voice: options.voiceId } : {}),
        onStart: () => { clearTimeout(timer); options.onStart?.(); },
        onDone: () => finish(), onStopped: () => finish(),
        onError: error => finish(error instanceof Error ? error : new Error(String(error))),
      });
    } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}

/**
 * Speaks with the chosen voice and, if that voice fails, retries once with the phone's
 * default Spanish voice. Resolves true when the fallback was needed.
 */
export async function speakWithFallback(text: string, options: SpeakOptions): Promise<boolean> {
  try {
    await speakUtterance(text, options);
    return false;
  } catch (error) {
    if (!options.voiceId || (options.isActive && !options.isActive())) throw error;
    await Speech.stop().catch(() => undefined);
    if (options.isActive && !options.isActive()) throw error;
    await speakUtterance(text, { ...options, voiceId: null });
    return true;
  }
}

export const IOS_VOICE_STEPS = 'En tu iPhone abre Ajustes → Accesibilidad → Contenido leído → Voces → Español, y descarga una voz "Mejorada".';

/** Opens the system screen where free offline voices are installed. Returns false if only general settings could be opened. */
export async function openVoiceInstaller(): Promise<boolean> {
  if (Platform.OS === 'android') {
    for (const action of ['com.android.settings.TTS_SETTINGS', 'android.speech.tts.engine.INSTALL_TTS_DATA']) {
      try { await IntentLauncher.startActivityAsync(action); return true; } catch { /* hidden by this manufacturer */ }
    }
  }
  await Linking.openSettings().catch(() => undefined);
  return false;
}
