const fs = require('fs');
const path = require('path');

const EXPECTED_BOOKS = [
  'Tobit',
  'Judit',
  'Sabiduría',
  'Eclesiástico (Sirácides)',
  'Baruc',
  '1 Macabeos',
  '2 Macabeos',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function main() {
  const relativeFile = 'assets/data/catolica-deutero.json';
  const filePath = path.resolve(process.cwd(), relativeFile);

  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: No se encontró el archivo ${relativeFile}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`ERROR: No se pudo leer ${relativeFile}: ${String(error.message || error)}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.error(`ERROR: JSON inválido en ${relativeFile}: ${String(error.message || error)}`);
    process.exit(1);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('ERROR: La raíz del archivo debe ser un objeto JSON (clave: libro, valor: capítulos).');
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  for (const book of EXPECTED_BOOKS) {
    if (!(book in data)) {
      errors.push(`Falta la clave obligatoria: "${book}".`);
      continue;
    }

    const chapters = data[book];

    if (!Array.isArray(chapters)) {
      errors.push(`"${book}" debe ser un arreglo de capítulos.`);
      continue;
    }

    if (chapters.length === 0) {
      warnings.push(`"${book}" no tiene capítulos cargados todavía.`);
      continue;
    }

    chapters.forEach((chapter, chapterIndex) => {
      const chapterNumber = chapterIndex + 1;

      if (!Array.isArray(chapter)) {
        errors.push(`"${book}", capítulo ${chapterNumber}: debe ser un arreglo de versículos.`);
        return;
      }

      if (chapter.length === 0) {
        warnings.push(`"${book}", capítulo ${chapterNumber}: no tiene versículos.`);
        return;
      }

      chapter.forEach((verse, verseIndex) => {
        const verseNumber = verseIndex + 1;
        if (!isNonEmptyString(verse)) {
          errors.push(`"${book}", capítulo ${chapterNumber}, versículo ${verseNumber}: debe ser string no vacío.`);
        }
      });
    });
  }

  for (const key of Object.keys(data)) {
    if (!EXPECTED_BOOKS.includes(key)) {
      warnings.push(`Clave no esperada en el JSON: "${key}".`);
    }
  }

  if (warnings.length > 0) {
    console.log('ADVERTENCIAS:');
    warnings.forEach((item) => console.log(`- ${item}`));
  }

  if (errors.length > 0) {
    console.error('\nERRORES:');
    errors.forEach((item) => console.error(`- ${item}`));
    console.error('\nResultado: validación fallida.');
    process.exit(1);
  }

  console.log('\nResultado: estructura válida.');
  if (warnings.length > 0) {
    console.log('Nota: hay advertencias de contenido incompleto.');
  }
}

main();
