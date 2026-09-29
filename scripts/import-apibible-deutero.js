const fs = require('fs');
const path = require('path');
const https = require('https');

const API_HOST = 'api.scripture.api.bible';
const API_BASE = '/v1';
const API_KEY = process.env.API_BIBLE_KEY;
const BIBLE_ID = process.env.API_BIBLE_ID;
const LANGUAGE = process.env.API_BIBLE_LANGUAGE || 'spa';

const OUTPUT_FILE = path.resolve(process.cwd(), 'assets/data/catolica-deutero.json');

const TARGET_BOOKS = [
  { localName: 'Tobit', match: ['tobit', 'tobias'] },
  { localName: 'Judit', match: ['judit', 'judit'] },
  { localName: 'Sabiduría', match: ['sabiduria', 'wisdom', 'sabiduria de salomon'] },
  { localName: 'Eclesiástico (Sirácides)', match: ['eclesiastico', 'siracides', 'sirach', 'ecclesiasticus'] },
  { localName: 'Baruc', match: ['baruc', 'baruch'] },
  { localName: '1 Macabeos', match: ['1 macabeos', '1 maccabees', 'first maccabees'] },
  { localName: '2 Macabeos', match: ['2 macabeos', '2 maccabees', 'second maccabees'] },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function requestJson(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path: `${API_BASE}${apiPath}`,
      method: 'GET',
      headers: {
        'api-key': API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`JSON inválido: ${String(err.message || err)}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function resolveBibleId() {
  if (BIBLE_ID) {
    return BIBLE_ID;
  }

  const payload = await requestJson(`/bibles?language=${encodeURIComponent(LANGUAGE)}&include-full-details=true`);
  const bibles = Array.isArray(payload.data) ? payload.data : [];

  if (bibles.length === 0) {
    throw new Error(`No se encontraron biblias para language=${LANGUAGE}.`);
  }

  throw new Error(
    `Falta API_BIBLE_ID. Encontradas ${bibles.length} biblias. Ejecuta primero: npm run scan:apibible`,
  );
}

function findBookByTarget(books, target) {
  const tokens = target.match.map(normalizeText);

  return books.find((book) => {
    const haystack = normalizeText([
      book.id,
      book.name,
      book.nameLong,
      book.abbreviation,
    ].join(' '));

    return tokens.some((token) => haystack.includes(token));
  }) || null;
}

async function getChapters(bibleId, bookId) {
  const payload = await requestJson(`/bibles/${encodeURIComponent(bibleId)}/books/${encodeURIComponent(bookId)}/chapters`);
  return Array.isArray(payload.data) ? payload.data : [];
}

async function getVersesFromChapter(bibleId, chapterId) {
  const basePath = `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}/verses`;

  try {
    const payload = await requestJson(`${basePath}?content-type=text`);
    const verses = Array.isArray(payload.data) ? payload.data : [];

    return verses
      .map((verse) => stripHtml(verse.content || verse.text || ''))
      .filter((text) => text.length > 0);
  } catch {
    const chapterPayload = await requestJson(
      `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}?content-type=text`,
    );

    const raw = chapterPayload && chapterPayload.data ? chapterPayload.data.content || '' : '';
    const text = stripHtml(raw);
    return text ? [text] : [];
  }
}

function readCurrentOutput() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return {
      Tobit: [],
      Judit: [],
      'Sabiduría': [],
      'Eclesiástico (Sirácides)': [],
      Baruc: [],
      '1 Macabeos': [],
      '2 Macabeos': [],
    };
  }

  const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: Falta API_BIBLE_KEY.');
    console.error('Ejemplo PowerShell: $env:API_BIBLE_KEY="tu_api_key"');
    process.exit(1);
  }

  const bibleId = await resolveBibleId();
  console.log(`Usando bibleId=${bibleId}`);

  const booksPayload = await requestJson(`/bibles/${encodeURIComponent(bibleId)}/books`);
  const books = Array.isArray(booksPayload.data) ? booksPayload.data : [];

  const output = readCurrentOutput();
  const missingTargets = [];

  for (const target of TARGET_BOOKS) {
    process.stdout.write(`- ${target.localName}... `);

    const matchedBook = findBookByTarget(books, target);
    if (!matchedBook) {
      missingTargets.push(target.localName);
      console.log('no encontrado en esta versión');
      continue;
    }

    const chapters = await getChapters(bibleId, matchedBook.id);
    if (chapters.length === 0) {
      output[target.localName] = [];
      console.log('sin capítulos');
      continue;
    }

    const collectedChapters = [];

    for (const chapter of chapters) {
      const verses = await getVersesFromChapter(bibleId, chapter.id);
      collectedChapters.push(verses);
    }

    output[target.localName] = collectedChapters;
    console.log(`importado (${collectedChapters.length} capítulos)`);
  }

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`\nArchivo actualizado: ${OUTPUT_FILE}`);
  if (missingTargets.length > 0) {
    console.log(`Libros no encontrados en esta versión: ${missingTargets.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(`ERROR inesperado: ${String(err.message || err)}`);
  process.exit(1);
});
