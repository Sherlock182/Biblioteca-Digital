/**
 * Section headings and notes shown inside a chapter:
 * - Biblia Platense: headings and footnotes of Mons. Straubinger (1948, public domain), built by
 *   scripts/generate-platense-notas.js from the CrossWire module.
 * - Nueva Biblia Viva: section headings, psalm titles and the speakers of the Song of Songs
 *   (Biblica® Open NBV 2008, CC BY-SA 4.0), built by scripts/generate-nbv.js.
 * - Reina-Valera 1960: section headings, psalm titles and the letters of Psalm 119, built by
 *   scripts/generate-rv1960-titulos.js.
 * - LBLA, RVC and NVI: section headings, psalm titles, the letters of Psalm 119 and the speakers of the
 *   Song of Songs, built by scripts/generate-bible-json.js.
 */

/** M major section, S section, D psalm title, P who is speaking (Song of Songs). */
export type HeadingKind = 'M' | 'S' | 'D' | 'P';
export type VerseHeading = [kind: HeadingKind, text: string];
/** label: the verses the note covers as printed ("16 ss"); text: \u0002…\u0003 marks italics. */
export type VerseNote = [label: string, text: string];
export type VerseExtras = { h?: VerseHeading[]; n?: VerseNote[] };

type ExtrasFile = Record<string, Record<string, VerseExtras>>;

// Each file is read the first time a chapter of its Bible is opened, not when the app starts.
const FILES: Record<string, () => ExtrasFile> = {
  catolica: () => require('../assets/data/platense-notas.json'),
  nbv: () => require('../assets/data/nbv-titulos.json'),
  rv1960: () => require('../assets/data/rv1960-titulos.json'),
  lbla: () => require('../assets/data/lbla-titulos.json'),
  rvc: () => require('../assets/data/rvc-titulos.json'),
  nvi: () => require('../assets/data/nvi-titulos.json'),
};
const loaded: Record<string, ExtrasFile> = {};

export const hasChapterExtras = (collectionId: string) => collectionId in FILES;

/** Loads a Bible's headings ahead of time, together with its text (see preloadCollection). */
export function preloadChapterExtras(collectionId: string) {
  const load = FILES[collectionId];
  if (load) loaded[collectionId] ??= load();
}

/** Headings and notes of one chapter, by verse number (empty for a Bible without them). */
export function getChapterExtras(collectionId: string, book: string, chapter: number): Record<number, VerseExtras> {
  const load = FILES[collectionId];
  if (!load) return {};
  const file = (loaded[collectionId] ??= load());
  const prefix = chapter + ':';
  const result: Record<number, VerseExtras> = {};
  for (const [key, extras] of Object.entries(file[book] ?? {})) {
    if (key.startsWith(prefix)) result[Number(key.slice(prefix.length))] = extras;
  }
  return result;
}

/** A note's text cut into plain and italic pieces. */
export function noteSegments(text: string): { text: string; italic: boolean }[] {
  return text.split(/(\u0002[^\u0003]*\u0003)/).filter(Boolean).map(part => part.startsWith('\u0002')
    ? { text: part.slice(1, -1), italic: true }
    : { text: part, italic: false });
}
