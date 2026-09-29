const fs = require('fs');
const path = require('path');
const https = require('https');

const API_HOST = 'api.scripture.api.bible';
const API_BASE = '/v1';
const API_KEY = process.env.API_BIBLE_KEY;
const LANGUAGE = process.env.API_BIBLE_LANGUAGE || 'spa';
const MAX_BIBLES = Number(process.env.API_BIBLE_MAX || '0');

const DEUTERO_TARGETS = [
  'tobit',
  'judit',
  'sabiduria',
  'eclesiastico',
  'siracides',
  'sirach',
  'baruc',
  '1 macabeos',
  '2 macabeos',
  '1 maccabees',
  '2 maccabees',
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

function extractBooks(payload) {
  if (!payload || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data.map((book) => ({
    id: String(book.id || ''),
    name: String(book.name || ''),
    nameLong: String(book.nameLong || ''),
    abbreviation: String(book.abbreviation || ''),
  }));
}

function hasDeuteroBook(book) {
  const bag = normalizeText([
    book.id,
    book.name,
    book.nameLong,
    book.abbreviation,
  ].join(' '));

  return DEUTERO_TARGETS.some((token) => bag.includes(token));
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: Falta API_BIBLE_KEY en variables de entorno.');
    console.error('Ejemplo PowerShell: $env:API_BIBLE_KEY="tu_api_key"');
    process.exit(1);
  }

  console.log(`Consultando API.Bible para language=${LANGUAGE}...`);
  const biblesPayload = await requestJson(`/bibles?language=${encodeURIComponent(LANGUAGE)}&include-full-details=true`);

  const bibles = Array.isArray(biblesPayload.data) ? biblesPayload.data : [];
  const selectedBibles = MAX_BIBLES > 0 ? bibles.slice(0, MAX_BIBLES) : bibles;
  console.log(`Biblias recibidas: ${bibles.length}. Procesando: ${selectedBibles.length}.`);

  const scanResults = [];

  for (const bible of selectedBibles) {
    const bibleId = String(bible.id || '');
    const bibleName = String(bible.name || '');
    const bibleAbbr = String(bible.abbreviation || '');

    if (!bibleId) {
      continue;
    }

    process.stdout.write(`- ${bibleName} (${bibleId})... `);

    try {
      const booksPayload = await requestJson(`/bibles/${encodeURIComponent(bibleId)}/books`);
      const books = extractBooks(booksPayload);
      const matchedBooks = books.filter(hasDeuteroBook);

      scanResults.push({
        bibleId,
        abbreviation: bibleAbbr,
        name: bibleName,
        language: bible.language && bible.language.id ? String(bible.language.id) : LANGUAGE,
        totalBooks: books.length,
        matchedDeuteroBooks: matchedBooks,
      });

      if (matchedBooks.length > 0) {
        console.log(`OK (${matchedBooks.length} deuterocanónicos detectados)`);
      } else {
        console.log('sin deuterocanónicos detectados');
      }
    } catch (err) {
      console.log(`error: ${String(err.message || err)}`);
      scanResults.push({
        bibleId,
        abbreviation: bibleAbbr,
        name: bibleName,
        language: bible.language && bible.language.id ? String(bible.language.id) : LANGUAGE,
        totalBooks: 0,
        matchedDeuteroBooks: [],
        error: String(err.message || err),
      });
    }
  }

  const onlyCandidates = scanResults.filter((entry) => Array.isArray(entry.matchedDeuteroBooks) && entry.matchedDeuteroBooks.length > 0);

  const output = {
    scannedAt: new Date().toISOString(),
    language: LANGUAGE,
    totalBiblesScanned: scanResults.length,
    candidates: onlyCandidates,
    results: scanResults,
  };

  const outputPath = path.resolve(process.cwd(), 'assets/data/apibible-spanish-deutero-scan.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log('\nResumen:');
  console.log(`- Candidatas con deuterocanónicos: ${onlyCandidates.length}`);
  console.log(`- Reporte guardado en: ${outputPath}`);

  if (onlyCandidates.length > 0) {
    console.log('\nCandidatas detectadas:');
    for (const item of onlyCandidates) {
      const names = item.matchedDeuteroBooks.map((book) => book.name || book.nameLong || book.id).join(', ');
      console.log(`- ${item.name} (${item.bibleId}): ${names}`);
    }
  }
}

main().catch((err) => {
  console.error(`ERROR inesperado: ${String(err.message || err)}`);
  process.exit(1);
});
