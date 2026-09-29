# 🎧 AUDIOBOOK PIPELINE - GUÍA DE USO COMPLETA

## 📋 Resumen de la Implementación

Sistema completo de síntesis de voz para PDFs con:
- ✅ Extracción inteligente de texto desde PDFs (PDF.js)
- ✅ División automática en bloques optimizados
- ✅ Síntesis de voz con Azure Speech Services (opcional) o síntesis nativa
- ✅ Almacenamiento en caché eficiente
- ✅ Reproductor de audio con controles bonitos
- ✅ Soporte para velocidad variable (0.75x - 2x)

---

## 🔧 ARQUITECTURA

### Componentes Principales

```
app/pdf-audiobook.tsx
├─ Pantalla principal de audiobook para PDFs
├─ Carga el PDF y extrae texto
└─ Renderiza AudiobookPlayer

components/audiobook-player.tsx
├─ Orquesta la síntesis y reproducción
├─ Maneja el estado de generación
└─ Renderiza controles de audio

components/audio-player-controls.tsx
├─ Interfaz visual bonita
├─ Sliders de progreso
├─ Botones play/pausa/rewind/forward
└─ Selector de velocidad

constants/
├─ pdf-text-extractor.ts (Extrae texto de PDFs)
├─ azure-speech-service.ts (Síntesis con Azure)
├─ native-speech-service.ts (Síntesis nativa del dispositivo)
├─ audiobook-service.ts (Gestión de biblioteca de audios)
└─ audio-cache-manager.ts ✨ NUEVO (Caché eficiente de archivos)
```

---

## 🚀 USAR AUDIOBOOK PARA UN PDF

### Paso 1: Abrir PDF en la App

```typescript
// En pdf-library.tsx (Mi Biblioteca)
// Al presionar un botón "🎧 Audiobook"

navigation.push('pdf-audiobook', {
  bookmarkId: pdfId  // Solo funciona con PDFs
});
```

### Paso 2: Extracción Automática

1. El PDF se carga desde el FileSystem
2. Se extrae texto página por página
3. Se detectable párrafos automáticamente
4. Se dividen en bloques pequeños (máx 150 caracteres)

**Código en `pdf-text-extractor.ts`:**

```typescript
const extracted = await extractTextFromPDF(fileUri, bookId);
// Retorna: { blocks: [...], totalPages: 10, extractedAt: ... }
```

### Paso 3: Síntesis de Voz

**Opción A: Azure Speech Services (Mejor Calidad)**

```typescript
// Configurar variables de entorno
EXPO_PUBLIC_AZURE_SPEECH_API_KEY=tu_clave
EXPO_PUBLIC_AZURE_SPEECH_REGION=eastus

// Automáticamente usará Azure si la clave existe
const speechService = new AzureSpeechService(apiKey, region);
const audioBuffer = await speechService.synthesizeText(texto, {
  voice: 'es-ES-AlvaroNeural', // Voz neural elegante
  rate: 1,
  pitch: 0
});
```

**Opción B: Síntesis Nativa (Sin API Key required)**

```typescript
// Si no configuras Azure, automáticamente usa síntesis nativa
const speechService = nativeSpeechService;
const audioBuffer = await speechService.synthesizeText(texto);
// Usa Google TTS API (gratuita) o buffer simulado si no hay internet
```

### Paso 4: Almacenamiento en Caché

```typescript
// Nuevo: AudioCacheManager
import { AudioCacheManager } from '@/constants/audio-cache-manager';

// Guardar audio en caché local
const audioId = await AudioCacheManager.saveAudioBuffer(
  bookId,
  blockIndex,
  audioBuffer
);

// Obtener URI del archivo para reproducción
const audioUri = await AudioCacheManager.getAudioUri(audioId);
// Retorna: "file:///cache/audiobook_audio/..."

// Limpiar caché si excede límite
await AudioCacheManager.cleanupIfNeeded();
```

### Paso 5: Reproducción con Controles

```typescript
// AudiobookPlayer orquesta todo automáticamente

<AudiobookPlayer
  bookId={bookmark.id}
  extractedText={extractedText}
  apiKey={azureApiKey}        // Opcional
  region={azureRegion}         // Default: 'eastus'
/>

// Controles automáticos:
// ▶️ Play / ⏸ Pause
// ⏪ Rewind 10s / ⏩ Forward 10s
// 📊 Slider de progreso
// 🎚️ Velocidad: 0.75x, 1x, 1.25x, 1.5x, 2x
```

---

## 📊 FLUJO DE DATOS

```
PDF (archivo)
    ↓
[pdf-text-extractor.ts]
    ↓ Extrae y divide
TextBlock[] { page, order, text }
    ↓
[native/azure-speech-service.ts]
    ↓ Sintetiza
Buffer[] (audio MP3)
    ↓
[audio-cache-manager.ts]
    ↓ Guarda localmente
file:///cache/audiobook_audio/...
    ↓
[expo-av Audio.Sound]
    ↓ Reproduce
🎧 Audio en el dispositivo
```

---

## ⚙️ CONFIGURACIÓN

### Opción 1: Sin Azure (Síntesis Nativa) ✨ RECOMENDADO PARA DESARROLLO

**Ventajas:**
- ✅ Sin API Key requerida
- ✅ Funciona offline (parcialmente)
- ✅ Sin costo
- ✅ Usa síntesis de Google (gratuita)

**Desventajas:**
- ⚠️ Calidad de voz variable según dispositivo
- ⚠️ Depende de conexión para Google TTS

**Uso:**
```bash
# No requiere configuración, funcionará por defecto
npm start
```

### Opción 2: Con Azure Speech Services (Mejor Calidad)

**Ventajas:**
- ✅ Voces neurales profesionales
- ✅ Mejor pronunciación en español
- ✅ Más confiable

**Desventajas:**
- Requiere API Key
- Hay costo (pero S0 gratis 12 meses)

**Configuración:**

1. **Crear recurso en Azure:**
   - Portal: https://portal.azure.com
   - "+ Crear recurso" → "Speech"
   - Plan: S0 (gratis 12 meses)

2. **Obtener credenciales:**
   - Recurso → "Claves y punto de conexión"
   - Copiar: Clave 1, Región

3. **Configurar en la app:**
   
   **Opción A: `.env.local`**
   ```env
   EXPO_PUBLIC_AZURE_SPEECH_API_KEY=tu_clave_aqui
   EXPO_PUBLIC_AZURE_SPEECH_REGION=eastus
   ```
   
   **Opción B: `app.json` (Expo)**
   ```json
   {
     "expo": {
       "plugins": [
         ["expo-build-properties", {
           "android": {
             "userPermissions": ["android.permission.INTERNET"]
           }
         }]
       ]
     }
   }
   ```

4. **Reiniciar la app:**
   ```bash
   npm start
   # Presiona 'r' para recargar
   ```

---

## 🎯 CASOS DE USO

### Caso 1: PDF Pequeño (< 50 páginas)

```typescript
// Generación: ~ 2-5 minutos
// Caché: ~ 50-200 MB
// Reproducción: Fluida

// Mejor usar: Síntesis nativa (más rápido)
```

### Caso 2: PDF Mediano (50-200 páginas)

```typescript
// Generación: ~ 15-45 minutos
// Caché: ~ 200-800 MB
// Reproducción: Fluida

// Mejor usar: Azure (mejor calidad)
// O síntesis nativa en background
```

### Caso 3: PDF Grande (> 200 páginas)

```typescript
// Generación: > 1 hora
// Caché: > 1 GB (limpiar automáticamente)

// Consideraciones:
// - Generar en background
// - Limpiar caché regularmente
// - Romper en capítulos/partes
```

---

## 🧹 LIMPIEZA DE CACHÉ

```typescript
// Estadísticas del caché
const sizeBytes = await AudioCacheManager.getCacheSize();
const sizeMB = sizeBytes / 1024 / 1024;
console.log(`Caché: ${sizeMB.toFixed(2)} MB`);

// Limpiar automáticamente si excede 500 MB
await AudioCacheManager.cleanupIfNeeded();

// Limpiar audios de un libro específico
await AudioCacheManager.clearAudiosForBook(bookId);

// Eliminar un audio específico
await AudioCacheManager.removeAudio(audioId);
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### "Error: El texto no puede estar vacío"
- **Causa:** PDF sin texto extraíble (imagen escaneada)
- **Solución:** Usar OCR para extraer texto

### "Error 403: Invalid API Key (Azure)"
- **Causa:** Credencial incorrecta o región no coincide
- **Solución:** Verificar clave en portal.azure.com

### "Error: No hay audios disponibles"
- **Causa:** Síntesis falló o buffer vacío
- **Solución:** Verificar conexión a internet

### "Audio que se corta o suena raro"
- **Causa:** Fragmentación de bloques problemática
- **Solución:** Ajustar `maxChars` en `splitTextIntoBlocks()`

```typescript
// Aumentar tamaño de bloques si se corta
splitTextIntoBlocks(text, 200); // Aumentar de 150 a 200
```

---

## 📱 REQUISITOS DEL DISPOSITIVO

**Mínimos:**
- Android 5.0+ / iOS 12.0+
- RAM: 2 GB
- Almacenamiento: 500 MB+ disponible
- Conexión: Necesaria para síntesis inicial

**Recomendado:**
- Android 8.0+ / iOS 14.0+
- RAM: 4 GB+
- Almacenamiento: 2 GB+
- WiFi para generación de audios

---

## 🚀 OPTIMIZACIONES FUTURAS

```typescript
// TODO: Considerar implementar

// 1. Generación en Background
// - UseBackgroundFetch para generar audios de noche
// - Notificaciones de progreso

// 2. Streaming de Síntesis
// - Comenzar reproducción mientras se genera
// - No esperar a que todo esté completo

// 3. Sincronización Cloud
// - Guardar audiobooks en Firebase/Azure Storage
// - Acceder desde múltiples dispositivos

// 4. Reconocimiento de Voz
// - Buscar por transcripción
// - Marcadores de tiempo

// 5. Bookmarks de Audio
// - Guardar posición actual
// - Resumir desde último punto
```

---

## 📖 REFERENCIAS RÁPIDAS

**Archivos modificados/creados:**

- [app/pdf-audiobook.tsx](app/pdf-audiobook.tsx) - Pantalla principal
- [components/audiobook-player.tsx](components/audiobook-player.tsx) - Orquestador
- [components/audio-player-controls.tsx](components/audio-player-controls.tsx) - Controles UI
- [constants/audio-cache-manager.ts](constants/audio-cache-manager.ts) ✨ NUEVO
- [constants/native-speech-service.ts](constants/native-speech-service.ts) - Mejorado
- [constants/azure-speech-service.ts](constants/azure-speech-service.ts)
- [constants/pdf-text-extractor.ts](constants/pdf-text-extractor.ts)
- [constants/audiobook-service.ts](constants/audiobook-service.ts)

**Paquetes utilizados:**
- `expo-av` - Reproducción de audio
- `expo-file-system` - Acceso al sistema de archivos
- `expo-speech` - Síntesis de voz nativa
- `pdfjs-dist` - Extracción de PDF
- `axios` - Llamadas HTTP a Azure
- `@react-native-async-storage/async-storage` - Almacenamiento persistente

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Extracción de texto desde PDF con PDF.js
- [x] División automática en bloques cortos
- [x] Síntesis con Azure Speech Services
- [x] Síntesis nativa como fallback
- [x] Almacenamiento en caché de audios
- [x] Reproducción con expo-av
- [x] Controles de play/pausa/skip
- [x] Control de velocidad (0.75x - 2x)
- [x] Barra de progreso visual
- [x] Solo para PDFs (validación)
- [x] Gestión automática de caché

---

## 📞 SOPORTE

Para problemas específicos, revisar los logs en:
- Console de React Native (Flipper)
- Azure Portal (para errores de API)
- Device Log (adb logcat)

¡Listo para usar! 🎧🚀
