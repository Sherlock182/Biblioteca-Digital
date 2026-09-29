#!/usr/bin/env python3
import zipfile
import os
import shutil
import sys

aab_file = "application-6fae6b97-57b1-414a-8485-509fb0851cea.aab"
extract_dir = "aab-extracted"
apk_output = "app.apk"

try:
    print(f"⏳ Extrayendo {aab_file}...")
    
    if not os.path.exists(aab_file):
        print(f"❌ Archivo no encontrado: {aab_file}")
        sys.exit(1)
    
    # Los AAB son archivos ZIP
    with zipfile.ZipFile(aab_file, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    
    print(f"✓ Extraído a: {extract_dir}")
    
    # Listar contenido
    print("\n📁 Primeros 30 archivos:")
    files_list = []
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, extract_dir)
            files_list.append(rel_path)
            if len(files_list) <= 30:
                print(f"  {rel_path}")
    
    print(f"\nTotal de archivos: {len(files_list)}")
    
    # Buscar APKs
    apk_files = [f for f in files_list if f.endswith('.apk')]
    print(f"\n🔍 APKs encontrados: {len(apk_files)}")
    for apk in apk_files[:10]:
        print(f"  - {apk}")
    
    # Buscar el APK universal (generalmente en base/apk/universal.apk o base.apk)
    apk_found = False
    priority_paths = [
        os.path.join(extract_dir, "base", "apk", "universal.apk"),
        os.path.join(extract_dir, "base.apk"),
    ]
    
    for src_path in priority_paths:
        if os.path.exists(src_path):
            print(f"\n⏳ Encontrado APK universal: {src_path}")
            shutil.copy2(src_path, apk_output)
            size_mb = os.path.getsize(apk_output) / (1024 * 1024)
            print(f"✓ APK generado: {apk_output} ({size_mb:.2f} MB)")
            apk_found = True
            break
    
    # Si no encontró los paths prioritarios, buscar cualquier APK
    if not apk_found:
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if "universal" in file.lower() and file.endswith(".apk"):
                    src = os.path.join(root, file)
                    print(f"\n⏳ Copiando APK: {src}")
                    shutil.copy2(src, apk_output)
                    size_mb = os.path.getsize(apk_output) / (1024 * 1024)
                    print(f"✓ APK generado: {apk_output} ({size_mb:.2f} MB)")
                    apk_found = True
                    break
            if apk_found:
                break
    
    if not apk_found:
        print("⚠️ No se encontró APK universal en el AAB")
        print("\n💡 Intentando generar APK universal con bundletool...")
    
    # Limpiar
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
        print("\n✓ Carpeta temporal limpiada")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
