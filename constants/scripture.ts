import { displayBookName } from './reading-history';

export type SacredBook = {
  id: string;
  title: string;
  shortName: string;
  subtitle: string;
  /** Drawing on the cover's seal. */
  icon: 'cross' | 'church' | 'open-book' | 'book' | 'globe' | 'flame';
  colors: {
    cover: string;
    spine: string;
    text: string;
  };
  books: string[];
};

export type TestamentType = 'antiguo' | 'nuevo';

/** How a chapter is named: "Juan 3". */
export function chapterTitle(collectionId: string | null | undefined, book: string, chapter: number) {
  return `${displayBookName(book)} ${chapter}`;
}

/** A verse reference: "Juan 3:16". */
export function verseReference(collectionId: string | null | undefined, book: string, chapter: number, verse: number | string) {
  return `${displayBookName(book)} ${chapter}:${verse}`;
}

/** What the voice says before reading a chapter. */
export function spokenChapterTitle(collectionId: string | null | undefined, book: string, chapter: number) {
  return `${displayBookName(book)}, capítulo ${chapter}.`;
}

export type VerseLine = {
  number: number;
  text: string;
  /** Shown instead of the number when several verses are printed together ("1-3"). */
  label?: string;
};

export type TanakhLanguage = 'es' | 'he';

export type ChapterContent = {
  heading?: string;
  verses: VerseLine[];
  source: 'local' | 'api' | 'missing';
  note?: string;
};

export type CollectionBookListItem =
  | { type: 'section'; label: string }
  | { type: 'subsection'; label: string }
  | { type: 'book'; label: string; book: string };

export const TANAKH_BOOK_LIST: CollectionBookListItem[] = [
  { type: 'section', label: 'Torah (La Ley)' },
  { type: 'book', label: 'Bereshit (Génesis)', book: 'Bereshit (Génesis)' },
  { type: 'book', label: 'Shemot (Éxodo)', book: 'Shemot (Éxodo)' },
  { type: 'book', label: 'Vayikrá (Levítico)', book: 'Vayikrá (Levítico)' },
  { type: 'book', label: 'Bamidbar (Números)', book: 'Bamidbar (Números)' },
  { type: 'book', label: 'Devarim (Deuteronomio)', book: 'Devarim (Deuteronomio)' },

  { type: 'section', label: "Nevi'im (Los Profetas)" },
  { type: 'subsection', label: 'Profetas anteriores' },
  { type: 'book', label: 'Yehoshúa (Josué)', book: 'Yehoshúa (Josué)' },
  { type: 'book', label: 'Shoftim (Jueces)', book: 'Shoftim (Jueces)' },
  { type: 'book', label: 'Shmuel (Samuel)', book: 'Shmuel (Samuel)' },
  { type: 'book', label: 'Melajim (Reyes)', book: 'Melajim (Reyes)' },
  { type: 'subsection', label: 'Profetas posteriores' },
  { type: 'book', label: 'Yeshayahu (Isaías)', book: 'Yeshayahu (Isaías)' },
  { type: 'book', label: 'Yirmeyahu (Jeremías)', book: 'Yirmeyahu (Jeremías)' },
  { type: 'book', label: 'Yejezkel (Ezequiel)', book: 'Yejezkel (Ezequiel)' },
  { type: 'book', label: 'Hoshea (Oseas)', book: 'Hoshea (Oseas)' },
  { type: 'book', label: 'Yoel (Joel)', book: 'Yoel (Joel)' },
  { type: 'book', label: 'Amos (Amós)', book: 'Amos (Amós)' },
  { type: 'book', label: 'Ovadia (Abdías)', book: 'Ovadia (Abdías)' },
  { type: 'book', label: 'Yonah (Jonás)', book: 'Yonah (Jonás)' },
  { type: 'book', label: 'Mijá (Miqueas)', book: 'Mijá (Miqueas)' },
  { type: 'book', label: 'Najum (Nahúm)', book: 'Najum (Nahúm)' },
  { type: 'book', label: 'Jabaquq (Habacuc)', book: 'Jabaquq (Habacuc)' },
  { type: 'book', label: 'Tzefania (Sofonías)', book: 'Tzefania (Sofonías)' },
  { type: 'book', label: 'Jagai (Hageo)', book: 'Jagai (Hageo)' },
  { type: 'book', label: 'Zejaria (Zacarías)', book: 'Zejaria (Zacarías)' },
  { type: 'book', label: 'Malají (Malaquías)', book: 'Malají (Malaquías)' },

  { type: 'section', label: 'Ketuvim (Los Escritos)' },
  { type: 'book', label: 'Tehilim (Salmos)', book: 'Tehilim (Salmos)' },
  { type: 'book', label: 'Mishlei (Proverbios)', book: 'Mishlei (Proverbios)' },
  { type: 'book', label: 'Iyov (Job)', book: 'Iyov (Job)' },
  { type: 'book', label: 'Shir Hashirim (Cantar de los Cantares)', book: 'Shir Hashirim (Cantar de los Cantares)' },
  { type: 'book', label: 'Rut (Rut)', book: 'Rut (Rut)' },
  { type: 'book', label: 'Eijá (Lamentaciones)', book: 'Eijá (Lamentaciones)' },
  { type: 'book', label: 'Kohelet (Eclesiastés)', book: 'Kohelet (Eclesiastés)' },
  { type: 'book', label: 'Ester (Ester)', book: 'Ester (Ester)' },
  { type: 'book', label: 'Daniel (Daniel)', book: 'Daniel (Daniel)' },
  { type: 'book', label: 'Ezra–Nejemia (Esdras–Nehemías)', book: 'Ezra–Nejemia (Esdras–Nehemías)' },
  { type: 'book', label: 'Divrei Hayamim (Crónicas)', book: 'Divrei Hayamim (Crónicas)' },
];


export const CATHOLIC_BOOK_LIST: CollectionBookListItem[] = [
  { type: 'section', label: 'Antiguo Testamento' },
  { type: 'subsection', label: '1. Pentateuco (La Ley)' },
  { type: 'book', label: 'Génesis', book: 'Genesis' },
  { type: 'book', label: 'Éxodo', book: 'Exodo' },
  { type: 'book', label: 'Levítico', book: 'Levitico' },
  { type: 'book', label: 'Números', book: 'Numeros' },
  { type: 'book', label: 'Deuteronomio', book: 'Deuteronomio' },

  { type: 'subsection', label: '2. Libros históricos' },
  { type: 'book', label: 'Josué', book: 'Josue' },
  { type: 'book', label: 'Jueces', book: 'Jueces' },
  { type: 'book', label: 'Rut', book: 'Rut' },
  { type: 'book', label: '1 Samuel', book: '1 Samuel' },
  { type: 'book', label: '2 Samuel', book: '2 Samuel' },
  { type: 'book', label: '1 Reyes', book: '1 Reyes' },
  { type: 'book', label: '2 Reyes', book: '2 Reyes' },
  { type: 'book', label: '1 Crónicas', book: '1 Cronicas' },
  { type: 'book', label: '2 Crónicas', book: '2 Cronicas' },
  { type: 'book', label: 'Esdras', book: 'Esdras' },
  { type: 'book', label: 'Nehemías', book: 'Nehemias' },
  { type: 'book', label: 'Ester', book: 'Ester' },
  { type: 'book', label: 'Tobit', book: 'Tobit' },
  { type: 'book', label: 'Judit', book: 'Judit' },
  { type: 'book', label: '1 Macabeos', book: '1 Macabeos' },
  { type: 'book', label: '2 Macabeos', book: '2 Macabeos' },

  { type: 'subsection', label: '3. Libros sapienciales (sabiduría)' },
  { type: 'book', label: 'Job', book: 'Job' },
  { type: 'book', label: 'Salmos', book: 'Salmos' },
  { type: 'book', label: 'Proverbios', book: 'Proverbios' },
  { type: 'book', label: 'Eclesiastés', book: 'Eclesiastes' },
  { type: 'book', label: 'Cantares', book: 'Cantares' },
  { type: 'book', label: 'Sabiduría', book: 'Sabiduria' },
  { type: 'book', label: 'Eclesiástico', book: 'Ecclesiastico' },

  { type: 'subsection', label: '4. Profetas mayores' },
  { type: 'book', label: 'Isaías', book: 'Isaias' },
  { type: 'book', label: 'Jeremías', book: 'Jeremias' },
  { type: 'book', label: 'Lamentaciones', book: 'Lamentaciones' },
  { type: 'book', label: 'Baruc', book: 'Baruc' },
  { type: 'book', label: 'Ezequiel', book: 'Ezequiel' },
  { type: 'book', label: 'Daniel', book: 'Daniel' },

  { type: 'subsection', label: '5. Profetas menores' },
  { type: 'book', label: 'Oseas', book: 'Oseas' },
  { type: 'book', label: 'Joel', book: 'Joel' },
  { type: 'book', label: 'Amós', book: 'Amos' },
  { type: 'book', label: 'Abdías', book: 'Abdias' },
  { type: 'book', label: 'Jonás', book: 'Jonas' },
  { type: 'book', label: 'Miqueas', book: 'Miqueas' },
  { type: 'book', label: 'Nahúm', book: 'Nahum' },
  { type: 'book', label: 'Habacuc', book: 'Habacuc' },
  { type: 'book', label: 'Sofonías', book: 'Sofonias' },
  { type: 'book', label: 'Hageo', book: 'Hageo' },
  { type: 'book', label: 'Zacarías', book: 'Zacarias' },
  { type: 'book', label: 'Malaquías', book: 'Malaquias' },

  { type: 'section', label: 'Nuevo Testamento' },
  { type: 'subsection', label: 'Evangelios' },
  { type: 'book', label: 'Mateo', book: 'Mateo' },
  { type: 'book', label: 'Marcos', book: 'Marcos' },
  { type: 'book', label: 'Lucas', book: 'Lucas' },
  { type: 'book', label: 'Juan', book: 'Juan' },

  { type: 'subsection', label: 'Historia' },
  { type: 'book', label: 'Hechos', book: 'Hechos' },

  { type: 'subsection', label: 'Cartas de Pablo' },
  { type: 'book', label: 'Romanos', book: 'Romanos' },
  { type: 'book', label: '1 Corintios', book: '1 Corintios' },
  { type: 'book', label: '2 Corintios', book: '2 Corintios' },
  { type: 'book', label: 'Gálatas', book: 'Galatas' },
  { type: 'book', label: 'Efesios', book: 'Efesios' },
  { type: 'book', label: 'Filipenses', book: 'Filipenses' },
  { type: 'book', label: 'Colosenses', book: 'Colosenses' },
  { type: 'book', label: '1 Tesalonicenses', book: '1 Tesalonicenses' },
  { type: 'book', label: '2 Tesalonicenses', book: '2 Tesalonicenses' },
  { type: 'book', label: '1 Timoteo', book: '1 Timoteo' },
  { type: 'book', label: '2 Timoteo', book: '2 Timoteo' },
  { type: 'book', label: 'Tito', book: 'Tito' },
  { type: 'book', label: 'Filemón', book: 'Filemon' },

  { type: 'subsection', label: 'Cartas generales' },
  { type: 'book', label: 'Hebreos', book: 'Hebreos' },
  { type: 'book', label: 'Santiago', book: 'Santiago' },
  { type: 'book', label: '1 Pedro', book: '1 Pedro' },
  { type: 'book', label: '2 Pedro', book: '2 Pedro' },
  { type: 'book', label: '1 Juan', book: '1 Juan' },
  { type: 'book', label: '2 Juan', book: '2 Juan' },
  { type: 'book', label: '3 Juan', book: '3 Juan' },
  { type: 'book', label: 'Judas', book: 'Judas' },

  { type: 'subsection', label: 'Profecía' },
  { type: 'book', label: 'Apocalipsis', book: 'Apocalipsis' },
];

/** One testament of the Catholic list, keeping its groups (Pentateuco, Libros históricos…); the testament toggle replaces its header. */
export function getCatholicBookList(testament: TestamentType): CollectionBookListItem[] {
  const start = CATHOLIC_BOOK_LIST.findIndex(item => item.type === 'section' && item.label === 'Nuevo Testamento');
  return testament === 'nuevo' ? CATHOLIC_BOOK_LIST.slice(start + 1) : CATHOLIC_BOOK_LIST.slice(1, start);
}

const CATHOLIC_BOOKS = CATHOLIC_BOOK_LIST
  .filter((item): item is { type: 'book'; label: string; book: string } => item.type === 'book')
  .map((item) => item.book);

export const BOOK_CHAPTERS: Record<string, number> = {
  Genesis: 50,
  Exodo: 40,
  Levitico: 27,
  Numeros: 36,
  Deuteronomio: 34,
  Josue: 24,
  Jueces: 21,
  Rut: 4,
  '1 Samuel': 31,
  '2 Samuel': 24,
  '1 Reyes': 22,
  '2 Reyes': 25,
  '1 Cronicas': 29,
  '2 Cronicas': 36,
  Esdras: 10,
  Nehemias: 13,
  Ester: 10,
  Job: 42,
  Salmos: 150,
  Proverbios: 31,
  Eclesiastes: 12,
  Cantares: 8,
  Isaias: 66,
  Jeremias: 52,
  Lamentaciones: 5,
  Ezequiel: 48,
  Daniel: 12,
  Oseas: 14,
  Joel: 3,
  Amos: 9,
  Abdias: 1,
  Jonas: 4,
  Miqueas: 7,
  Nahum: 3,
  Habacuc: 3,
  Sofonias: 3,
  Hageo: 2,
  Zacarias: 14,
  Malaquias: 4,
  Mateo: 28,
  Marcos: 16,
  Lucas: 24,
  Juan: 21,
  Hechos: 28,
  Romanos: 16,
  '1 Corintios': 16,
  '2 Corintios': 13,
  Galatas: 6,
  Efesios: 6,
  Filipenses: 4,
  Colosenses: 4,
  '1 Tesalonicenses': 5,
  '2 Tesalonicenses': 3,
  '1 Timoteo': 6,
  '2 Timoteo': 4,
  Tito: 3,
  Filemon: 1,
  Hebreos: 13,
  Santiago: 5,
  '1 Pedro': 5,
  '2 Pedro': 3,
  '1 Juan': 5,
  '2 Juan': 1,
  '3 Juan': 1,
  Judas: 1,
  Apocalipsis: 22,
  Bereshit: 50,
  Shemot: 40,
  'Bereshit (Génesis)': 50,
  'Shemot (Éxodo)': 40,
  'Vayikrá (Levítico)': 27,
  'Bamidbar (Números)': 36,
  'Devarim (Deuteronomio)': 34,
  'Yehoshúa (Josué)': 24,
  'Shoftim (Jueces)': 21,
  'Shmuel (Samuel)': 55,
  'Melajim (Reyes)': 47,
  'Yeshayahu (Isaías)': 66,
  'Yirmeyahu (Jeremías)': 52,
  'Yejezkel (Ezequiel)': 48,
  'Hoshea (Oseas)': 14,
  'Yoel (Joel)': 3,
  'Amos (Amós)': 9,
  'Ovadia (Abdías)': 1,
  'Yonah (Jonás)': 4,
  'Mijá (Miqueas)': 7,
  'Najum (Nahúm)': 3,
  'Jabaquq (Habacuc)': 3,
  'Tzefania (Sofonías)': 3,
  'Jagai (Hageo)': 2,
  'Zejaria (Zacarías)': 14,
  'Malají (Malaquías)': 4,
  'Tehilim (Salmos)': 150,
  'Mishlei (Proverbios)': 31,
  'Iyov (Job)': 42,
  'Shir Hashirim (Cantar de los Cantares)': 8,
  'Rut (Rut)': 4,
  'Eijá (Lamentaciones)': 5,
  'Kohelet (Eclesiastés)': 12,
  'Ester (Ester)': 10,
  'Daniel (Daniel)': 12,
  'Ezra–Nejemia (Esdras–Nehemías)': 23,
  'Divrei Hayamim (Crónicas)': 65,
  'Génesis': 50,
  'Éxodo': 40,
  'Levítico': 27,
  'Números': 36,
  'Josué': 24,
  '1 Crónicas': 29,
  '2 Crónicas': 36,
  'Nehemías': 13,
  Judit: 16,
  Tobit: 14,
  '1 Macabeos': 16,
  '2 Macabeos': 15,
  'Eclesiastés': 12,
  'Cantar de los Cantares': 8,
  Sabiduría: 19,
  'Sabiduría de Salomón': 19,
  'Eclesiástico (Sirácides)': 51,
  'Isaías': 66,
  'Jeremías': 52,
  Baruc: 6,
  'Amós': 9,
  'Abdías': 1,
  'Jonás': 4,
  'Nahúm': 3,
  'Sofonías': 3,
  'Zacarías': 14,
  'Malaquías': 4,
  Tehilim: 150,
  Mishlei: 31,
  Yeshayahu: 66,
  Mattityahu: 28,
  Yochanan: 21,
  Hitgalut: 22,
  'Hechos de los Apóstoles': 28,
  'Gálatas': 6,
  'Filemón': 1,
  'Al-Fatiha': 7,
  'Al-Baqara': 286,
  'Al-Imran': 200,
  'An-Nisa': 176,
  Yasin: 83,
  'Ar-Rahman': 78,
  'Al-Mulk': 30,
  'An-Nas': 6,
  Sabiduria: 19,
  Macabeos: 16,
};

export const OLD_TESTAMENT_BOOKS = [
  'Genesis',
  'Exodo',
  'Levitico',
  'Numeros',
  'Deuteronomio',
  'Josue',
  'Jueces',
  'Rut',
  '1 Samuel',
  '2 Samuel',
  '1 Reyes',
  '2 Reyes',
  '1 Cronicas',
  '2 Cronicas',
  'Esdras',
  'Nehemias',
  'Ester',
  'Job',
  'Salmos',
  'Proverbios',
  'Eclesiastes',
  'Cantares',
  'Isaias',
  'Jeremias',
  'Lamentaciones',
  'Ezequiel',
  'Daniel',
  'Oseas',
  'Joel',
  'Amos',
  'Abdias',
  'Jonas',
  'Miqueas',
  'Nahum',
  'Habacuc',
  'Sofonias',
  'Hageo',
  'Zacarias',
  'Malaquias',
];

export const NEW_TESTAMENT_BOOKS = [
  'Mateo',
  'Marcos',
  'Lucas',
  'Juan',
  'Hechos',
  'Romanos',
  '1 Corintios',
  '2 Corintios',
  'Galatas',
  'Efesios',
  'Filipenses',
  'Colosenses',
  '1 Tesalonicenses',
  '2 Tesalonicenses',
  '1 Timoteo',
  '2 Timoteo',
  'Tito',
  'Filemon',
  'Hebreos',
  'Santiago',
  '1 Pedro',
  '2 Pedro',
  '1 Juan',
  '2 Juan',
  '3 Juan',
  'Judas',
  'Apocalipsis',
];

export const SACRED_BOOKS: SacredBook[] = [
  {
    id: 'rv1960',
    title: 'Biblia Reina Valera 1960',
    shortName: 'RV 1960',
    subtitle: 'Versión clásica en español',
    icon: 'cross',
    colors: { cover: '#143D59', spine: '#0A2233', text: '#E7F5FF' },
    books: ['Genesis', 'Exodo', 'Salmos', 'Isaias', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
  {
    id: 'catolica',
    title: 'Biblia Católica Platense',
    shortName: 'Platense',
    subtitle: 'Versión de Mons. Juan Straubinger (1948)',
    icon: 'church',
    colors: { cover: '#4B2E83', spine: '#2A184B', text: '#F4EEFF' },
    books: ['Génesis', 'Éxodo', 'Salmos', 'Sabiduría', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
  {
    id: 'nbv',
    title: 'Nueva Biblia Viva',
    shortName: 'NBV',
    subtitle: 'Español actual, fácil de leer',
    icon: 'open-book',
    colors: { cover: '#1F5E5B', spine: '#113A38', text: '#E8FFF9' },
    books: ['Genesis', 'Exodo', 'Salmos', 'Isaias', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
  {
    id: 'lbla',
    title: 'La Biblia de las Américas',
    shortName: 'LBLA',
    subtitle: 'Traducción fiel y literal',
    icon: 'globe',
    colors: { cover: '#7A1F2B', spine: '#4A1119', text: '#FFEDEE' },
    books: ['Genesis', 'Exodo', 'Salmos', 'Isaias', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
  {
    id: 'rvc',
    title: 'Reina Valera Contemporánea',
    shortName: 'RVC',
    subtitle: 'La Reina-Valera en español actual',
    icon: 'book',
    colors: { cover: '#6B4423', spine: '#422814', text: '#FFF3E2' },
    books: ['Genesis', 'Exodo', 'Salmos', 'Isaias', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
  {
    id: 'nvi',
    title: 'Nueva Versión Internacional',
    shortName: 'NVI',
    subtitle: 'Clara y cercana al original',
    icon: 'flame',
    colors: { cover: '#2F3B4C', spine: '#1A2230', text: '#EEF3FA' },
    books: ['Genesis', 'Exodo', 'Salmos', 'Isaias', 'Mateo', 'Juan', 'Romanos', 'Apocalipsis'],
  },
];

/** Bibles with the 66 books, listed as Old and New Testament. */
const STANDARD_CANON = new Set(['rv1960', 'nbv', 'lbla', 'rvc', 'nvi']);

/** True for a Bible whose books are listed by Old and New Testament (the Catholic one too). */
export const hasTestaments = (collectionId?: string | null) => !!collectionId && (STANDARD_CANON.has(collectionId) || collectionId === 'catolica');

const LOCAL_CHAPTER_CONTENT: Record<string, ChapterContent> = {};

export function getCollectionById(collectionId?: string | null) {
  if (!collectionId) {
    return null;
  }

  return SACRED_BOOKS.find((item) => item.id === collectionId) ?? null;
}

export function getBooksForCollection(collectionId?: string | null, testament: TestamentType = 'antiguo') {
  if (!collectionId) {
    return [] as string[];
  }

  if (STANDARD_CANON.has(collectionId)) {
    return testament === 'antiguo' ? OLD_TESTAMENT_BOOKS : NEW_TESTAMENT_BOOKS;
  }

  if (collectionId === 'catolica') {
    return CATHOLIC_BOOKS;
  }

  return getCollectionById(collectionId)?.books ?? [];
}

export function getChapterCount(book?: string | null) {
  if (!book) {
    return 0;
  }

  return BOOK_CHAPTERS[book] ?? 0;
}

export function getChapterContent(collectionId: string, book: string, chapter: number): ChapterContent {
  const directKey = `${collectionId}:${book}:${chapter}`;
  const directContent = LOCAL_CHAPTER_CONTENT[directKey];

  if (directContent) {
    return directContent;
  }

  return {
    source: 'missing',
    verses: [],
    note:
      'La pantalla ya está preparada, pero este capítulo todavía no tiene un texto cargado. Para mostrarlo tal como una Biblia física, necesitas importar una fuente pública o con licencia de la traducción elegida.',
  };
}

// ── Biblias locales (empaquetadas en la app, sin internet) ────────────────────
// Each file is { [bookName]: string[][] }. An empty string right after a verse means that verse
// is part of a range printed together (e.g. "1-3" in the Nueva Biblia Viva).
// null marks a verse the translation omits (e.g. Acts 8:37 in the Platense).
type LocalBible = Record<string, (string | null)[][]>;

// Each Bible is loaded into memory the first time it is read, not when the app starts.
const LOCAL_BIBLE_FILES: Record<string, () => LocalBible> = {
  // Nueva Biblia Viva © 2008 Biblica, Inc. (Biblica® Open, CC BY-SA 4.0), from ebible.org.
  nbv: () => require('../assets/data/biblia-nbv.json'),
  // Biblia Platense (Mons. Juan Straubinger, La Plata 1948), Catholic, public domain; from CrossWire.
  // Vulgate versification: Esther 16 and Daniel 14 chapters, Psalms numbered as in the Vulgate.
  catolica: () => require('../assets/data/biblia-catolica-platense.json'),
  // From https://github.com/mrk214/bible-data-es-spa, built by scripts/generate-bible-json.js.
  lbla: () => require('../assets/data/biblia-lbla.json'),
  rvc: () => require('../assets/data/biblia-rvc.json'),
  nvi: () => require('../assets/data/biblia-nvi.json'),
};
const loadedBibles: Record<string, LocalBible> = {};
function getLocalBible(collectionId: string): LocalBible | undefined {
  const load = LOCAL_BIBLE_FILES[collectionId];
  return load ? (loadedBibles[collectionId] ??= load()) : undefined;
}

let rv1960Index: Record<string, string[][]> | null = null;
/** The RV1960 books (66 modules), loaded on first use. */
function getRv1960Index() {
  // A require() here (not an import) is what defers loading the 66 books until they are read.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (rv1960Index ??= require('./rv1960-index').rv1960StaticIndex as Record<string, string[][]>);
}

/** Source line shown at the end of each chapter. */
export const COLLECTION_CREDITS: Record<string, string> = {
  nbv: 'Nueva Biblia Viva © 2008 Biblica, Inc. · Biblica® Open, licencia CC BY-SA 4.0',
  catolica: 'Biblia Platense · Mons. Juan Straubinger (1948) · Dominio público',
  lbla: 'La Biblia de las Américas © 1986, 1995, 1997 The Lockman Foundation',
  rvc: 'Reina Valera Contemporánea™ © Sociedades Bíblicas Unidas, 2009, 2010',
  nvi: 'Nueva Versión Internacional® NVI® © 1999, 2015, 2022 Biblica, Inc.',
};

/** Chapter count of a book in a given Bible (Catholic Daniel has 14, for example). */
export function getCollectionChapterCount(collectionId: string | null | undefined, book?: string | null) {
  if (!book) return 0;
  // The 66-book Bibles all have the chapters of BOOK_CHAPTERS (checked against their files): counting
  // them needs no whole Bible in memory, so a book list opens at once.
  if (collectionId && STANDARD_CANON.has(collectionId) && BOOK_CHAPTERS[book]) return BOOK_CHAPTERS[book];
  const local = collectionId ? getLocalBible(collectionId)?.[book] : undefined;
  return local ? local.length : getChapterCount(book);
}

/** Loads a Bible's text ahead of time (while the cover opens), so its first chapter shows without a wait. */
export function preloadCollection(collectionId: string) {
  if (collectionId === 'rv1960') getRv1960Index();
  else getLocalBible(collectionId);
}

function getLocalBibleChapter(collectionId: string, book: string, chapter: number): ChapterContent {
  const chapterData = getLocalBible(collectionId)?.[book]?.[chapter - 1];
  if (!chapterData || chapterData.length === 0) {
    return { source: 'missing', verses: [], note: `El capítulo ${chapter} de ${book} no está disponible.` };
  }
  const verses: VerseLine[] = [];
  chapterData.forEach((text, i) => {
    if (text === null) return;
    if (text) { verses.push({ number: i + 1, text }); return; }
    // Part of the previous verse's range: widen its label ("1" → "1-3").
    const previous = verses[verses.length - 1];
    if (previous) previous.label = previous.number + '-' + (i + 1);
  });
  return { source: 'local', verses, heading: chapterTitle(collectionId, book, chapter) };
}

// ── RV1960 local (empaquetada en la app, sin internet) ─────────────────────
function getRv1960ChapterLocal(book: string, chapter: number): ChapterContent {
  // Normalizar nombre de libro para archivo
  const fileMap: Record<string, string> = {
    'Génesis': 'genesis',
    'Éxodo': 'exodo',
    'Levítico': 'levitico',
    'Números': 'numeros',
    'Deuteronomio': 'deuteronomio',
    'Josué': 'josue',
    'Jueces': 'jueces',
    'Rut': 'rut',
    '1 Samuel': '1_samuel',
    '2 Samuel': '2_samuel',
    '1 Reyes': '1_reyes',
    '2 Reyes': '2_reyes',
    '1 Crónicas': '1_cronicas',
    '2 Crónicas': '2_cronicas',
    'Esdras': 'esdras',
    'Nehemías': 'nehemias',
    'Ester': 'ester',
    'Job': 'job',
    'Salmos': 'salmos',
    'Proverbios': 'proverbios',
    'Eclesiastés': 'eclesiastes',
    'Cantares': 'cantares',
    'Isaías': 'isaias',
    'Jeremías': 'jeremias',
    'Lamentaciones': 'lamentaciones',
    'Ezequiel': 'ezequiel',
    'Daniel': 'daniel',
    'Oseas': 'oseas',
    'Joel': 'joel',
    'Amós': 'amos',
    'Abdías': 'abdias',
    'Jonás': 'jonas',
    'Miqueas': 'miqueas',
    'Nahúm': 'nahum',
    'Habacuc': 'habacuc',
    'Sofonías': 'sofonias',
    'Hageo': 'hageo',
    'Zacarías': 'zacarias',
    'Malaquías': 'malaquias',
    'Mateo': 'mateo',
    'Marcos': 'marcos',
    'Lucas': 'lucas',
    'Juan': 'juan',
    'Hechos': 'hechos',
    'Romanos': 'romanos',
    '1 Corintios': '1_corintios',
    '2 Corintios': '2_corintios',
    'Gálatas': 'galatas',
    'Efesios': 'efesios',
    'Filipenses': 'filipenses',
    'Colosenses': 'colosenses',
    '1 Tesalonicenses': '1_tesalonicenses',
    '2 Tesalonicenses': '2_tesalonicenses',
    '1 Timoteo': '1_timoteo',
    '2 Timoteo': '2_timoteo',
    'Tito': 'tito',
    'Filemón': 'filemon',
    'Hebreos': 'hebreos',
    'Santiago': 'santiago',
    '1 Pedro': '1_pedro',
    '2 Pedro': '2_pedro',
    '1 Juan': '1_juan',
    '2 Juan': '2_juan',
    '3 Juan': '3_juan',
    'Judas': 'judas',
    'Apocalipsis': 'apocalipsis',
  };
  const fileKey = fileMap[book] || book.toLowerCase().replace(/ /g, '_').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  const chapters = getRv1960Index()[fileKey];
  if (!chapters) {
    return { source: 'missing', verses: [], note: `No se encontró el libro local de RV1960 para ${book}.` };
  }
  const chapterArr = chapters[chapter - 1];
  if (!chapterArr || chapterArr.length === 0) {
    return {
      source: 'missing',
      verses: [],
      note: `El capítulo ${chapter} de ${book} no está disponible en los datos locales de RV1960.`,
    };
  }
  const verses: VerseLine[] = chapterArr.map((text: string, i: number) => ({ number: i + 1, text: String(text ?? '').trim() }));
  return { source: 'local', verses, heading: `${displayBookName(book)} ${chapter}` };
}

/** Verses of a chapter from the text bundled in the app (no network), as the reader shows them. */
export function getLocalChapterVerses(collectionId: string, book: string, chapter: number): VerseLine[] {
  if (collectionId === 'rv1960') return getRv1960ChapterLocal(book, chapter).verses;
  return LOCAL_BIBLE_FILES[collectionId] ? getLocalBibleChapter(collectionId, book, chapter).verses : [];
}

export async function fetchChapterContent(
  collectionId: string,
  book: string,
  chapter: number,
  options?: { tanakhLanguage?: TanakhLanguage },
): Promise<ChapterContent> {
  if (collectionId === 'rv1960') {
    // The whole RV1960 is bundled in the app: no network.
    return getRv1960ChapterLocal(book, chapter);
  }
  if (LOCAL_BIBLE_FILES[collectionId]) {
    return getLocalBibleChapter(collectionId, book, chapter);
  }
  return { source: 'missing', verses: [], note: 'Esta Biblia no está disponible.' };
}
