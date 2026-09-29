export function splitTextIntoBlocks(text: string, maxChars: number = 150): string[] {
  const normalizedText = normalizeTextForSpeech(text);
  if (!normalizedText) {
    return [];
  }

  const sentences =
    normalizedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalizedText];
  const blocks: string[] = [];
  let currentBlock = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) {
      continue;
    }

    if (trimmedSentence.length <= maxChars) {
      if ((`${currentBlock} ${trimmedSentence}`).trim().length <= maxChars) {
        currentBlock = `${currentBlock} ${trimmedSentence}`.trim();
      } else {
        if (currentBlock) blocks.push(currentBlock.trim());
        currentBlock = trimmedSentence;
      }
    } else {
      if (currentBlock) {
        blocks.push(currentBlock.trim());
        currentBlock = '';
      }

      const clauses =
        trimmedSentence.match(/[^,;:\n]+[,;:\n]?|[^,;:\n]+$/g) || [trimmedSentence];
      let currentClauseBlock = '';

      for (const clause of clauses) {
        const trimmedClause = clause.trim();
        if (!trimmedClause) continue;

        if (trimmedClause.length <= maxChars) {
          if ((`${currentClauseBlock} ${trimmedClause}`).trim().length <= maxChars) {
            currentClauseBlock = `${currentClauseBlock} ${trimmedClause}`.trim();
          } else {
            if (currentClauseBlock) blocks.push(currentClauseBlock.trim());
            currentClauseBlock = trimmedClause;
          }
          continue;
        }

        if (currentClauseBlock) {
          blocks.push(currentClauseBlock.trim());
          currentClauseBlock = '';
        }

      const words = trimmedClause.split(/\s+/);
      let currentWordBlock = '';

      for (const word of words) {
        if (!word) continue;
        if (word.length > maxChars) {
          if (currentWordBlock) {
            blocks.push(currentWordBlock.trim());
            currentWordBlock = '';
          }

          for (let start = 0; start < word.length; start += maxChars) {
            blocks.push(word.slice(start, start + maxChars).trim());
          }
          continue;
        }

        if ((`${currentWordBlock} ${word}`).trim().length <= maxChars) {
          currentWordBlock = `${currentWordBlock} ${word}`.trim();
        } else {
          if (currentWordBlock) blocks.push(currentWordBlock.trim());
          currentWordBlock = word;
        }
        }

        if (currentWordBlock) {
          blocks.push(currentWordBlock.trim());
        }
      }

      if (currentClauseBlock) {
        blocks.push(currentClauseBlock.trim());
      }
    }
  }

  if (currentBlock) blocks.push(currentBlock.trim());

  return blocks;
}

/**
 * Normaliza texto para síntesis de voz
 */
export function normalizeTextForSpeech(text: string): string {
  return (
    text
      .normalize('NFKC')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/\u00AD/g, '')
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/ﬀ/g, 'ff')
      .replace(/ﬃ/g, 'ffi')
      .replace(/ﬄ/g, 'ffl')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      // Remover caracteres especiales problemáticos
      .replace(/[©®™]/g, '')
      // Normalizar espacios
      .replace(/\s+/g, ' ')
      // Remover URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remover emails
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
      .trim()
  );
}

// ---- Reading preparation: expands what a TTS engine mispronounces and splits by sentence ----

const BIBLE_BOOKS: Record<string, string> = {
  gn: 'Génesis', gen: 'Génesis', génesis: 'Génesis', genesis: 'Génesis', ex: 'Éxodo', éx: 'Éxodo', exo: 'Éxodo', éxodo: 'Éxodo', exodo: 'Éxodo',
  lv: 'Levítico', lev: 'Levítico', levítico: 'Levítico', nm: 'Números', num: 'Números', núm: 'Números', números: 'Números',
  dt: 'Deuteronomio', deut: 'Deuteronomio', deuteronomio: 'Deuteronomio', jos: 'Josué', josué: 'Josué', jue: 'Jueces', jueces: 'Jueces',
  rt: 'Rut', rut: 'Rut', s: 'Samuel', sam: 'Samuel', samuel: 'Samuel', r: 'Reyes', re: 'Reyes', rey: 'Reyes', reyes: 'Reyes',
  cr: 'Crónicas', cro: 'Crónicas', crón: 'Crónicas', crónicas: 'Crónicas', esd: 'Esdras', esdras: 'Esdras', neh: 'Nehemías', nehemías: 'Nehemías',
  est: 'Ester', ester: 'Ester', job: 'Job', sal: 'Salmos', salmo: 'Salmo', salmos: 'Salmos', pr: 'Proverbios', prov: 'Proverbios', proverbios: 'Proverbios',
  ec: 'Eclesiastés', ecl: 'Eclesiastés', eclesiastés: 'Eclesiastés', cnt: 'Cantares', cant: 'Cantares', cantares: 'Cantares',
  is: 'Isaías', isa: 'Isaías', isaías: 'Isaías', jer: 'Jeremías', jeremías: 'Jeremías', lm: 'Lamentaciones', lam: 'Lamentaciones', lamentaciones: 'Lamentaciones',
  ez: 'Ezequiel', eze: 'Ezequiel', ezequiel: 'Ezequiel', dn: 'Daniel', dan: 'Daniel', daniel: 'Daniel', os: 'Oseas', oseas: 'Oseas', jl: 'Joel', joel: 'Joel',
  am: 'Amós', amós: 'Amós', abd: 'Abdías', abdías: 'Abdías', jon: 'Jonás', jonás: 'Jonás', mi: 'Miqueas', miq: 'Miqueas', miqueas: 'Miqueas',
  nah: 'Nahúm', nahúm: 'Nahúm', hab: 'Habacuc', habacuc: 'Habacuc', sof: 'Sofonías', sofonías: 'Sofonías', hag: 'Hageo', hageo: 'Hageo',
  zac: 'Zacarías', zacarías: 'Zacarías', mal: 'Malaquías', malaquías: 'Malaquías', mt: 'Mateo', mat: 'Mateo', mateo: 'Mateo',
  mc: 'Marcos', mr: 'Marcos', mar: 'Marcos', marcos: 'Marcos', lc: 'Lucas', luc: 'Lucas', lucas: 'Lucas', jn: 'Juan', juan: 'Juan',
  hch: 'Hechos', hech: 'Hechos', hechos: 'Hechos', ro: 'Romanos', rom: 'Romanos', romanos: 'Romanos', co: 'Corintios', cor: 'Corintios', corintios: 'Corintios',
  gá: 'Gálatas', gál: 'Gálatas', gal: 'Gálatas', gálatas: 'Gálatas', ef: 'Efesios', efe: 'Efesios', efesios: 'Efesios',
  fil: 'Filipenses', flp: 'Filipenses', filipenses: 'Filipenses', col: 'Colosenses', colosenses: 'Colosenses',
  ts: 'Tesalonicenses', tes: 'Tesalonicenses', tesalonicenses: 'Tesalonicenses', ti: 'Timoteo', tim: 'Timoteo', timoteo: 'Timoteo',
  tit: 'Tito', tito: 'Tito', flm: 'Filemón', filemón: 'Filemón', heb: 'Hebreos', hebreos: 'Hebreos', stg: 'Santiago', sant: 'Santiago', santiago: 'Santiago',
  p: 'Pedro', pe: 'Pedro', ped: 'Pedro', pedro: 'Pedro', jud: 'Judas', judas: 'Judas', ap: 'Apocalipsis', apoc: 'Apocalipsis', apocalipsis: 'Apocalipsis',
};
// Books that only exist as 1/2/3 X; without the number these abbreviations are ordinary words.
const NUMBERED_ONLY = new Set(['s', 'r', 're', 'rey', 'cr', 'cro', 'crón', 'co', 'ts', 'ti', 'p', 'pe', 'ped']);
const ORDINAL_BOOK = ['', 'Primera de', 'Segunda de', 'Tercera de'];
const LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const BIBLE_REF = new RegExp('(^|[^' + LETTERS + '\\d])(?:([123])\\s?)?([' + LETTERS + ']{1,12})\\.?\\s+(\\d{1,3}):(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?(?![\\d:])', 'g');

function expandBibleReferences(text: string): string {
  return text.replace(BIBLE_REF, (match, before: string, number: string | undefined, rawBook: string, chapter: string, verse: string, end?: string) => {
    const key = rawBook.toLowerCase();
    const book = BIBLE_BOOKS[key];
    if (!book || (NUMBERED_ONLY.has(key) && !number)) return match;
    const name = number ? ORDINAL_BOOK[Number(number)] + ' ' + book : book;
    return before + name + ', capítulo ' + chapter + (end ? ', versículos ' + verse + ' al ' + end : ', versículo ' + verse);
  });
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function romanToNumber(value: string): number | null {
  const lower = value.toLowerCase();
  if (!/^(m{0,3})(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(lower)) return null;
  let total = 0;
  for (let i = 0; i < lower.length; i++) {
    const current = ROMAN[lower[i]], next = ROMAN[lower[i + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total || null;
}
const ROMAN_AFTER = new RegExp('(^|[^' + LETTERS + '])(tomo|libro|cap[íi]tulo|parte|volumen|siglo|secci[óo]n|salmo|lecci[óo]n|unidad|tema|anexo|ap[ée]ndice|t[íi]tulo|art[íi]culo)\\s+([IVXLCDM]{1,7})(?![' + LETTERS + '\\d])', 'gi');

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bp\.\s?ej\./gi, 'por ejemplo'],
  [/\ba\.\s?C\./g, 'antes de Cristo'], [/\bd\.\s?C\./g, 'después de Cristo'],
  [/\bcaps\.(?=\s)/gi, 'capítulos'], [/\bcap\.(?=\s)/gi, 'capítulo'],
  [/(^|\s)págs\.(?=\s)/gi, '$1páginas'], [/(^|\s)pág\.(?=\s)/gi, '$1página'],
  [/(^|\s)vols\.(?=\s)/gi, '$1volúmenes'], [/(^|\s)vol\.(?=\s)/gi, '$1volumen'],
  [/\bvv\.(?=\s?\d)/gi, 'versículos'], [/\bv\.(?=\s?\d)/gi, 'versículo'],
  [/(^|\s)n\.?º(?=\s?\d)/gi, '$1número'], [/(^|\s)núm\.(?=\s?\d)/gi, '$1número'],
  [/\bfig\.(?=\s)/gi, 'figura'], [/\bej\.(?=\s)/gi, 'ejemplo'], [/\betc\./gi, 'etcétera'],
  [/\baprox\.(?=\s)/gi, 'aproximadamente'], [/\bart\.(?=\s?\d)/gi, 'artículo'], [/\bcf\.(?=\s)/gi, 'compárese'],
  [/\bSr\.(?=\s)/g, 'señor'], [/\bSra\.(?=\s)/g, 'señora'], [/\bSrta\.(?=\s)/g, 'señorita'],
  [/\bDr\.(?=\s)/g, 'doctor'], [/\bDra\.(?=\s)/g, 'doctora'], [/\bUd\.(?=\s)/g, 'usted'], [/\bUds\.(?=\s)/g, 'ustedes'],
];

/** Rewrites one paragraph so a Spanish TTS voice reads it naturally. */
export function expandForSpeech(text: string): string {
  let result = normalizeTextForSpeech(text);
  result = expandBibleReferences(result);
  result = result.replace(ROMAN_AFTER, (match, before: string, word: string, roman: string) => {
    const value = romanToNumber(roman);
    return value ? before + word + ' ' + value : match;
  });
  for (const [pattern, replacement] of ABBREVIATIONS) result = result.replace(pattern, replacement);
  return result
    .replace(/[•▪▫►▶■□◆◇●○◦‣⁃※☐☑✓✔➢➤→←]/g, ' ')
    .replace(/(\d)\s?%/g, '$1 por ciento')
    .replace(/(\d)\s?°C\b/g, '$1 grados centígrados').replace(/(\d)\s?°/g, '$1 grados')
    .replace(/§\s?(?=\d)/g, 'sección ')
    .replace(/\s&\s/g, ' y ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/…|\.{3,}/g, '. ')
    .replace(/([!?¡¿])\1+/g, '$1')
    .replace(/[«»“”„"‹›[\]{}*_#|~^<>]/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/^[\s,.;:]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns page texts into the flat sentence queue used by the background reader. */
export function buildSpeechQueue(pages: { page: number; text: string }[], maxChars: number = 400) {
  const queue = { pages: [] as number[], texts: [] as string[], paragraphEnds: [] as boolean[] };
  for (const { page, text } of pages) {
    for (const paragraph of prepareSpeech(text || '', maxChars)) {
      paragraph.forEach((sentence, index) => {
        queue.pages.push(page);
        queue.texts.push(sentence);
        queue.paragraphEnds.push(index === paragraph.length - 1);
      });
    }
  }
  return queue;
}

/**
 * Splits page text into paragraphs of short utterances (sentence by sentence, never longer
 * than maxChars) so the engine pauses where a human reader would.
 */
export function prepareSpeech(text: string, maxChars: number = 400): string[][] {
  return text.split(/\n\s*\n/)
    .map(paragraph => expandForSpeech(paragraph))
    .filter(Boolean)
    .map(paragraph => {
      // Split only where punctuation is followed by a space, so "1.000" or "3.5" stay whole.
      const sentences = paragraph.replace(/([.!?]+)\s+/g, '$1\n').split('\n');
      const out: string[] = [];
      let current = '';
      for (const raw of sentences) {
        const sentence = raw.trim();
        if (!sentence) continue;
        // Very short sentences ("Sí.") ride with the next one to avoid choppy pauses.
        if (current && current.length < 40 && (current + ' ' + sentence).length <= maxChars) { current += ' ' + sentence; continue; }
        if (current) out.push(current);
        current = sentence;
        if (current.length > maxChars) {
          const parts = splitTextIntoBlocks(current, maxChars);
          current = parts.pop() || '';
          out.push(...parts);
        }
      }
      if (current) out.push(current);
      return out;
    })
    .filter(paragraph => paragraph.length);
}
