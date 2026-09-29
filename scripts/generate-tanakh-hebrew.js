/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');

const API_BASE = 'https://www.sefaria.org/api/texts';

const BOOK_MAP = {
  'Bereshit (Génesis)': ['Genesis'],
  'Shemot (Éxodo)': ['Exodus'],
  'Vayikrá (Levítico)': ['Leviticus'],
  'Bamidbar (Números)': ['Numbers'],
  'Devarim (Deuteronomio)': ['Deuteronomy'],
  'Yehoshúa (Josué)': ['Joshua'],
  'Shoftim (Jueces)': ['Judges'],
  'Shmuel (Samuel)': ['I Samuel', 'II Samuel'],
  'Melajim (Reyes)': ['I Kings', 'II Kings'],
  'Yeshayahu (Isaías)': ['Isaiah'],
  'Yirmeyahu (Jeremías)': ['Jeremiah'],
  'Yejezkel (Ezequiel)': ['Ezekiel'],
  'Hoshea (Oseas)': ['Hosea'],
  'Yoel (Joel)': ['Joel'],
  'Amos (Amós)': ['Amos'],
  'Ovadia (Abdías)': ['Obadiah'],
  'Yonah (Jonás)': ['Jonah'],
  'Mijá (Miqueas)': ['Micah'],
  'Najum (Nahúm)': ['Nahum'],
  'Jabaquq (Habacuc)': ['Habakkuk'],
  'Tzefania (Sofonías)': ['Zephaniah'],
  'Jagai (Hageo)': ['Haggai'],
  'Zejaria (Zacarías)': ['Zechariah'],
  'Malají (Malaquías)': ['Malachi'],
  'Tehilim (Salmos)': ['Psalms'],
  'Mishlei (Proverbios)': ['Proverbs'],
  'Iyov (Job)': ['Job'],
  'Shir Hashirim (Cantar de los Cantares)': ['Song of Songs'],
  'Rut (Rut)': ['Ruth'],
  'Eijá (Lamentaciones)': ['Lamentations'],
  'Kohelet (Eclesiastés)': ['Ecclesiastes'],
  'Ester (Ester)': ['Esther'],
  'Daniel (Daniel)': ['Daniel'],
  'Ezra–Nejemia (Esdras–Nehemías)': ['Ezra', 'Nehemiah'],
  'Divrei Hayamim (Crónicas)': ['I Chronicles', 'II Chronicles'],
};

const SOURCE_BOOK_CHAPTERS = {
  Genesis: 50,
  Exodus: 40,
  Leviticus: 27,
  Numbers: 36,
  Deuteronomy: 34,
  Joshua: 24,
  Judges: 21,
  'I Samuel': 31,
  'II Samuel': 24,
  'I Kings': 22,
  'II Kings': 25,
  Isaiah: 66,
  Jeremiah: 52,
  Ezekiel: 48,
  Hosea: 14,
  Joel: 4,
  Amos: 9,
  Obadiah: 1,
  Jonah: 4,
  Micah: 7,
  Nahum: 3,
  Habakkuk: 3,
  Zephaniah: 3,
  Haggai: 2,
  Zechariah: 14,
  Malachi: 3,
  Psalms: 150,
  Proverbs: 31,
  Job: 42,
  'Song of Songs': 8,
  Ruth: 4,
  Lamentations: 5,
  Ecclesiastes: 12,
  Esther: 10,
  Daniel: 12,
  Ezra: 10,
  Nehemiah: 13,
  'I Chronicles': 29,
  'II Chronicles': 36,
};

const ENTITY_MAP = {
  '&nbsp;': ' ',
  '&thinsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

function decodeEntities(text) {
  return text
    .replace(/&(nbsp|thinsp|amp|quot|apos);/g, (entity) => ENTITY_MAP[entity] || ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripHtml(text) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[פס]\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanVerse(raw) {
  return stripHtml(decodeEntities(String(raw ?? '')));
}

async function fetchChapterVerses(bookName, chapterNumber) {
  const encodedRef = encodeURIComponent(`${bookName}.${chapterNumber}`);
  const url = `${API_BASE}/${encodedRef}?lang=he&context=0`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error al descargar ${bookName} ${chapterNumber}: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.he) || payload.he.length === 0) {
    throw new Error(`Formato inesperado para ${bookName} ${chapterNumber}`);
  }

  return payload.he.map(cleanVerse).filter((line) => line.length > 0);
}

async function fetchBookChapters(bookName) {
  const chapterCount = SOURCE_BOOK_CHAPTERS[bookName];
  if (!chapterCount) {
    throw new Error(`No se encontró conteo de capítulos para ${bookName}`);
  }

  const chapters = [];
  for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
    const verses = await fetchChapterVerses(bookName, chapter);
    chapters.push(verses);
  }

  return chapters;
}

async function generate() {
  const output = {};

  for (const [appBookName, sourceBooks] of Object.entries(BOOK_MAP)) {
    const chapters = [];

    for (const sourceBook of sourceBooks) {
      console.log(`Descargando ${sourceBook}...`);
      const sourceChapters = await fetchBookChapters(sourceBook);
      chapters.push(...sourceChapters);
    }

    output[appBookName] = chapters;
  }

  const outPath = path.join(__dirname, '..', 'assets', 'data', 'tanakh-hebrew.json');
  await fs.writeFile(outPath, JSON.stringify(output));

  console.log(`Archivo generado: ${outPath}`);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
