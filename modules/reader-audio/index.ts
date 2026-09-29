import { requireOptionalNativeModule } from 'expo';

export type ReaderAudioBatch = { pages: number[]; texts: string[]; paragraphEnds: boolean[]; complete: boolean };
export type ReaderAudioStartOptions = { session: number; title: string; voiceId: string | null; rate: number; pitch: number };
export type ReaderAudioState = { active: boolean; playing: boolean; page?: number | null; session?: number };

type Subscription = { remove(): void };
type ReaderAudioEvents = {
  onProgress: { page: number; session: number };
  onState: { playing: boolean; stopped: boolean; session: number };
  onFinished: { session: number };
  onError: { message: string };
  onVoiceFallback: Record<string, never>;
};

type ReaderAudioNative = {
  start(options: ReaderAudioStartOptions, batch: ReaderAudioBatch): Promise<void>;
  append(session: number, batch: ReaderAudioBatch): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<ReaderAudioState>;
  addListener<E extends keyof ReaderAudioEvents>(event: E, listener: (payload: ReaderAudioEvents[E]) => void): Subscription;
};

/**
 * Background reading with a media notification / lock-screen controls. Only present in builds
 * that include this native module (the APK), never in Expo Go: callers must handle null.
 */
export const ReaderAudio = requireOptionalNativeModule<ReaderAudioNative>('ReaderAudio');
export const isBackgroundReadingAvailable = ReaderAudio !== null;
