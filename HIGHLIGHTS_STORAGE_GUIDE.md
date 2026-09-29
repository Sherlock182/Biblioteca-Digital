# 📌 Guía de Marcadores Persistentes en Chapter Reader

## ✅ Problemas Arreglados

El sistema de marcadores (highlights) ahora **guarda permanentemente** los versículos marcados. Los cambios principales son:

### 1. **Preservación de Estado Multi-Capítulo**
- **Antes**: Cuando marcabas un versículo y navegabas a otro capítulo, se perdía toda la información
- **Ahora**: El estado se actualiza correctamente: `setHighlightedVerses(prev => ({ ...prev, [key]: value }))`

### 2. **Mejor Persistencia en Storage**
- MMKV para Android/iOS (nativo, más rápido)
- localStorage para Web (fallback)
- Manejo robusto de errores con logs

### 3. **Inicialización Confiable de MMKV**
- Verificación explícita de disponibilidad
- Logs para debugging
- Fallback automático si falla

### 4. **Carga Correcta de Highlights por Capítulo**
- Usa la clave correcta: `highlights_{collectionId}_{book}_{chapter}`
- Carga datos al cambiar de capítulo
- Preserva datos de capítulos anteriores

## 🔄 Flujo de Funcionamiento

### Marcar un Versículo
```
Usuario toca versículo en modo marcado
→ Se actualiza state: highlightedVerses[key] = [...números]
→ Se guarda en MMKV/localStorage
→ ✓ Verificación de guardado en logs
```

### Desmarcar un Versículo
```
Usuario toca "Desmarcar este versículo"
→ Se filtra el número del array
→ Se guarda el array actualizado
→ Se actualiza visualmente
→ ✓ Cambio persistente
```

### Cambiar de Capítulo
```
Usuario selecciona nuevo capítulo
→ Cambia highlightStorageKey
→ Se ejecuta useEffect
→ Carga highlights del storage para ESE capítulo
→ Muestra los versículos marcados previamente
```

### Cerrar y Abrir App
```
Usuario cierra app completamente
→ MMKV/localStorage mantiene los datos
Usuario abre app y navega al capítulo
→ Se cargan automáticamente los highlights guardados
→ ✓ Nada se pierde
```

## 🛠 Debugging - Ver los Logs

Abre la consola de Expo Go y busca mensajes como:

```
✓ Highlights guardados para: highlights_rv1960_Genesis_1
✓ Highlights cargados de MMKV: highlights_rv1960_Genesis_1
✓ Highlights encontrados (5 versículos): 1, 3, 7, 12, 18
✓ MMKV inicializado correctamente
```

Si ves warnings:
```
⚠ MMKV no disponible, usando fallback a localStorage
```

Significa que está usando localStorage (probablemente en web), que también funciona bien.

## 📱 Cómo Usar

1. **Abre un capítulo cualquiera**
2. **Toca un versículo y elige "Marcar versículos"**
3. **Marca los versículos que quieras tocándolos**
4. **Toca otro versículo para abrir opciones → "Salir del marcador"**
5. **Los versículos permanecerán marcados incluso si:**
   - Cambias de capítulo
   - Cambias de libro
   - Cierras y abres la app
   
6. **Para desmarcar un versículo:**
   - Toca el versículo marcado → "Desmarcar este versículo"
   - O vuelve al modo marcado y toca para deseleccionar

## ⚠️ Notas Importantes

- Los marcadores están **guardados por capítulo**, no globalmente
- Cada combinación de (Biblia + Libro + Capítulo) tiene su propio set de marcadores
- Los datos se guardan NO cuando sales del modo marcado, sino **inmediatamente cuando marcas/desmaarcas** un versículo
- En Expo Go en Android, usa MMKV (almacenamiento nativo rápido)

## 🔍 Si Algo No Funciona

Revisa la consola (Expo Go → conexión → logs) para mensajes de error:

```javascript
console.log() → Información general
console.warn() → Advertencias (generalmente fallbacks)
```

Si ves muchos warnings sobre MMKV, es que Expo Go no lo tiene instalado. En ese caso,
revisa que `react-native-mmkv` esté en `package.json`.

