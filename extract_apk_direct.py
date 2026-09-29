#!/usr/bin/env python3
import zipfile
import os
import shutil
import sys

def convert_aab_to_apk():
    aab_file = "application-6fae6b97-57b1-414a-8485-509fb0851cea.aab"
    extract_dir = "aab_temp"
    apk_output = "app.apk"
    
    print("=" * 60)
    print("Convirtiendo AAB a APK...")
    print("=" * 60)
    
    # Verificar AAB
    if not os.path.exists(aab_file):
        print(f"❌ Archivo no encontrado: {aab_file}")
        return False
    
    print(f"\n✓ Archivo encontrado: {aab_file}")
    size_mb = os.path.getsize(aab_file) / (1024 * 1024)
    print(f"  Tamaño: {size_mb:.2f} MB")
    
    try:
        # El AAB es un archivo ZIP - extraerlo
        print(f"\n⏳ Extrayendo contenido...")
        with zipfile.ZipFile(aab_file, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        print("✓ Contenido extraído")
        
        # Buscar APKs dentro del AAB
        apk_found = False
        apk_source = None
        
        # El APK universal generalmente está en base/apk/universal.apk
        priority_paths = [
            os.path.join(extract_dir, "base", "apk", "universal.apk"),
            os.path.join(extract_dir, "base.apk"),
        ]
        
        print(f"\n⏳ Buscando APK universal...")
        
        # Primero intentar rutas conocidas
        for path in priority_paths:
            if os.path.exists(path):
                apk_source = path
                print(f"✓ Encontrado: {path}")
                break
        
        # Si no, buscar cualquier APK
        if not apk_source:
            print("  Buscando en toda la estructura...")
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    if "universal" in file and file.endswith(".apk"):
                        apk_source = os.path.join(root, file)
                        print(f"✓ Encontrado: {apk_source}")
                        break
                if apk_source:
                    break
        
        if not apk_source:
            # Última opción: copiar cualquier APK
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    if file.endswith(".apk"):
                        apk_source = os.path.join(root, file)
                        print(f"⚠️ Usando: {file}")
                        break
                if apk_source:
                    break
        
        if not apk_source:
            print("❌ No se encontró APK en el AAB")
            return False
        
        # Copiar APK
        print(f"\n⏳ Copiando APK...")
        shutil.copy2(apk_source, apk_output)
        
        # Verificar resultado
        if os.path.exists(apk_output):
            apk_size_mb = os.path.getsize(apk_output) / (1024 * 1024)
            print(f"✓ APK creado: {apk_output}")
            print(f"  Tamaño: {apk_size_mb:.2f} MB")
            apk_found = True
        else:
            print(f"❌ Error al copiar APK")
            return False
        
        # Limpiar
        print(f"\n⏳ Limpiando archivos temporales...")
        shutil.rmtree(extract_dir)
        
        print("\n" + "=" * 60)
        print(f"✓ ¡Listo! Tu aplicación APK está en: {apk_output}")
        print(f"  Puedes instalarla directamente en tu dispositivo Android")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Limpiar si falla
        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)
        
        return False

if __name__ == "__main__":
    success = convert_aab_to_apk()
    sys.exit(0 if success else 1)
