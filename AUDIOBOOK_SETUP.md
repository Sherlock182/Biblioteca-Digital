##############################################################################
# 🎧 AUDIOBOOK CONFIGURATION - GUÍA DE CONFIGURACIÓN
##############################################################################

# IMPORTANTE: Este archivo explica cómo configurar las credenciales de Azure
# para que el sistema de síntesis de voz (Text-to-Speech) funcione.

##############################################################################
# PASO 1: CREAR RECURSO EN AZURE
##############################################################################

# 1. Ve a https://portal.azure.com
# 2. Haz clic en "+ Crear un recurso"
# 3. Búsca "Speech" en el search
# 4. Selecciona "Speech" -> Crear
# 5. Llena los campos:
#    - Grupo de recursos: Crea uno nuevo o usa uno existente
#    - Región: Selecciona la más cercana (ej: "East US", "West Europe")
#    - Nombre: Algo como "biblias-audiobook-speech"
#    - Plan de tarifa: Haz clic en "Cambiar plan de tarifa" y selecciona "S0" (gratis durante 12 meses)
# 6. Haz clic en "Revisar y crear" -> "Crear"

##############################################################################
# PASO 2: OBTENER LAS CREDENCIALES
##############################################################################

# Una vez creado el recurso:
# 1. Ve al recurso creado
# 2. En el menú izquierdo, haz clic en "Claves y punto de conexión"
# 3. Copia:
#    - Clave 1 (API Key)
#    - Región (ej: "eastus", "westeurope")

##############################################################################
# PASO 3: CONFIGURAR EN TU APP
##############################################################################

# Opción A: Variables de entorno (.env.local)
# Crea un archivo llamado ".env.local" en la raíz del proyecto:

EXPO_PUBLIC_AZURE_SPEECH_API_KEY=tu_clave_aqui
EXPO_PUBLIC_AZURE_SPEECH_REGION=eastus

# Opción B: Hardcodear en el código (NO RECOMENDADO para producción)
# En app/pdf-audiobook.tsx, reemplaza:
# const AZURE_API_KEY = process.env.EXPO_PUBLIC_AZURE_SPEECH_API_KEY || '';
# Con tu clave directa (solo para testing)

##############################################################################
# PASO 4: PROBAR
##############################################################################

# 1. Reinicia el servidor Expo
# 2. Abre un PDF en "Mi Biblioteca"
# 3. Presiona el botón 🎧 (Audiobook)
# 4. Debería comenzar a generar audios

##############################################################################
# VOCES DISPONIBLES EN ESPAÑOL
##############################################################################

# es-ES-AlvaroNeural      - Voz masculina elegante (PREDETERMINADA)
# es-ES-IsabelNeural      - Voz femenina natural
# es-ES-ElviraNeural      - Voz femenina dramática

##############################################################################
# REGIONES DISPONIBLES
##############################################################################

# eastus                   - Este de EE.UU.
# westus                   - Oeste de EE.UU.
# westeurope               - Europa Occidental
# eastasia                 - Asia Oriental
# southeastasia            - Sudeste Asiático

##############################################################################
# COSTOS
##############################################################################

# Tier gratuito S0:
# - 1 millón de caracteres/mes gratis durante 12 meses
# - Después: ~$16 por millón de caracteres

# Tip: Un PDF de 100 páginas = ~50,000 caracteres
# Puedes procesar ~20 PDFs grandes gratuitamente cada mes

##############################################################################
# SOLUCIÓN DE PROBLEMAS
##############################################################################

# ❌ "API key no configurada"
# -> Asegúrate de haber creado el archivo .env.local
# -> O agregado las variables en .env si usas expo

# ❌ "Error 403: Invalid Key"
# -> Copia bien la clave desde Azure
# -> Verifica que sea "Clave 1" o "Clave 2" (no son ambas iguales)

# ❌ "Error 401: Unauthorized"
# -> La región no coincide con la clave
# -> Verifica que uses la misma región que dice en Azure

# ❌ Síntesis muy lenta
# -> Normal para primeras generaciones
# -> Los audios se cachean en device storage
# -> Próximas búsquedas serán instantáneas

##############################################################################
# INFORMACIÓN DE DESARROLLO
##############################################################################

Documentación oficial: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
Portal de Azure: https://portal.azure.com
Pricing: https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/

##############################################################################
