const fs = require('fs');
const path = require('path');

// Directorio de los archivos de origen y procesados
const origenDir = path.join(__dirname, '../Reina-Valera-1960/origen');
const procesadosDir = path.join(__dirname, '../Reina-Valera-1960/procesados');

// Libros que tienen errores (desde Salmos hasta Lamentaciones)
const librosConErrores = [
  'salmos',
  'proverbios',
  'eclesiastes',
  'cantares',
  'isaias',
  'jeremias',
  'lamentaciones'
];

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

console.log('🔧 Iniciando reparación de versículos de Reina Valera 1960...\n');

// Función para limpiar los caracteres "/n"
function limpiarVersiculo(verso) {
  // Reemplazar "/n" con un espacio simple
  return verso.replace(/\/n/g, ' ').trim();
}

// Procesar archivos
let archivosReparados = 0;
let archivosConErroresEncontrados = 0;

todosLosLibros.forEach(libro => {
  const archivoOrigen = path.join(origenDir, `${libro}.txt`);
  
  if (!fs.existsSync(archivoOrigen)) {
    console.log(`⚠️  ${libro}: Archivo no encontrado`);
    return;
  }

  try {
    // Leer el archivo
    let contenido = fs.readFileSync(archivoOrigen, 'utf-8');
    
    // Verificar si tiene errores
    const tieneErrores = contenido.includes('/n');
    
    if (tieneErrores) {
      archivosConErroresEncontrados++;
      console.log(`🔍 ${libro}: Encontrados /n - LIMPIANDO...`);
      
      // Limpiar el contenido
      contenido = contenido.replace(/\/n/g, ' ');
      
      // Guardar el archivo corregido
      fs.writeFileSync(archivoOrigen, contenido, 'utf-8');
      
      console.log(`✅ ${libro}: Versículos reparados\n`);
      archivosReparados++;
    } else {
      console.log(`✓ ${libro}: Sin errores\n`);
    }
  } catch (error) {
    console.error(`❌ Error procesando ${libro}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📊 RESUMEN DE REPARACIÓN:`);
console.log(`   - Archivos reparados: ${archivosReparados}`);
console.log(`   - Archivos sin errores: ${todosLosLibros.length - archivosConErroresEncontrados}`);
console.log('='.repeat(60) + '\n');

// Ahora regenerar los archivos procesados
console.log('🔄 Regenerando archivos procesados...\n');

todosLosLibros.forEach(libro => {
  const archivoOrigen = path.join(origenDir, `${libro}.txt`);
  const archivoProcesado = path.join(procesadosDir, `${libro}.js`);
  
  if (!fs.existsSync(archivoOrigen)) {
    return;
  }

  try {
    let contenido = fs.readFileSync(archivoOrigen, 'utf-8');
    
    // Parsear los versículos
    const lineas = contenido.split('\n').filter(l => l.trim());
    const versiculos = [];
    
    lineas.forEach(linea => {
      // Extraer el texto del versículo
      const match = linea.match(/\(([\d,\s]+),\s*'(.+?)'\s*\)/);
      if (match) {
        const parte = match[1];
        const texto = match[2];
        versiculos.push(`'${texto}'`);
      }
    });
    
    // Generar el contenido del archivo JS
    const contenidoJS = `export default [\n  ${versiculos.join(',\n  ')}\n]`;
    
    // Guardar el archivo
    fs.writeFileSync(archivoProcesado, contenidoJS, 'utf-8');
    
    console.log(`✅ ${libro}: ${versiculos.length} versículos procesados`);
  } catch (error) {
    console.error(`❌ Error regenerando ${libro}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✨ ¡Reparación completada exitosamente!');
console.log('='.repeat(60));
