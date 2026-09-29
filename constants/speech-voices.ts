/** Pure voice-selection logic: no React Native imports so it can be unit tested. */

export type VoiceInfo = { identifier: string; name: string; quality: string; language: string };
export type RankedVoice = VoiceInfo & { label: string; enhanced: boolean; score: number };

export type SpeechSettings = { voiceId: string | null; rate: number; pitch: number; background: boolean };
export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = { voiceId: null, rate: 1, pitch: 1, background: true };
export const RATE_RANGE = { min: 0.5, max: 2, step: 0.25 };
export const PITCH_RANGE = { min: 0.7, max: 1.3, step: 0.1 };

const REGIONS: Record<string, string> = {
  MX: 'México', US: 'EE. UU.', '419': 'Latinoamérica', ES: 'España', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
  PE: 'Perú', VE: 'Venezuela', SV: 'El Salvador', GT: 'Guatemala', HN: 'Honduras', NI: 'Nicaragua', CR: 'Costa Rica',
  PA: 'Panamá', DO: 'Rep. Dominicana', PR: 'Puerto Rico', CU: 'Cuba', EC: 'Ecuador', BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay',
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(min, Math.min(max, number)) * 100) / 100;
};

/** Accepts anything read from storage and returns valid settings. */
export function sanitizeSpeechSettings(value: unknown): SpeechSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<SpeechSettings>;
  return {
    voiceId: typeof raw.voiceId === 'string' && raw.voiceId ? raw.voiceId : null,
    rate: clamp(raw.rate, RATE_RANGE.min, RATE_RANGE.max, 1),
    pitch: clamp(raw.pitch, PITCH_RANGE.min, PITCH_RANGE.max, 1),
    background: typeof raw.background === 'boolean' ? raw.background : DEFAULT_SPEECH_SETTINGS.background,
  };
}

function region(language: string): string {
  const parts = language.replace('_', '-').split('-');
  return (parts[1] || '').toUpperCase();
}

/**
 * Spanish voices that work offline, best first: enhanced quality, then Latin American
 * accents, then Spain. Voices that stream from the network are excluded.
 */
export function rankSpanishVoices(voices: VoiceInfo[]): RankedVoice[] {
  const seen = new Set<string>();
  const ranked = voices
    .filter(voice => voice && typeof voice.identifier === 'string' && typeof voice.language === 'string')
    .filter(voice => /^es([-_]|$)/i.test(voice.language))
    .filter(voice => !/network/i.test(voice.identifier))
    .filter(voice => !seen.has(voice.identifier) && !!seen.add(voice.identifier))
    .map(voice => {
      const code = region(voice.language);
      const enhanced = /enhanced|premium/i.test(voice.quality);
      const latin = code !== 'ES' && code !== '';
      const score = (enhanced ? 100 : 0) + (latin ? 30 : code === 'ES' ? 10 : 0) +
        (/local/i.test(voice.identifier) ? 5 : 0) + (code === 'MX' || code === 'US' ? 3 : 0);
      const place = REGIONS[code] || (code || 'general');
      return { ...voice, enhanced, score, label: 'Español (' + place + ') · ' + (enhanced ? 'Alta calidad' : 'Normal') };
    })
    .sort((a, b) => b.score - a.score || a.identifier.localeCompare(b.identifier));
  // Several voices can share a label ("Español (México) · Alta calidad"): number them.
  const counts: Record<string, number> = {};
  ranked.forEach(voice => { counts[voice.label] = (counts[voice.label] || 0) + 1; });
  const index: Record<string, number> = {};
  return ranked.map(voice => counts[voice.label] > 1
    ? { ...voice, label: voice.label + ' · Voz ' + (index[voice.label] = (index[voice.label] || 0) + 1) }
    : voice);
}

/** The saved voice if it is still installed, otherwise the best available one. */
export function pickVoice(ranked: RankedVoice[], savedId: string | null): RankedVoice | null {
  return (savedId && ranked.find(voice => voice.identifier === savedId)) || ranked[0] || null;
}
