# Herramientas de generación

Scripts que produjeron `data.js`, `acciones.js` e `img/` a partir del mod de Tabletop Simulator
«Arkham Horror 3ª edicion + Expansiones [Scripteado] - Español» (Workshop 2280310183) y del mod en inglés (2577586550).
No hacen falta para usar la app.

Orden aproximado (se ejecutaban desde una carpeta de trabajo con `es.json` = el JSON del mod):

1. `lib.py` / `dl.py` / `dlall.py` — leer el mod y descargar las hojas de sprites.
2. `crop.py` — recortar cada carta (cara y dorso).
3. `group.py` — agrupar duplicados y clasificar cartas por mazo (barrio, evento, archivo, anomalía, terror, titular).
4. `ocrall.py` — OCR de las cartas (RapidOCR); resultados en `work/ocr_*.json`.
5. `build_img.py` — exportar las imágenes WebP a `img/`.
6. `build_data.py` — generar `data.js` (cartas + diccionario español→inglés `work/es2en.json`).
7. `gen_actions2.py` — generar `acciones.js` (acciones sugeridas por carta del Archivo; incluye las correcciones manuales revisadas contra las imágenes).

`work/` guarda los datos intermedios (OCR, agrupación) para poder regenerar sin repetir el OCR.
Las rutas dentro de los scripts apuntan a la carpeta temporal original y a `C:/Users/gusta/Downloads/arkham-mazos`; hay que ajustarlas para volver a correrlos.
