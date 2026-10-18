import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId = 'clasico' | 'noche' | 'pergamino' | 'bosque' | 'vino';

export type AppTheme = {
  id: ThemeId;
  name: string;
  description: string;
  /** Home screen (library shelf). The wooden sign and shelf keep their wood in every theme. */
  home: {
    page: string; card: string; title: string; text: string; muted: string; accent: string;
    panel: string; panelBorder: string; panelText: string; tile: string; tileBorder: string; tileText: string;
    statusBar: 'light' | 'dark';
  };
  /** Library lists, PDF screens and settings sheets. */
  ui: {
    page: string; card: string; text: string; muted: string; border: string; soft: string;
    primary: string; primaryText: string; accent: string; danger: string; notice: string; noticeText: string;
    statusBar: 'light' | 'dark';
  };
  /** Bible chapter reader. */
  reader: {
    page: string; header: string; headerBorder: string; heading: string; text: string; number: string;
    highlight: string; selected: string; statusBar: 'light' | 'dark';
  };
};

export const THEMES: AppTheme[] = [
  {
    id: 'clasico', name: 'Clásico', description: 'El diseño original: azul noche y madera.',
    home: {
      page: '#F4EEE1', card: '#1A2A3A', title: '#D9C19A', text: '#D9E6F2', muted: '#9FB3C6', accent: '#D9C19A',
      panel: 'rgba(255,255,255,0.06)', panelBorder: 'rgba(217,193,154,0.28)', panelText: '#F2E6D0',
      tile: 'rgba(26,18,11,0.44)', tileBorder: 'rgba(238,223,196,0.26)', tileText: '#F5E8D2', statusBar: 'dark',
    },
    ui: { page: '#F7F3EB', card: '#FFFDF9', text: '#30271F', muted: '#7C6B58', border: '#E5DCCF', soft: '#EBE3D6', primary: '#65482F', primaryText: '#FFFFFF', accent: '#A6814D', danger: '#8E5447', notice: '#FFF0CD', noticeText: '#65482F', statusBar: 'dark' },
    reader: {
      page: '#F6EFD2', header: '#2F1E12', headerBorder: '#6A4325', heading: '#3E2D1A', text: '#2F2418', number: '#8A6F4D',
      highlight: '#FFF9C4', selected: '#EADBBC', statusBar: 'dark',
    },
  },
  {
    id: 'noche', name: 'Noche', description: 'Oscuro y cómodo para leer de noche.',
    home: {
      page: '#0E1014', card: '#171A21', title: '#E3C98F', text: '#C9CED8', muted: '#8B93A1', accent: '#E3C98F',
      panel: 'rgba(255,255,255,0.05)', panelBorder: 'rgba(227,201,143,0.2)', panelText: '#EDE3CF',
      tile: 'rgba(255,255,255,0.04)', tileBorder: 'rgba(227,201,143,0.18)', tileText: '#EDE3CF', statusBar: 'light',
    },
    ui: { page: '#101217', card: '#1A1D24', text: '#ECE6DA', muted: '#9098A6', border: '#2B2F38', soft: '#262A33', primary: '#C9A96E', primaryText: '#1A1408', accent: '#E3C98F', danger: '#E08A7A', notice: '#2E2818', noticeText: '#F0DDB0', statusBar: 'light' },
    reader: {
      page: '#14161B', header: '#0B0C10', headerBorder: '#2A2D35', heading: '#E8DCC0', text: '#DAD4C8', number: '#B39565',
      highlight: 'rgba(227,201,143,0.22)', selected: 'rgba(255,255,255,0.09)', statusBar: 'light',
    },
  },
  {
    id: 'pergamino', name: 'Pergamino', description: 'Claro y cálido, como papel antiguo.',
    home: {
      page: '#F7F1E3', card: '#E8D9BA', title: '#F6E7C8', text: '#4A3826', muted: '#7D6649', accent: '#8E6130',
      panel: 'rgba(255,255,255,0.55)', panelBorder: 'rgba(142,97,48,0.3)', panelText: '#3E2A17',
      tile: 'rgba(26,18,11,0.44)', tileBorder: 'rgba(238,223,196,0.26)', tileText: '#F5E8D2', statusBar: 'dark',
    },
    ui: { page: '#FBF6EA', card: '#FFFDF7', text: '#3A2A18', muted: '#80694E', border: '#E8DCC5', soft: '#F1E6CF', primary: '#8E6130', primaryText: '#FFFFFF', accent: '#B88A4E', danger: '#9A4F3F', notice: '#FCEFC8', noticeText: '#6B4520', statusBar: 'dark' },
    reader: {
      page: '#FBF6EA', header: '#7A5230', headerBorder: '#A57A4E', heading: '#4A3320', text: '#2E2317', number: '#9A6B35',
      highlight: '#FCEFB4', selected: '#EFE2C6', statusBar: 'dark',
    },
  },
  {
    id: 'bosque', name: 'Bosque', description: 'Verde sereno con detalles dorados.',
    home: {
      page: '#EEF1EA', card: '#1E3A2F', title: '#E6D6A8', text: '#D6E5DC', muted: '#9DB8A8', accent: '#E6D6A8',
      panel: 'rgba(255,255,255,0.06)', panelBorder: 'rgba(230,214,168,0.26)', panelText: '#EFF3E6',
      tile: 'rgba(12,20,15,0.42)', tileBorder: 'rgba(230,214,168,0.22)', tileText: '#F2EBD5', statusBar: 'dark',
    },
    ui: { page: '#F1F4EE', card: '#FFFFFF', text: '#1F2A22', muted: '#627566', border: '#D8E1D6', soft: '#E4ECE1', primary: '#1E3A2F', primaryText: '#FFFFFF', accent: '#B59A58', danger: '#8E5447', notice: '#F3F0CF', noticeText: '#2E4A3C', statusBar: 'dark' },
    reader: {
      page: '#F1F4EC', header: '#1E3A2F', headerBorder: '#35584A', heading: '#23382C', text: '#1F2A22', number: '#5C7B67',
      highlight: '#F4F0C0', selected: '#DDE7D9', statusBar: 'dark',
    },
  },
  {
    id: 'vino', name: 'Vino', description: 'Burdeos elegante, estilo biblioteca antigua.',
    home: {
      page: '#F5EDEA', card: '#3A1A24', title: '#E7C9A0', text: '#EBD9DD', muted: '#B99AA2', accent: '#E7C9A0',
      panel: 'rgba(255,255,255,0.06)', panelBorder: 'rgba(231,201,160,0.26)', panelText: '#F6E9E2',
      tile: 'rgba(20,8,12,0.42)', tileBorder: 'rgba(231,201,160,0.22)', tileText: '#F6E9E2', statusBar: 'dark',
    },
    ui: { page: '#FAF4F1', card: '#FFFFFF', text: '#2E1F22', muted: '#806068', border: '#EADCDA', soft: '#F2E4E2', primary: '#5A2536', primaryText: '#FFFFFF', accent: '#B98A6A', danger: '#8E3F4F', notice: '#FBEBD5', noticeText: '#5A2536', statusBar: 'dark' },
    reader: {
      page: '#FAF3EC', header: '#3A1A24', headerBorder: '#5E2E3C', heading: '#4A2430', text: '#2E1F22', number: '#8E5A66',
      highlight: '#FBEFC0', selected: '#F0DEDC', statusBar: 'dark',
    },
  },
];

/** Text size for the Bible reader only; the PDF reader keeps its own zoom. */
export const TEXT_SIZES = [
  { id: 'xs', label: 'Pequeño', scale: 0.87 },
  { id: 'm', label: 'Normal', scale: 1 },
  { id: 'l', label: 'Grande', scale: 1.15 },
  { id: 'xl', label: 'Muy grande', scale: 1.3 },
  { id: 'xxl', label: 'Enorme', scale: 1.5 },
] as const;

/** Typeface of the Bible text: the phone's serif, or EB Garamond (a book face, loaded in the root layout). */
export const READER_FONTS = [
  { id: 'clasica', label: 'Clásica', description: 'La letra del teléfono' },
  { id: 'libro', label: 'Libro', description: 'Garamond, como una Biblia impresa' },
] as const;
export type ReaderFontId = (typeof READER_FONTS)[number]['id'];
export const GARAMOND = { regular: 'EBGaramond_400Regular', bold: 'EBGaramond_700Bold' };

/** One verse per line, or running text with small verse numbers (as in a printed Bible). */
export const VERSE_LAYOUTS = [
  { id: 'versiculos', label: 'Versículos', description: 'Uno por renglón' },
  { id: 'parrafo', label: 'Párrafo', description: 'Texto corrido' },
] as const;
export type VerseLayoutId = (typeof VERSE_LAYOUTS)[number]['id'];

export type AppSettings = { themeId: ThemeId; textScale: number; readerFont: ReaderFontId; verseLayout: VerseLayoutId };
const DEFAULT_SETTINGS: AppSettings = { themeId: 'clasico', textScale: 1, readerFont: 'clasica', verseLayout: 'versiculos' };
const STORAGE_KEY = '@app_settings_v1';

export function sanitizeAppSettings(value: unknown): AppSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<AppSettings>;
  return {
    themeId: THEMES.some(theme => theme.id === raw.themeId) ? raw.themeId as ThemeId : DEFAULT_SETTINGS.themeId,
    textScale: TEXT_SIZES.some(size => size.scale === raw.textScale) ? raw.textScale as number : DEFAULT_SETTINGS.textScale,
    readerFont: READER_FONTS.some(font => font.id === raw.readerFont) ? raw.readerFont as ReaderFontId : DEFAULT_SETTINGS.readerFont,
    verseLayout: VERSE_LAYOUTS.some(layout => layout.id === raw.verseLayout) ? raw.verseLayout as VerseLayoutId : DEFAULT_SETTINGS.verseLayout,
  };
}

/** Layers per-theme color overrides on a screen's base StyleSheet (keys and layout unchanged). */
export function mergeStyles<T extends Record<string, unknown>>(base: T, overrides: Partial<Record<keyof T, object>>): T {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) if (value) merged[key] = [base[key], value];
  return merged as T;
}

type AppSettingsContext = {
  settings: AppSettings;
  theme: AppTheme;
  setTheme: (id: ThemeId) => void;
  setTextScale: (scale: number) => void;
  setReaderFont: (font: ReaderFontId) => void;
  setVerseLayout: (layout: VerseLayoutId) => void;
};

const Context = createContext<AppSettingsContext>({
  settings: DEFAULT_SETTINGS, theme: THEMES[0], setTheme: () => undefined, setTextScale: () => undefined,
  setReaderFont: () => undefined, setVerseLayout: () => undefined,
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => { if (alive && raw) setSettings(sanitizeAppSettings(JSON.parse(raw))); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(current => {
      const next = sanitizeAppSettings({ ...current, ...patch });
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const value = useMemo<AppSettingsContext>(() => ({
    settings,
    theme: THEMES.find(theme => theme.id === settings.themeId) ?? THEMES[0],
    setTheme: themeId => update({ themeId }),
    setTextScale: textScale => update({ textScale }),
    setReaderFont: readerFont => update({ readerFont }),
    setVerseLayout: verseLayout => update({ verseLayout }),
  }), [settings, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useAppSettings = () => useContext(Context);
