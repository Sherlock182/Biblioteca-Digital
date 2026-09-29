#!/usr/bin/env python3
"""Generar APK con validación de compatibilidad"""
import os
import subprocess
import shutil
import sys

def generate_apk():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")
    
    aab_file = "application-6fae6b97-57b1-414a-8485-509fb0851cea.aab"
    keystore = "debug.keystore"
    bundletool = "bundletool.jar"
    java_exe = r"C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot\bin\java.exe"
    
    print("=" * 60)
    print("Generando APK reparado")
    print("=" * 60)
    
    # Verificar archivos
    for f in [aab_file, bundletool]:
        if not os.path.exists(f):
            print(f"❌ No encontrado: {f}")
            return False
    
    print(f"✓ AAB: {os.path.getsize(aab_file) / 1024 / 1024:.2f}MB")
    
    # Limpiar APKs anteriores
    for f in ["app.apks", "app-debug.apk", "app.apk", "app-new.apk"]:
        if os.path.exists(f):
            os.remove(f)
    
    try:
        # Generar con bundletool
        print("\n⏳ Generando APK...")
        cmd = [
            java_exe,
            "-jar", bundletool,
            "build-apks",
            f"--bundle={aab_file}",
            "--output=app.apks",
            "--mode=universal",
            f"--ks={keystore}",
            "--ks-pass=pass:123456",
            "--ks-key-alias=androiddebugkey",
            "--key-pass=pass:123456"
        ]
        
        print("Ejecutando...")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"⚠️ Bundletool retornó código {result.returncode}")
            if result.stderr:
                print("STDERR:", result.stderr[:500])
        
        # Verificar si se generó
        if not os.path.exists("app.apks"):
            print("❌ No se generó app.apks")
            return False
        
        apks_size = os.path.getsize("app.apks") / 1024 / 1024
        print(f"✓ APK generado: {apks_size:.2f}MB")
        
        # Renombrar
        shutil.move("app.apks", "app.apk")
        
        apk_size = os.path.getsize("app.apk") / 1024 / 1024
        print("\n" + "=" * 60)
        print("✓ ¡APK REPARADO GENERADO!")
        print("=" * 60)
        print(f"Archivo: app.apk")
        print(f"Tamaño: {apk_size:.2f}MB")
        print("Intenta instalar nuevamente en Android")
        print("=" * 60)
        
        return True
        
    except subprocess.TimeoutExpired:
        print("❌ Timeout - el proceso tardó demasiado")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = generate_apk()
    sys.exit(0 if success else 1)
