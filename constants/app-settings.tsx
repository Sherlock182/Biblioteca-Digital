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
    /** Background of the featured Bible's box and the verse of the day, when they should differ from `panel`. */
    feature?: string;
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
    id: 'clasico', name: 'Clásico', description: 'Azul cielo con detalles dorados.',
    home: {
      page: '#185F91', card: '#185F91', title: '#FFD98A', text: '#E6F3FC', muted: '#BFDDF2', accent: '#FFD98A',
      panel: 'rgba(255,255,255,0.10)', panelBorder: 'rgba(255,217,138,0.32)', panelText: '#F7F4EA', feature: '#124A72',
      tile: 'rgba(26,18,11,0.44)', tileBorder: 'rgba(238,223,196,0.26)', tileText: '#F5E8D2', statusBar: 'light',
    },
    ui: { page: '#E6F0F7', card: '#D5E5F1', text: '#1B2B3A', muted: '#4A5E70', border: '#A9C5DB', soft: '#CCDFEE', primary: '#185F91', primaryText: '#FFFFFF', accent: '#7E5A1C', danger: '#9A4F3F', notice: '#FBF0D6', noticeText: '#5C4318', statusBar: 'dark' },
    reader: {
      page: '#EEF5FA', header: '#185F91', headerBorder: '#E0B85C', heading: '#14496F', text: '#1E2A36', number: '#7E5A1C',
      highlight: '#FFF3B8', selected: '#D3E4F2', statusBar: 'dark',
    },
  },
  {
    id: 'noche', name: 'Noche', description: 'Grises carbón en varios tonos, con dorado.',
    home: {
      page: '#2A2D34', card: '#2A2D34', title: '#E3C98F', text: '#D6DAE2', muted: '#A3AAB6', accent: '#E3C98F',
      panel: 'rgba(255,255,255,0.07)', panelBorder: 'rgba(227,201,143,0.24)', panelText: '#EFE7D6', feature: '#1D1F24',
      tile: 'rgba(255,255,255,0.05)', tileBorder: 'rgba(227,201,143,0.2)', tileText: '#EFE7D6', statusBar: 'light',
    },
    ui: { page: '#202228', card: '#2C2F37', text: '#ECE6DA', muted: '#A3AAB6', border: '#40444E', soft: '#353943', primary: '#C9A96E', primaryText: '#1A1408', accent: '#E3C98F', danger: '#E08A7A', notice: '#3A3324', noticeText: '#F0DDB0', statusBar: 'light' },
    reader: {
      page: '#24272D', header: '#18191D', headerBorder: '#3A3E47', heading: '#E8DCC0', text: '#DAD4C8', number: '#B39565',
      highlight: 'rgba(227,201,143,0.22)', selected: 'rgba(255,255,255,0.10)', statusBar: 'light',
    },
  },
  {
    id: 'pergamino', name: 'Pergamino', description: 'Claro y cálido, como papel antiguo.',
    home: {
      page: '#E8D9BA', card: '#E8D9BA', title: '#F6E7C8', text: '#4A3826', muted: '#7D6649', accent: '#8E6130',
      panel: 'rgba(255,255,255,0.55)', panelBorder: 'rgba(142,97,48,0.3)', panelText: '#3E2A17',
      tile: 'rgba(26,18,11,0.44)', tileBorder: 'rgba(238,223,196,0.26)', tileText: '#F5E8D2', statusBar: 'dark',
    },
    ui: { page: '#F5E9CF', card: '#EEDDB8', text: '#3A2A18', muted: '#6B5535', border: '#D2BB8C', soft: '#E9D6AE', primary: '#6E4A22', primaryText: '#FFFFFF', accent: '#7E5626', danger: '#9A4F3F', notice: '#FCEFC8', noticeText: '#6B4520', statusBar: 'dark' },
    reader: {
      page: '#F6EBCF', header: '#7A5230', headerBorder: '#A57A4E', heading: '#4A3320', text: '#2E2317', number: '#7C5527',
      highlight: '#FCEFB4', selected: '#EAD9B3', statusBar: 'dark',
    },
  },
  {
    id: 'bosque', name: 'Bosque', description: 'Pino profundo con ámbar y madera.',
    home: {
      page: '#1F4430', card: '#1F4430', title: '#E6B866', text: '#E3EFE2', muted: '#A9C6AE', accent: '#E6B866',
      panel: 'rgba(255,255,255,0.07)', panelBorder: 'rgba(230,184,102,0.30)', panelText: '#F1EEDF', feature: '#163323',
      tile: 'rgba(12,20,15,0.42)', tileBorder: 'rgba(230,184,102,0.24)', tileText: '#F1EEDF', statusBar: 'light',
    },
    ui: { page: '#E8EDDA', card: '#DAE3C8', text: '#1F2A22', muted: '#4B5946', border: '#B8C6A0', soft: '#D3DDBF', primary: '#1F4430', primaryText: '#FFFFFF', accent: '#744B22', danger: '#8E5447', notice: '#F6ECD2', noticeText: '#5A3D1C', statusBar: 'dark' },
    reader: {
      page: '#EEF1DF', header: '#1F4430', headerBorder: '#7A5532', heading: '#1F4430', text: '#1F2A22', number: '#55704A',
      highlight: '#F6EBC0', selected: '#DCE4CA', statusBar: 'dark',
    },
  },
  {
    id: 'vino', name: 'Vino', description: 'Burdeos elegante, estilo biblioteca antigua.',
    home: {
      page: '#52283A', card: '#52283A', title: '#E7C9A0', text: '#EBD9DD', muted: '#B99AA2', accent: '#E7C9A0',
      panel: 'rgba(255,255,255,0.06)', panelBorder: 'rgba(231,201,160,0.26)', panelText: '#F6E9E2', feature: '#3A1A24',
      tile: 'rgba(20,8,12,0.42)', tileBorder: 'rgba(231,201,160,0.22)', tileText: '#F6E9E2', statusBar: 'light',
    },
    ui: { page: '#F7E8E5', card: '#F0D7D2', text: '#2E1F22', muted: '#664850', border: '#D9B2AB', soft: '#EBCDC7', primary: '#5A2536', primaryText: '#FFFFFF', accent: '#71472D', danger: '#8E3F4F', notice: '#FBEBD5', noticeText: '#5A2536', statusBar: 'dark' },
    reader: {
      page: '#F8EAE3', header: '#3A1A24', headerBorder: '#5E2E3C', heading: '#4A2430', text: '#2E1F22', number: '#8E5A66',
      highlight: '#FBEFC0', selected: '#EED2CB', statusBar: 'dark',
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
