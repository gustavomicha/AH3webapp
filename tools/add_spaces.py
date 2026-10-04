"""Agrega a cada carta de Evento de data.js el campo sp = [[nombre_es, nombre_en, cantidad_de_iconos], ...]
con la(s) localización(es) marcadas con el icono de Perdición (espacio inestable).
Entrada: tools/work/doom_spaces_final.json (de doom_spaces.py + doom_count.py)."""
import json, re, unicodedata

APP = 'C:/dev/AH3app/'
LOC = {  # forma del OCR (sin tildes) -> (español correcto, inglés oficial)
    'Arkham Advertiser': ('Arkham Advertiser', 'Arkham Advertiser'),
    'Tienda de curiosidades': ('Tienda de curiosidades', 'Curiositie Shoppe'),
    'Estacion de trenes': ('Estación de trenes', 'Train Station'),
    'Manicomio Arkham': ('Manicomio Arkham', 'Arkham Asylum'),
    'Plaza de la Independencia': ('Plaza de la Independencia', 'Independence Square'),
    'La Bella Luna': ('La Bella Luna', 'La Bella Luna'),
    'Motel Hibb': ('Motel Hibb', "Hibb's Roadhouse"),
    'Comisaria': ('Comisaría', 'Police Station'),
    'Restaurante de Velma': ('Restaurante de Velma', "Velma's Diner"),
    'Jardines Bayfriar': ('Jardines Bayfriar', 'Bayfriar Gardens'),
    'Funeraria Duterte': ('Funeraria Duterte', 'Duterte Funeral Home'),
    'Logia del Crepusculo de Plata': ('Logia del Crepúsculo de Plata', 'Silver Twilight Lodge'),
    'Cabo del Halc6n': ('Cabo del Halcón', 'Falcon Point'),
    'Hotel Gilman House': ('Hotel Gilman House', 'Gilman House'),
    'Refineria Marsh': ('Refinería Marsh', 'Marsh Refinery'),
    'Orden Esoterica de Dagon': ('Orden Esotérica de Dagón', 'Esoteric Order of Dagon'),
    'Tienda de comestibles': ('Tienda de comestibles', 'First National Grocery'),
    'Prision de Innsmouth': ('Prisión de Innsmouth', 'Innsmouth Jail'),
    'Faro de North Point': ('Faro de North Point', 'North Point Lighthouse'),
    'La Soga y el Ancla': ('La Soga y el Ancla', 'The Rope and Anchor'),
    'Residencia St.Erasmus': ('Residencia St. Erasmus', "St. Erasmus's Home"),
    'Muelles': ('Muelles', 'River Docks'),
    'Club Tictac': ('Club Tictac', 'Tick-Tock Club'),
    'Isla ignota': ('Isla ignota', 'Unvisited Isle'),
    'Observatorio': ('Observatorio', 'Observatory'),
    'Biblioteca Orne': ('Biblioteca Orne', 'Orne Library'),
    'Facultad de Ciencias': ('Facultad de Ciencias', 'Science Building'),
    'Cueva Negra': ('Cueva Negra', 'Black Cave'),
    'Colmado': ('Colmado', 'General Store'),
    'Cementerio': ('Cementerio', 'Graveyard'),
    'Sociedad Historica': ('Sociedad Histórica', 'Historical Society'),
    'Pension de Ma': ('Pensión de Ma', "Ma's Boarding House"),
    'Iglesia del Sur': ('Iglesia del Sur', 'South Church'),
    'Ciudad de los gugs': ('Ciudad de los gugs', 'City of the Gugs'),
    'Valle de Pnath': ('Valle de Pnath', 'Vale of Pnath'),
    'Las salas de Zin': ('Las salas de Zin', 'Vaults of Zin'),
    'Colina del Ahorcado': ('Colina del Ahorcado', "Hangman's Hill"),
    'Hospital de Santa Maria': ('Hospital de Santa María', "St. Mary's Hospital"),
    'La vieja tienda de magia': ('La vieja tienda de magia', 'Ye Olde Magick Shoppe'),
    'Hospital Congregacional': ('Hospital Congregacional', 'Congregational Hospital'),
    'Escuela Hall': ('Escuela Hall', 'Hall School'),
    'Tienda de curiosidades de Neil': ('Tienda de curiosidades de Neil', "Neil's Curiosity Shop"),
    'Lo innombrable': ('Lo innombrable', 'The Unnamable'),
    'La casa de la bruja': ('La casa de la bruja', 'The Witch House'),
}
MANUAL = {234: [['Cabo del Halc6n', 2]], 259: [['Orden Esoterica de Dagon', 2]]}

res = json.load(open(APP + 'tools/work/doom_spaces_final.json', encoding='utf-8'))
src = open(APP + 'data.js', encoding='utf-8').read()
head, rest = src.split('window.AH_CARDS=', 1)
cards_txt, tail = rest.split(';\nwindow.AH_ES2EN=', 1)
cards = json.loads(cards_txt)
missing = set()
for c in cards:
    if c['k'] != 'ev':
        continue
    lst = MANUAL.get(c['id']) or res.get(str(c['id']), [])
    sp = []
    for nm, k in lst:
        if nm == 'Tienda de curiosidades' and c.get('nb') == 'Centro de Kingsport':
            nm = 'Tienda de curiosidades de Neil'
        if nm not in LOC:
            missing.add(nm)
            continue
        es, en = LOC[nm]
        sp.append([es, en, k])
    c['sp'] = sp
open(APP + 'data.js', 'w', encoding='utf-8').write(head + 'window.AH_CARDS=' + json.dumps(cards, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.AH_ES2EN=' + tail)
print('sin traducción:', missing)
print('eventos sin espacio:', [c['id'] for c in cards if c['k'] == 'ev' and not c['sp']])
