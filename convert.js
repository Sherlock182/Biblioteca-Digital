const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const { createWriteStream } = require('fs');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(dest);
            });
        }).on('error', reject);
    });
}

async function main() {
    const aabFile = 'application-6fae6b97-57b1-414a-8485-509fb0851cea.aab';
    const apkOutput = 'app.apk';
    const bundletool = 'bundletool.jar';
    
    console.log('='.repeat(60));
    console.log('AAB → APK Converter (Node.js Version)');
    console.log('='.repeat(60));
    
    // Verificar archivos
    if (!fs.existsSync(aabFile)) {
        console.error(`❌ AAB no encontrado: ${aabFile}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(bundletool)) {
        console.error(`❌ bundletool.jar no encontrado`);
        process.exit(1);
    }
    
    console.log(`✓ AAB encontrado: ${(fs.statSync(aabFile).size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`✓ bundletool encontrado: ${(fs.statSync(bundletool).size / 1024 / 1024).toFixed(2)}MB`);
    
    // Intentar usar java del PATH
    console.log('\n⏳ Buscando Java...');
    
    try {
        const version = execSync('java -version 2>&1', { encoding: 'utf-8' });
        console.log('✓ Java encontrado:');
        console.log(version.split('\n')[0]);
    } catch (e) {
        console.error('❌ Java no está en el PATH');
        console.error('⚠️ Instalando Java...');
        return;
    }
    
    // Convertir
    console.log('\n⏳ Convirtiendo AAB a APK...');
    
    try {
        const cmd = `java -jar bundletool.jar build-apks --bundle="${aabFile}" --output="app.apks" --mode=universal`;
        console.log(`Ejecutando: ${cmd}\n`);
        
        const output = execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
        
        if (fs.existsSync('app.apks')) {
            fs.renameSync('app.apks', apkOutput);
            const size = (fs.statSync(apkOutput).size / 1024 / 1024).toFixed(2);
            
            console.log('\n' + '='.repeat(60));
            console.log(`✓ ¡Listo! Archivo generado: ${apkOutput} (${size}MB)`);
            console.log('='.repeat(60));
        }
    } catch (e) {
        console.error('❌ Error durante la conversión:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
