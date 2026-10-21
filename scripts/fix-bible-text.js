/**
 * Corrections to the Bible texts bundled in the app (every Bible except the RV1960, which is the
 * official text and stays as it is). Safe to run more than once:
 *
 *   node scripts/fix-bible-text.js
 *
 * Run it again after rebuilding a Bible with generate-nbv.js or generate-bible-json.js.
 *
 * - Continuation marks: in print, a » ” ’ (or a "- " in the LBLA) opening a paragraph says the same
 *   person goes on speaking; in a verse shown on its own it reads as a stray mark. A closing quote
 *   always follows a word, never a space, so only the opening ones are dropped.
 * - NBV: its dialogue bar ― becomes the Spanish dash —, and "díal Señor" (an "ía el" fused into "íal"
 *   when the text was converted) is split back into "día el Señor".
 * - Biblia Platense: ‹ › become “ ”, and the l read as I by the scan ("MaIdito") is restored.
 * - Spelling mistakes found with a Spanish spellchecker and checked one by one (CORRECTIONS below).
 *   Spellings of their time (the Platense's "huída", "inscripto") are left as printed.
 */
const fs = require('fs');
const path = require('path');

const FILES = {
  nbv: 'biblia-nbv.json',
  catolica: 'biblia-catolica-platense.json',
  lbla: 'biblia-lbla.json',
  rvc: 'biblia-rvc.json',
  nvi: 'biblia-nvi.json',
};

/** [bible, book, chapter, verse, wrong, right] */
const CORRECTIONS = [
  ['lbla', 'Deuteronomio', 4, 14, 'cumpliérais', 'cumplierais'],
  ['lbla', 'Salmos', 94, 4, 'vanaglorían', 'vanaglorian'],
  ['lbla', 'Proverbios', 4, 25, 'se fíje', 'se fije'],
  ['lbla', 'Oseas', 7, 14, 'se reunen', 'se reúnen'],
  ['lbla', 'Mateo', 4, 16, 'vivian', 'vivían'],
  ['lbla', 'Mateo', 5, 29, 'écha lo', 'échalo'],
  ['lbla', 'Mateo', 12, 7, '«M isericordia', '«Misericordia'],
  ['lbla', 'Mateo', 26, 31, '«H eriré', '«Heriré'],
  ['lbla', 'Marcos', 14, 27, '«H eriré', '«Heriré'],
  ['lbla', 'Lucas', 9, 25, 'siél', 'si él'],
  ['lbla', 'Lucas', 14, 9, 'alúltimo', 'al último'],
  ['lbla', 'Juan', 12, 36, 'seais', 'seáis'],
  ['lbla', 'Apocalipsis', 3, 3, 'guárda lo', 'guárdalo'],
  ['rvc', '2 Samuel', 15, 32, 'girones', 'jirones'],
  ['nbv', 'Levitico', 6, 18, 'consangrada', 'consagrada'],
  ['nbv', 'Josue', 9, 13, 'zandalias', 'sandalias'],
  ['nbv', '1 Cronicas', 25, 9, 'decimoseptimo', 'decimoséptimo'],
  ['nbv', 'Isaias', 7, 11, 'terraqueo', 'terráqueo'],
  ['nbv', 'Isaias', 62, 7, 'reestablezca', 'restablezca'],
  ['nbv', 'Ezequiel', 4, 2, 'arrietes', 'arietes'],
  ['nbv', 'Ezequiel', 10, 9, 'crisolito', 'crisólito'],
  ['nbv', 'Ezequiel', 28, 13, 'crisolito', 'crisólito'],
  ['nbv', 'Ezequiel', 30, 20, 'décimoprimero', 'decimoprimero'],
  ['nbv', 'Ezequiel', 32, 1, 'décimosegundo', 'decimosegundo'],
  ['nbv', 'Ezequiel', 45, 21, 'décimocuarto', 'decimocuarto'],
  ['nbv', 'Ezequiel', 47, 2, 'del norteb', 'del norte'],
  ['nbv', 'Hechos', 23, 32, 'siguieroncon', 'siguieron con'],
  ['nbv', 'Galatas', 2, 6, 'aparencias', 'apariencias'],
  ['nbv', '1 Timoteo', 5, 21, 'prejucios', 'prejuicios'],
  ['catolica', 'Genesis', 21, 13, 'hare una', 'haré una'],
  ['catolica', 'Genesis', 25, 22, 'se chochaban', 'se chocaban'],
  ['catolica', 'Genesis', 31, 36, 'la palabro', 'la palabra'],
  ['catolica', 'Genesis', 40, 6, 'tistes', 'tristes'],
  ['catolica', 'Josue', 21, 25, 'consu ejido', 'con su ejido'],
  ['catolica', '1 Cronicas', 11, 19, 'diciendp', 'diciendo'],
  ['catolica', 'Daniel', 2, 40, 'hierro rodo', 'hierro todo'],
  ['catolica', 'Mateo', 18, 6, 'encandalizare', 'escandalizare'],
  ['catolica', 'Mateo', 18, 7, 'escándalosPorque', 'escándalos! Porque'],
  ['catolica', 'Marcos', 8, 17, 'teneis', 'tenéis'],
  ['catolica', 'Ecclesiastico', 13, 14, 'entretengues', 'entretengas'],
  ['catolica', 'Salmos', 58, 8, 'labios:..', 'labios…'],
];

/** ¡! ¿? and ( ) the sources left unpaired, mended by the sense of each sentence. Applied to the plain text
 * (no quotes or dashes); afterwards every pair must be complete, as in the RV1960. */
const SIGN_FIXES = [
  ['catolica', 'Juan', 20, 15, '¿A quién buscas Ella,', '¿A quién buscas? Ella,'],
  ['catolica', 'Marcos', 9, 31, 'resucitará?', 'resucitará.'],
  ['catolica', 'Mateo', 27, 46, '¡Elí, Elí, ¿lama', 'Elí, Elí, ¿lama'],
  ['catolica', 'Jeremias', 51, 35, 'en mi carne, dice la habitadora', 'en mi carne!, dice la habitadora'],
  ['catolica', 'Deuteronomio', 32, 38, '(¿Dónde están esos dioses), que', '¿Dónde están esos dioses, que'],
  ['catolica', 'Galatas', 5, 15, 'mutuamente (os mordéis', 'mutuamente os mordéis'],
  ['nbv', 'Mateo', 11, 23, '¡Y tú, Capernaúm, ¿serás', 'Y tú, Capernaúm, ¿serás'],
  ['nbv', 'Zacarias', 1, 4, 'devotos del Señor, les decían', 'devotos del Señor!, les decían'],
  ['nbv', 'Job', 38, 11, 'diciendo: ¡Hasta aquí', 'diciendo: Hasta aquí'],
  ['nbv', 'Job', 38, 11, 'el orgullo de sus olas!', 'el orgullo de sus olas?'],
  ['lbla', 'Jeremias', 3, 4, 'de mi juventud, pensando:', 'de mi juventud?, pensando:'],
  ['nbv', 'Mateo', 7, 9, '¿Si su hijo le pide pan', 'Si su hijo le pide pan'],
  ['catolica', 'Juan', 12, 38, 'lo que oímos (de Ti) y el brazo', 'lo que oímos (de Ti)? y el brazo'],
  // Reviewed one by one against the RV1960's own usage (a question quoted inside another drops its inner ¿).
  ['rvc', 'Salmos', 116, 7, 'o con bondad.', 'o con bondad!'],
  ['rvc', 'Salmos', 118, 16, ' levantado! La diestra d', ' levantado! ¡La diestra d'],
  ['nvi', 'Salmos', 95, 6, 'reverentes! Doblemos la ', 'reverentes! ¡Doblemos la '],
  ['nbv', 'Genesis', 30, 23, 'ra otro hijo.', 'ra otro hijo!'],
  ['nbv', 'Genesis', 49, 25, 'de la matriz.', 'de la matriz!'],
  ['nbv', 'Deuteronomio', 8, 15, 'árido y seco. No olvides ', 'árido y seco! No olvides '],
  ['nbv', 'Jueces', 9, 38, 'l que decía ¿Quién es Abi', 'l que decía Quién es Abi'],
  ['nbv', '2 Samuel', 1, 21, ' sus laderas. Porque allí', ' sus laderas! Porque allí'],
  ['nbv', '2 Samuel', 11, 19, 'y pregunta: Por qué los ', 'y pregunta: ¿Por qué los '],
  ['nbv', '2 Reyes', 1, 6, ' a decirle: Por qué enví', ' a decirle: ¿Por qué enví'],
  ['nbv', '2 Reyes', 9, 26, 'ma propiedad. ¡Así que ar', 'ma propiedad! ¡Así que ar'],
  ['nbv', '1 Cronicas', 22, 19, 'eñor su Dios. Construyan ', 'eñor su Dios! Construyan '],
  ['nbv', 'Job', 34, 17, 'a justicia? Vas tú a con', 'a justicia? ¿Vas tú a con'],
  ['nbv', 'Salmos', 31, 23, 'e son fieles. El Señor pr', 'e son fieles! El Señor pr'],
  ['nbv', 'Salmos', 45, 1, 'Mi corazón r', '¡Mi corazón r'],
  ['nbv', 'Salmos', 45, 3, 'tad y gloria,', 'tad y gloria!'],
  ['nbv', 'Salmos', 60, 8, 'mi esclavo. Y yo elevaré', 'mi esclavo. ¡Y yo elevaré'],
  ['nbv', 'Salmos', 69, 11, ' mi tristeza.', ' mi tristeza!'],
  ['nbv', 'Salmos', 72, 11, 'án ante él! Todos le ser', 'án ante él! ¡Todos le ser'],
  ['nbv', 'Salmos', 73, 18, ' destrucción.', ' destrucción!'],
  ['nbv', 'Salmos', 79, 10, 'n burlonas: ¿Dónde está e', 'n burlonas: Dónde está e'],
  ['nbv', 'Salmos', 83, 14, 'por el monte.', 'por el monte!'],
  ['nbv', 'Salmos', 96, 11, 'ue hay en él.', 'ue hay en él!'],
  ['nbv', 'Salmos', 106, 48, ' el pueblo: ¡Aleluya! ¡Al', ' el pueblo: Aleluya! ¡Al'],
  ['nbv', 'Salmos', 106, 13, 'r sus planes.', 'r sus planes!'],
  ['nbv', 'Salmos', 114, 6, 'Por qué, ustedes los', '¿Por qué, ustedes los'],
  ['nbv', 'Salmos', 115, 2, 's naciones: ¿Dónde está s', 's naciones: Dónde está s'],
  ['nbv', 'Proverbios', 9, 6, ' y vivirán; aprendan a s', ' y vivirán; ¡aprendan a s'],
  ['nbv', 'Proverbios', 9, 17, 'efrescante; y el pan que', 'efrescante; ¡y el pan que'],
  ['nbv', 'Proverbios', 10, 1, 'l hijo necio.', 'l hijo necio!'],
  ['nbv', 'Cantares', 6, 10, 'as del cielo.', 'as del cielo?'],
  ['nbv', 'Isaias', 8, 7, ' cabo a cabo.', ' cabo a cabo!'],
  ['nbv', 'Isaias', 52, 6, 'e les dice: ¡Aquí estoy p', 'e les dice: Aquí estoy p'],
  ['nbv', 'Isaias', 62, 7, 'da la tierra.', 'da la tierra!'],
  ['nbv', 'Jeremias', 4, 19, 'ienen encima.', 'ienen encima!'],
  ['nbv', 'Jeremias', 20, 16, 'misericordia.', 'misericordia!'],
  ['nbv', 'Mateo', 6, 29, 'anta belleza.', 'anta belleza!'],
  ['nbv', 'Mateo', 18, 33, 'y tú no pudi', '¿y tú no pudi'],
  ['nbv', 'Mateo', 18, 32, 'e lo pediste,', 'e lo pediste!'],
  ['nbv', 'Mateo', 25, 41, 'sus demonios.', 'sus demonios!'],
  ['nbv', 'Lucas', 4, 34, '¡Por qué te m', '¿Por qué te m'],
  ['nbv', 'Juan', 2, 21, 'ropio cuerpo.', 'ropio cuerpo!'],
  ['nbv', 'Romanos', 9, 20, 'en lo hizo: ¿Por qué me h', 'en lo hizo: Por qué me h'],
  ['nbv', 'Apocalipsis', 7, 3, 'nuestro Dios.', 'nuestro Dios!'],
  ['nbv', 'Apocalipsis', 14, 13, 'sus acciones.', 'sus acciones!'],
  ['lbla', 'Genesis', 18, 13, ', diciendo: ¿Concebiré en', ', diciendo: Concebiré en'],
  ['lbla', 'Jueces', 6, 13, ', diciendo: ¿No nos hizo ', ', diciendo: No nos hizo '],
  ['lbla', '1 Samuel', 11, 12, 'l que dijo: ¿Ha de reinar', 'l que dijo: Ha de reinar'],
  ['lbla', 'Salmos', 115, 2, 's naciones: ¿Dónde está a', 's naciones: Dónde está a'],
  ['lbla', 'Isaias', 29, 15, ' nos conoce?', ' nos conoce?!'],
  ['lbla', 'Isaias', 45, 11, 'de mis manos.', 'de mis manos!'],
  ['lbla', 'Ezequiel', 12, 9, 'sa rebelde: ¿Qué estás ha', 'sa rebelde: Qué estás ha'],
  ['lbla', 'Ezequiel', 13, 12, 'preguntará: ¿Dónde está l', 'preguntará: Dónde está l'],
  ['catolica', 'Genesis', 21, 17, ' y le dijo: Qué te pasa,', ' y le dijo: ¿Qué te pasa,'],
  ['catolica', 'Genesis', 43, 7, ', diciendo: Vive todavía', ', diciendo: ¿Vive todavía'],
  ['catolica', '2 Samuel', 1, 26, 'ime por ti, oh hermano m', 'ime por ti, ¡oh hermano m'],
  ['catolica', '1 Reyes', 2, 33, 'ra siempre; pero sobre D', 'ra siempre; ¡pero sobre D'],
  ['catolica', '1 Cronicas', 16, 28, 'ad a Yahvé, oh familias ', 'ad a Yahvé, ¡oh familias '],
  ['catolica', '1 Cronicas', 16, 31, 's gentiles: ¡Yahvé es rey', 's gentiles: Yahvé es rey'],
  ['catolica', '2 Cronicas', 2, 12, 'real para sí.', 'real para sí!'],
  ['catolica', 'Job', 9, 12, 'rá decirle: ¿Qué es lo qu', 'rá decirle: Qué es lo qu'],
  ['catolica', 'Job', 10, 3, 'Te parece ac', '¿Te parece ac'],
  ['catolica', 'Job', 15, 11, ' se te dicen.', ' se te dicen?'],
  ['catolica', 'Job', 16, 22, 'y su prójimo.', 'y su prójimo!'],
  ['catolica', 'Job', 19, 24, 'que con punz', '¡que con punz'],
  ['catolica', 'Job', 22, 20, '(diciendo): No ha sido a', '(diciendo): ¿No ha sido a'],
  ['catolica', 'Job', 29, 6, 'os de aceite.', 'os de aceite?'],
  ['catolica', 'Job', 39, 32, 'Quiere el ce', '¿Quiere el ce'],
  ['catolica', 'Salmos', 78, 10, 's gentiles: ¿Dónde está e', 's gentiles: Dónde está e'],
  ['catolica', 'Salmos', 103, 34, 'Séanle grato', '¡Séanle grato'],
  ['catolica', 'Isaias', 10, 2, 'nos su botín.', 'nos su botín!'],
  ['catolica', 'Isaias', 29, 15, ' nos conoce?', ' nos conoce?!'],
  ['catolica', 'Isaias', 38, 16, ' mi espíritu. Pero Tú me ', ' mi espíritu! Pero Tú me '],
  ['catolica', 'Isaias', 45, 10, 'é das a luz?', 'é das a luz?!'],
  ['catolica', 'Isaias', 51, 17, 'ausa vértigo.', 'ausa vértigo!'],
  ['catolica', 'Jeremias', 23, 8, 'bía arrojado. Y habitarán', 'bía arrojado! Y habitarán'],
  ['catolica', 'Jeremias', 48, 43, ', dice Yahvé.', ', dice Yahvé!'],
  ['catolica', 'Jeremias', 48, 1, 'da y abatida.', 'da y abatida!'],
  ['catolica', 'Lamentaciones', 1, 20, 'se de muerte.', 'se de muerte!'],
  ['catolica', 'Lamentaciones', 2, 18, ' de tus ojos.', ' de tus ojos!'],
  ['catolica', 'Ezequiel', 12, 9, 'sa rebelde: ¿Qué estás ha', 'sa rebelde: Qué estás ha'],
  ['catolica', 'Ezequiel', 13, 12, 'se os dirá: ¿Dónde está e', 'se os dirá: Dónde está e'],
  ['catolica', 'Joel', 2, 17, 's naciones: ¿Dónde está s', 's naciones: Dónde está s'],
  ['catolica', 'Joel', 2, 17, 'los gentiles. ¿Por qué ha', 'los gentiles! ¿Por qué ha'],
  ['catolica', 'Amos', 8, 4, 'de la tierra,', 'de la tierra!'],
  ['catolica', 'Miqueas', 4, 13, 'Levántate y ', '¡Levántate y '],
  ['catolica', 'Miqueas', 6, 1, 'los collados.', 'los collados!'],
  ['catolica', 'Miqueas', 7, 1, 'os tempranos.', 'os tempranos!'],
  ['catolica', 'Habacuc', 2, 19, 'ce al leño: ¡Despierta!; ', 'ce al leño: Despierta!; '],
  ['catolica', 'Habacuc', 2, 16, 'rá tu gloria.', 'rá tu gloria!'],
  ['catolica', 'Habacuc', 2, 12, 're iniquidad.', 're iniquidad!'],
  ['catolica', 'Sofonias', 1, 11, ' pesan plata.', ' pesan plata!'],
  ['catolica', 'Sofonias', 2, 15, 'su corazón: ¡Yo y nadie m', 'su corazón: Yo y nadie m'],
  ['catolica', 'Zacarias', 9, 12, 'lados bienes.', 'lados bienes!'],
  ['catolica', 'Zacarias', 13, 7, ' ejércitos: ¡Hiere al Pas', ' ejércitos: Hiere al Pas'],
  ['catolica', 'Marcos', 3, 23, ' parábolas: Cómo puede S', ' parábolas: ¿Cómo puede S'],
  ['catolica', 'Marcos', 4, 21, 'jo también: Acaso se tra', 'jo también: ¿Acaso se tra'],
  ['catolica', 'Marcos', 15, 18, 'e los judíos.', 'e los judíos!'],
  ['catolica', 'Lucas', 13, 31, 'quiere matar.', 'quiere matar!'],
  ['catolica', 'Lucas', 18, 38, 'ó diciendo: Jesús, Hijo ', 'ó diciendo: ¡Jesús, Hijo '],
  ['catolica', 'Lucas', 19, 23, 'Y entonces p', '¿Y entonces p'],
  ['catolica', 'Lucas', 19, 33, 'es dijeron: Por qué desa', 'es dijeron: ¿Por qué desa'],
  ['catolica', 'Lucas', 22, 9, 'reguntaron: Dónde quiere', 'reguntaron: ¿Dónde quiere'],
  ['catolica', 'Lucas', 24, 18, ' respondió: Eres Tú el ú', ' respondió: ¿Eres Tú el ú'],
  ['catolica', 'Juan', 4, 12, 'Acaso eres T', '¿Acaso eres T'],
  ['catolica', 'Juan', 13, 24, ' a ese: Di, quién es aqu', ' a ese: Di, ¿quién es aqu'],
  ['catolica', 'Juan', 18, 25, 'le dijeron: No eres tú t', 'le dijeron: ¿No eres tú t'],
  ['catolica', 'Romanos', 9, 20, ' lo modeló: ¿Por qué me h', ' lo modeló: Por qué me h'],
];

/** ¡! ¿? ( ) left unpaired in a Bible, read chapter by chapter (a sentence may span verses). */
function unpairedSigns(bible) {
  const PAIRS = { '!': '¡', '?': '¿', ')': '(' };
  const problems = [];
  for (const [book, chapters] of Object.entries(bible)) {
    chapters.forEach((verses, c) => {
      const stack = [];
      verses.forEach((text, v) => {
        for (const ch of text || '') {
          if (ch === '¡' || ch === '¿' || ch === '(') stack.push({ ch, at: `${book} ${c + 1}:${v + 1}` });
          else if (ch in PAIRS) {
            const top = stack.pop();
            if (!top || top.ch !== PAIRS[ch]) problems.push(`${book} ${c + 1}:${v + 1} ${ch}`);
          }
        }
      });
      for (const open of stack) problems.push(`${open.at} ${open.ch} sin cierre`);
    });
  }
  return problems;
}

const CONTINUATION = /(^|\s)[»”’]+\s*/g;
const dataDir = path.join(__dirname, '..', 'assets', 'data');
const report = [];

/**
 * The text as plain as the printed RV1960: no quotation marks (« » “ ” ‘ ’), no brackets (their words
 * stay) and no dashes. A dialogue or an aside between dashes goes between commas instead:
 * "—Por la poca fe que tienen —respondió—." → "Por la poca fe que tienen, respondió."
 * Parentheses and the hyphen of compound names ("Tubal-caín") stay, as in the RV1960.
 */
function plainText(text) {
  let t = text
    .replace(/[«»“”‘’"]/g, '')
    .replace(/\[([^\]]*)\]/g, '$1')
    .replace(/[[\]]/g, '')                                  // a bracket opened in one verse and closed in another
    .replace(/[―–]/g, '—');
  // Each dash opens an aside or closes the one before ("—respondió—"), counted along the verse.
  let seen = 0;
  t = t.replace(/[ \t]*—[ \t]*/g, (dash, offset, all) => {
    const opens = seen++ % 2 === 0;
    const before = all.slice(0, offset).replace(/[ \t]+$/, '').slice(-1);
    const after = all.slice(offset + dash.length, offset + dash.length + 1);
    if (!before || before === '\n' || !after || after === '\n') return before === '\n' ? '' : (before ? '' : '');
    if (/[,.;:…)]/.test(after)) return '';                    // "duda—," → the sign is enough
    if (/[¡¿(]/.test(before)) return '';                     // right after an opening sign
    if (/[.;:,…]/.test(before)) return ' ';                  // the sign before already makes the pause
    return opens || /[?!]/.test(before) ? ', ' : ', ';
  });
  return t
    .replace(/,[ \t]*([,.;:!?…])/g, '$1')
    .replace(/([!?])\.(?!\.)/g, '$1')                        // "salvarlos!." (a removed »): the RV1960 never does this
    .replace(/([¡¿(])[ \t]*,[ \t]*/g, '$1')
    .replace(/^[ \t]*,[ \t]*/gm, '')
    .replace(/[ \t]+([,.;:!?…)])/g, '$1')
    .replace(/([,;:])(?=[\p{L}¡¿(])/gu, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '');
}

for (const [id, file] of Object.entries(FILES)) {
  const target = path.join(dataDir, file);
  const bible = JSON.parse(fs.readFileSync(target, 'utf8'));
  let changed = 0;
  const fix = (text) => {
    let next = text;
    if (id !== 'catolica') next = next.replace(CONTINUATION, '$1');
    if (id === 'lbla') next = next.replace(/(^|\s)-\s+/g, '$1');
    if (id === 'nbv') next = next.replace(/―/g, '—').replace(/(?<=\p{L}í)al\b/gu, 'a el');
    if (id === 'catolica') {
      next = next.replace(/‹/g, '“').replace(/›/g, '”')
        // A capital I right after a lowercase letter ("MaIdito", "TotaI") is an l the scan misread.
        .replace(/(?<=\p{Ll})I/gu, 'l').replace(/\blsrael\b/g, 'Israel');
    }
    if (next !== text) changed++;
    return next;
  };
  for (const chapters of Object.values(bible)) {
    for (const verses of chapters) {
      for (let i = 0; i < verses.length; i++) if (verses[i]) verses[i] = fix(verses[i]);
    }
  }
  for (const [bibleId, book, chapter, verse, wrong, right] of CORRECTIONS) {
    if (bibleId !== id) continue;
    const verses = bible[book]?.[chapter - 1];
    const text = verses?.[verse - 1];
    if (text == null) throw new Error(`No existe ${id} ${book} ${chapter}:${verse}`);
    if (text.includes(wrong)) { verses[verse - 1] = text.replace(wrong, right); changed++; }
    else if (!text.includes(right) && !plainText(text).includes(plainText(right))) {
      throw new Error(`${id} ${book} ${chapter}:${verse} no contiene «${wrong}»`);
    }
  }
  // Last, after the corrections (some of them name a quotation mark): no quotes, brackets or dashes.
  for (const chapters of Object.values(bible)) {
    for (const verses of chapters) {
      for (let i = 0; i < verses.length; i++) {
        if (!verses[i]) continue;
        const plain = plainText(verses[i]);
        if (plain !== verses[i]) { verses[i] = plain; changed++; }
      }
    }
  }
  for (const [bibleId, book, chapter, verse, wrong, right] of SIGN_FIXES) {
    if (bibleId !== id) continue;
    const verses = bible[book]?.[chapter - 1];
    const text = verses?.[verse - 1];
    if (text == null) throw new Error(`No existe ${id} ${book} ${chapter}:${verse}`);
    // Already applied? A fix that adds a sign keeps the old text inside the new one ("Mi corazón" →
    // "¡Mi corazón"), so it is done when the new text is there; any other when the old one is gone.
    const applied = right.includes(wrong) ? text.includes(right) : !text.includes(wrong);
    if (applied) continue;
    if (!text.includes(wrong)) throw new Error(`${id} ${book} ${chapter}:${verse} no contiene «${wrong}»`);
    verses[verse - 1] = text.replace(wrong, right);
    changed++;
  }
  const unpaired = unpairedSigns(bible);
  if (unpaired.length) throw new Error(`${id}: signos sin pareja:\n${unpaired.join('\n')}`);
  fs.writeFileSync(target, JSON.stringify(bible));
  report.push(`${id}: ${changed} versículos corregidos`);
}
console.log(report.join('\n'));
