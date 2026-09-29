# Mejoras del proyecto — 27 de septiembre de 2026

## Cambios implementados

- Biblioteca PDF rediseñada en tonos marfil, café y dorado, con mayor contraste, tarjetas de documento, búsqueda sin distinguir tildes, orden por actividad reciente o título, progreso y eliminación visible.
- Importación con copia permanente dentro de la app, selección única, prevención de pulsaciones duplicadas y límite de 40 MB para reducir consumo de memoria.
- Lector PDF con PDF.js 3.11.174 y su motor incluidos como recursos locales, sin scripts de CDN. Se conserva la licencia en assets/pdfjs/LICENSE.
- Lectura de archivos con la API File de Expo; se eliminaron las conversiones manuales byte a byte y las estrategias de lectura sin tiempo límite.
- Zoom inicial al ancho de pantalla, rango de 50–300 %, resolución de canvas limitada y renderizado de páginas en serie.
- Reanudar la última página, navegación anterior/siguiente, salto a página, progreso y controles separados para voz y zoom.
- Voz con fragmentos limitados, cambio de velocidad y cancelación al salir o pasar la app a segundo plano. Los documentos escaneados muestran un aviso cuando no tienen texto seleccionable.
- Errores visibles y reintento para documentos inválidos, protegidos por contraseña, archivos perdidos y cierre del visor por falta de memoria.
- Guardados de biblioteca en cola: importar/eliminar y guardar progreso no se sobrescriben entre sí. Una biblioteca con datos inválidos produce un error y no se reemplaza silenciosamente.
- Compatibilidad con Expo 57: navegación, barra de estado, tipos de iconos y estilos.
- Carga de capítulos con cancelación lógica para que una petición antigua no reemplace el libro/idioma actual. La selección de versículos se reinicia al cambiar de lectura.
- Ajustes en animación de inicio e hidratación del tema web.

## Comprobaciones realizadas

- TypeScript: sin errores.
- ESLint en app, components, constants y hooks: sin errores ni advertencias.
- npm run test:pdf: siete pruebas aprobadas.
  - Fragmentación de voz sin pérdida de texto.
  - Guardado concurrente de progreso, importación y eliminación.
  - Protección de datos ante una biblioteca dañada.
  - Restauración de página, cola de renderizado y límite de memoria del canvas.
  - Mensaje para un PDF inválido.
  - Escape de etiquetas de script y ausencia de scripts remotos.
  - Lectura y extracción de texto de un PDF real con los recursos locales y acceso a red bloqueado.
- Metro: compilación de Android y web con respuesta HTTP 200.

Estas pruebas no sustituyen una prueba en el teléfono. El renderizado del canvas se probó con una interfaz simulada; la extracción de texto usó PDF.js real. No había un navegador conectado para revisión visual. No se ha verificado todavía el archivo concreto que fallaba al usuario.

## Prueba pendiente en Android

1. Recargar Expo Go y entrar en Leer PDF.
2. Importar un PDF de texto pequeño y comprobar que la primera página ocupa el ancho disponible.
3. Pasar de página, cambiar zoom y usar Ir.
4. Salir y volver a abrir: debe restaurarse la última página.
5. Activar Escuchar, cambiar velocidad, detener y salir; la voz debe detenerse.
6. Probar un PDF escaneado y el documento que antes fallaba.
7. Con la app ya cargada y los recursos descargados, comprobar lectura sin internet. En desarrollo, Expo Go necesita conexión con el servidor para cargar o recargar el proyecto.

La importación y el lector PDF están disponibles en Android/iOS. En web se muestra una explicación en lugar de intentar montar un WebView no compatible. Los PDF con contraseña y el reconocimiento OCR aún no están implementados.

## Ideas para la siguiente etapa

| Prioridad | Mejora | Resultado para el usuario |
| --- | --- | --- |
| Alta | Inicio con “Continuar leyendo” y últimas lecturas | Volver al capítulo o documento en un toque |
| Alta | Ajustes de lectura: tamaño de letra, interlineado y temas claro, sepia y oscuro | Leer cómodamente según la luz y la vista |
| Alta | Buscar palabras en Biblia y documentos | Encontrar pasajes sin recorrer páginas |
| Alta | Notas y marcadores con referencia a capítulo/página | Organizar el estudio personal |
| Media | Exportar e importar biblioteca, notas y favoritos | Cambiar de teléfono sin perder trabajo |
| Media | Carpetas o etiquetas: estudios, sermones, libros | Mantener una biblioteca grande ordenada |
| Media | OCR opcional para PDF escaneados | Escuchar y buscar texto dentro de imágenes |
| Media | Temporizador de audio y controles persistentes | Escuchar antes de dormir o durante otras tareas |
| Media | Planes de lectura con progreso semanal | Mantener una rutina de estudio |
| Posterior | Miniaturas, índice PDF y búsqueda dentro del documento | Navegar por libros largos con facilidad |

La línea visual propuesta mantiene el carácter de biblioteca: marfil para el fondo, café para acciones principales, dorado discreto para progreso, tipografía legible y menos decoración junto al texto. Conviene extenderla al inicio y al lector bíblico una vez comprobada en el teléfono.

## Comandos

- npm start: iniciar Expo.
- npm run typecheck: revisión de tipos.
- npm run test:pdf: pruebas del lector y biblioteca.
- npx eslint app components constants hooks --max-warnings 0: revisión estática del código principal.

