const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = process.env.EBIBLE_BASE_URL || 'https://ebible.org/spablm';
const OUTPUT_FILE = path.resolve(process.cwd(), 'assets/data/catolica-deutero.json');

const BOOKS = [
  { localName: 'Tobit', code: 'TOB', chapters: 14 },
  { localName: 'Judit', code: 'JDT', chapters: 16 },
  { localName: 'Sabiduría', code: 'WIS', chapters: 19 },
  { localName: 'Eclesiástico (Sirácides)', code: 'SIR', chapters: 51 },
  { localName: 'Baruc', code: 'BAR', chapters: 6 },
  { localName: '1 Macabeos', code: '1MA', chapters: 16 },
  { localName: '2 Macabeos', code: '2MA', chapters: 15 },
];

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} en ${url}`));
          return;
        }
        resolve(body);
      });
    }).on('error', (err) => reject(err));
  });
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<a[^>]*class=["']notemark["'][^>]*>[\s\S]*?<\/a>/gi, ' ')
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractVersesFromHtml(html) {
  const mainStart = html.indexOf('<div class="main">');
  const main = mainStart >= 0 ? html.slice(mainStart) : html;

  const verseRegex = /<span class="verse" id="V(\d+)">[\s\S]*?<\/span>/g;
  const markers = [];
  let match;

  while ((match = verseRegex.exec(main)) !== null) {
    markers.push({
      verse: Number(match[1]),
      start: match.index,
      markerEnd: match.index + match[0].length,
    });
  }

  if (markers.length === 0) {
    return [];
  }

  const verses = [];
  for (let i = 0; i < markers.length; i += 1) {
    const current = markers[i];
    const next = markers[i + 1];
    const contentEnd = next ? next.start : main.length;
    const rawContent = main.slice(current.markerEnd, contentEnd);
    const text = stripHtml(rawContent);

    if (text.length > 0) {
      verses.push({ number: current.verse, text });
    }
  }

  return verses
    .sort((a, b) => a.number - b.number)
    .map((item) => item.text);
}

function readCurrentOutput() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function importBook(book) {
  const chapters = [];

  for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    const chapterPath = `${book.code}${String(chapter).padStart(2, '0')}.htm`;
    const url = `${BASE_URL}/${chapterPath}`;
    const html = await requestText(url);
    const verses = extractVersesFromHtml(html);

    if (verses.length === 0) {
      throw new Error(`No se pudieron extraer versículos de ${url}`);
    }

    chapters.push(verses);
    process.stdout.write(`    capítulo ${chapter}/${book.chapters}\r`);
  }

  process.stdout.write(' '.repeat(60) + '\r');
  return chapters;
}

async function main() {
  console.log(`Fuente: ${BASE_URL}`);

  const output = readCurrentOutput();

  for (const book of BOOKS) {
    console.log(`- Importando ${book.localName}...`);
    const chapters = await importBook(book);
    output[book.localName] = chapters;
    console.log(`  OK: ${chapters.length} capítulos importados.`);
  }

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`\nArchivo actualizado: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(`ERROR: ${String(err.message || err)}`);
  process.exit(1);
});
