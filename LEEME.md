# Arkham Horror 3ª ed. · Mazos

App local (sin internet) para reemplazar los mazos físicos de Encuentros, Eventos, Titulares, Anomalías, Terror y Archivo. Incluye los 13 escenarios de la caja básica, *Noche cerrada*, *Mareas tenebrosas* y *Secretos de la Orden*, siempre con todas las expansiones mezcladas.

## Abrir

Doble clic en `index.html` (Chrome o Edge). La partida se guarda sola en el navegador de esta PC.

## Uso

- **Tocar un mazo** roba la carta de arriba y la abre. Después eliges qué hacer con ella: al fondo (lo normal en un Encuentro), arriba, mezclarla entre las N primeras, al azar o moverla a otro mazo.
- **Cartas de Evento en un barrio**: «Gané la Pista» la manda al descarte de Eventos; «No la gané» la mezcla entre las 3 primeras.
- **Barra de Mitos** (abajo): Aparición de Pista, Propagar Perdición, Estallido de portal, Leer Titular y Propagar Terror (en los escenarios que lo usan).
- **⋯ en cada mazo**: robar de abajo o al azar, barajar, mirar o buscar cartas, marcar una Anomalía, quitar el módulo.
- **Códice / Archivo**: busca cartas por número o por texto. Toca una carta para darle la vuelta.
- **«Lo que pide esta cara»**: al abrir una carta del Códice aparecen botones con lo que indica su texto (añadir la carta N al Códice, darla vuelta, devolverla al Archivo, sortear entre X–Y, mezclar cartas en sus barrios, mazo de Investigación…). Tócalos sólo cuando se cumpla la condición de la carta. Se generaron leyendo el texto por OCR y se pueden corregir a mano en `acciones.js`.
- **Sorteos del Archivo** (pestaña Códice): plan B manual para «coge N al azar entre X e Y».
- **Deshacer**: botón ↶ o Ctrl+Z. **Registro**: todas las acciones con la hora.
- **Menú ☰**: guardar con nombre, exportar/importar la partida (.json), cambiar la N de «mezclar entre las N primeras».
- **En inglés**: si la carta nombra un Objeto, Aliado, Hechizo, carta especial, Monstruo o Estado, debajo se muestra su nombre en inglés.

Atajo: `index.html#nuevo=azathoth` prepara directamente una partida. Los ids están en `scenarios.js`.

## Origen de los datos

Las imágenes salen del mod de Tabletop Simulator «Arkham Horror 3ª edicion + Expansiones [Scripteado] - Español». Los nombres en inglés salen del mod «Arkham Horror 3rd Edition», emparejando las cartas por su ilustración. El texto de las cartas se leyó por OCR, así que puede tener algún error.
