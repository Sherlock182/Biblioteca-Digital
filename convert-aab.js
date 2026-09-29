const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⏳ Iniciando conversión AAB a APK...');

try {
    // Verificar si bundletool.jar existe
    if (!fs.existsSync('bundletool.jar')) {
        console.error('❌ bundletool.jar no encontrado');
        process.exit(1);
    }
    
    // Verificar AAB
    const aabFile = 'application-6fae6b97-57b1-414a-8485-509fb0851cea.aab';
    if (!fs.existsSync(aabFile)) {
        console.error('❌ Archivo AAB no encontrado');
        process.exit(1);
    }
    
    console.log(`✓ Archivos encontrados`);
    console.log(`  - bundletool.jar: ${fs.statSync('bundletool.jar').size} bytes`);
    console.log(`  - ${aabFile}: ${fs.statSync(aabFile).size} bytes`);
    
    // Crear comando de conversión con Java si está disponible
    const command = \`java -jar bundletool.jar build-apks --bundle=\${aabFile} --output=app.apks --mode=universal\`;
    
    console.log('⏳ Ejecutando conversión...');
    execSync(command, { stdio: 'inherit' });
    
    if (fs.existsSync('app.apks')) {
        // Renombrar a APK
        fs.renameSync('app.apks', 'app.apk');
        console.log('✓ Conversión exitosa: app.apk');
    }
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
