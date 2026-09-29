#!/usr/bin/env python3
"""Convert AAB to APK by extracting and repacking properly"""
import os
import sys
import zipfile
import shutil
import subprocess
import urllib.request

def download_file(url, filename, max_retries=3):
    """Descargar archivo con reintentos"""
    print(f"⏳ Descargando desde: {url}")
    
    for attempt in range(max_retries):
        try:
            print(f"  Intento {attempt + 1}/{max_retries}...")
            urllib.request.urlretrieve(url, filename)
            size_mb = os.path.getsize(filename) / (1024 * 1024)
            print(f"✓ Descargado: {size_mb:.2f}MB")
            return True
        except Exception as e:
            print(f"  ❌ Error: {e}")
            if os.path.exists(filename):
                os.remove(filename)
    
    return False

def extract_zip(zip_file, extract_dir):
    """Extraer archivo ZIP"""
    print(f"⏳ Extrayendo {zip_file}...")
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    print(f"✓ Extraído a: {extract_dir}")
    return True

def install_java():
    """Descargar e instalar Java"""
    java_dir = "java-jdk"
    
    if os.path.exists(os.path.join(java_dir, "bin", "java.exe")):
        print("✓ Java ya está instalado")
        return os.path.join(java_dir, "bin", "java.exe")
    
    # Intentar descargar desde múltiples fuentes
    sources = [
        "https://download.bell-sw.com/java/21.0.2/bellsoft-jdk21.0.2-windows-amd64.zip",
        "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip",
    ]
    
    for url in sources:
        print(f"\n⏳ Intentando: {url.split('/')[-1]}")
        
        if download_file(url, "java.zip"):
            try:
                extract_zip("java.zip", ".")
                
                # Buscar carpeta extraída
                for item in os.listdir("."):
                    if os.path.isdir(item) and ("jdk" in item.lower() or "bellsoft" in item.lower() or "java" in item.lower()):
                        if os.path.exists(os.path.join(item, "bin", "java.exe")):
                            if item != java_dir:
                                shutil.move(item, java_dir)
                            
                            os.remove("java.zip")
                            java_exe = os.path.join(java_dir, "bin", "java.exe")
                            print(f"✓ Java instalado en: {java_dir}")
                            return java_exe
                
                os.remove("java.zip")
            except Exception as e:
                print(f"❌ Error: {e}")
                if os.path.exists("java.zip"):
                    os.remove("java.zip")
                continue
    
    return None

def convert_aab_to_apk(java_exe, bundletool_jar, aab_file, apk_output):
    """Convertir AAB a APK usando bundletool"""
    
    if not os.path.exists(java_exe):
        print(f"❌ Java no encontrado: {java_exe}")
        return False
    
    if not os.path.exists(bundletool_jar):
        print(f"❌ bundletool.jar no encontrado: {bundletool_jar}")
        return False
    
    if not os.path.exists(aab_file):
        print(f"❌ AAB no encontrado: {aab_file}")
        return False
    
    try:
        print(f"\n⏳ Convirtiendo {aab_file} a APK...")
        print(f"  Java: {java_exe}")
        print(f"  Bundletool: {bundletool_jar}")
        
        # Comando para generar universal APK
        apks_output = "app.apks"
        cmd = [
            java_exe,
            "-jar", bundletool_jar,
            "build-apks",
            f"--bundle={aab_file}",
            f"--output={apks_output}",
            "--mode=universal"
        ]
        
        print(f"\n⏳ Ejecutando: {' '.join(cmd)}\n")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        if result.returncode == 0 and os.path.exists(apks_output):
            # Renombrar .apks a .apk
            os.rename(apks_output, apk_output)
            size_mb = os.path.getsize(apk_output) / (1024 * 1024)
            print(f"\n✓ ¡Éxito! APK generado: {apk_output} ({size_mb:.2f}MB)")
            return True
        else:
            print(f"\n❌ Error en conversión (código: {result.returncode})")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    
    aab_file = "application-6fae6b97-57b1-414a-8485-509fb0851cea.aab"
    apk_output = "app.apk"
    bundletool_jar = "bundletool.jar"
    
    print("=" * 60)
    print("AAB → APK Converter")
    print("=" * 60)
    
    # Instalar Java si es necesario
    java_exe = install_java()
    
    if not java_exe:
        print("\n❌ No se pudo instalar Java automáticamente")
        print("\n💡 Por favor instala Java JDK 21 manualmente:")
        print("   https://learn.microsoft.com/en-us/java/openjdk/download")
        print("\n   Luego ejecuta nuevamente este script")
        sys.exit(1)
    
    # Convertir
    success = convert_aab_to_apk(java_exe, bundletool_jar, aab_file, apk_output)
    
    if success:
        print("\n" + "=" * 60)
        print(f"✓ El archivo APK está listo: {apk_output}")
        print("  Puedes instalarlo en tu dispositivo Android")
        print("=" * 60)
    else:
        print("\n❌ Error en la conversión")
        sys.exit(1)

if __name__ == "__main__":
    main()
