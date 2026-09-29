const fs = require('fs');
const path = require('path');

// Directorio de los archivos de origen y procesados
const origenDir = path.join(__dirname, '../Reina-Valera-1960/origen');
const procesadosDir = path.join(__dirname, '../Reina-Valera-1960/procesados');

// Todos los libros de la Biblia
const todosLosLibros = [
  'genesis',
  'exodo',
  'levitico',
  'numeros',
  'deuteronomio',
  'josue',
  'jueces',
  'rut',
  '1_samuel',
  '2_samuel',
  '1_reyes',
  '2_reyes',
  '1_cronicas',
  '2_cronicas',
  'esdras',
  'nehemias',
  'ester',
  'job',
  'salmos',
  'proverbios',
  'eclesiastes',
  'cantares',
  'isaias',
  'jeremias',
  'lamentaciones',
  'ezequiel',
  'daniel',
  'oseas',
  'joel',
  'amos',
  'abdias',
  'jonas',
  'miqueas',
  'nahum',
  'habacuc',
  'sofonias',
  'hageo',
  'zacarias',
  'malaquias',
  'mateo',
  'marcos',
  'lucas',
  'juan',
  'hechos',
  'romanos',
  '1_corintios',
  '2_corintios',
  'galatas',
  'efesios',
  'filipenses',
  'colosenses',
  '1_tesalonicenses',
  '2_tesalonicenses',
  '1_timoteo',
  '2_timoteo',
  'tito',
  'filemon',
  'hebreos',
  'santiago',
  '1_pedro',
  '2_pedro',
  '1_juan',
  '2_juan',
  '3_juan',
  'judas',
  'apocalipsis'
];

console.log('🔧 Regenerando archivos RV1960 con estructura correcta...\n');

todosLosLibros.forEach(libro => {
  const archivoOrigen = path.join(origenDir, `${libro}.txt`);
  const archivoProcesado = path.join(procesadosDir, `${libro}.js`);
  
  if (!fs.existsSync(archivoOrigen)) {
    console.log(`⚠️  ${libro}: Archivo no encontrado`);
    return;
  }

  try {
    // Leer el archivo
    let contenido = fs.readFileSync(archivoOrigen, 'utf-8');
    
    // Limpiar caracteres /n si existen
    contenido = contenido.replace(/\/n/g, ' ');
    
    // Parsear los versículos en formato (book, chapter, verse, 'text')
    const lineas = contenido.split('\n').filter(l => l.trim());
    const capitulos = {};
    
    lineas.forEach(linea => {
      // Extraer con regex: (book, chapter, verse, 'text')
      const match = linea.match(/\((\d+),\s*(\d+),\s*(\d+),\s*'(.+?)'\s*\)/);
      if (match) {
        const bookNum = parseInt(match[1]);
        const chapter = parseInt(match[2]);
        const verse = parseInt(match[3]);
        const texto = match[4];
        
        // Crear el capítulo si no existe
        if (!capitulos[chapter]) {
          capitulos[chapter] = [];
        }
        
        // Agregar el versículo (se debe insertar en el índice verse-1)
        capitulos[chapter][verse - 1] = texto;
      }
    });
    
    // Convertir el objeto de capítulos a un array ordenado
    const capitulosOrdenados = [];
    for (let i = 1; i <= Object.keys(capitulos).length; i++) {
      capitulosOrdenados.push(capitulos[i] || []);
    }
    
    // Generar el código JavaScript
    let contenidoJS = 'export default [\n';
    capitulosOrdenados.forEach((capitulo, idx) => {
      contenidoJS += '  [\n';
      capitulo.forEach((verso, verseIdx) => {
        const textoEscapado = verso.replace(/'/g, "\\'");
        contenidoJS += `    '${textoEscapado}'`;
        if (verseIdx < capitulo.length - 1) contenidoJS += ',';
        contenidoJS += '\n';
      });
      contenidoJS += '  ]';
      if (idx < capitulosOrdenados.length - 1) contenidoJS += ',';
      contenidoJS += '\n';
    });
    contenidoJS += '];\n';
    
    // Guardar el archivo
    fs.writeFileSync(archivoProcesado, contenidoJS, 'utf-8');
    
    const totalVersiculos = capitulosOrdenados.reduce((sum, cap) => sum + cap.length, 0);
    console.log(`✅ ${libro}: ${capitulosOrdenados.length} capítulos, ${totalVersiculos} versículos procesados`);
  } catch (error) {
    console.error(`❌ Error regenerando ${libro}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✨ ¡Regeneración completada exitosamente!');
console.log('='.repeat(60));
