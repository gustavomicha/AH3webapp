"""Genera acciones sugeridas para cada carta del Archivo a partir del texto (OCR).

Salida: C:/Users/gusta/Downloads/arkham-mazos/acciones.js
  AH_ACTIONS[n] = { f: [acciones del anverso], b: [acciones del reverso] }
  AH_ARCHNB[n]  = barrio al que pertenece una carta de Archivo con encuentros (13–17, 32–35, 161–165…)
"""
import json, re, glob, pickle, unicodedata, collections

G = pickle.load(open('groups.pkl', 'rb'))
ocr = {}
for f in glob.glob('ocr_*.json'):
    ocr.update(json.load(open(f, encoding='utf-8')))
src = open('C:/Users/gusta/Downloads/arkham-mazos/data.js', encoding='utf-8').read()
cards = json.loads(src.split('window.AH_CARDS=')[1].split(';\nwindow.AH_ES2EN=')[0])
AR = {c['n']: c for c in cards if c['k'] == 'ar'}


def fold(x):
    x = unicodedata.normalize('NFKD', x.lower())
    x = ''.join(ch for ch in x if not unicodedata.combining(ch))
    for a, b in [('c6dice', 'codice'), ('c0dice', 'codice'), ('codlce', 'codice'), ('acci6n', 'accion'), ('col6ca', 'coloca')]:
        x = x.replace(a, b)
    return re.sub(r'\s+', ' ', x)


def side_text(gi, side):
    items = sorted(ocr.get(f'{side}{G[gi]["best"]}', []), key=lambda t: (round(t[1] * 60), t[0]))
    return fold(' '.join(t[2] for t in items))


def ns(x):  # sin espacios, para frases que el OCR pegó
    return x.replace(' ', '')


# ---------- barrio de las cartas de Archivo con encuentros ----------
def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]', '', s)


locs = collections.defaultdict(collections.Counter)
for c in cards:
    if c['k'] == 'nb' and c['d'] not in ('Calles', 'Ruta de Viaje', 'Umbrales'):
        gi = c['id']
        for t in set(norm(t[2]) for t in ocr.get(f'f{G[gi]["best"]}', [])):
            if 5 <= len(t) <= 34:
                locs[c['d']][t] += 1
LOC = {nb: {t for t, k in cnt.items() if k >= 3} for nb, cnt in locs.items()}


NBNAMES = sorted(LOC, key=len, reverse=True)


def archive_nb(n):
    head = side_text(AR[n]['id'], 'f')[:40]
    for nb in NBNAMES:
        if re.match(r'\s*' + str(n) + r'\s+' + re.escape(fold(nb)), head):
            return nb
    txt = norm(side_text(AR[n]['id'], 'f'))
    score = collections.Counter()
    for nb, ts in LOC.items():
        for t in ts:
            if len(t) >= 7 and t in txt:
                score[nb] += 1
    if not score:
        return None
    (nb, s1), *rest = score.most_common(2)
    s2 = rest[0][1] if rest else 0
    return nb if s1 >= 2 and s1 > s2 else None


# ---------- acciones ----------
VERBS = [
    ('codex', r'(?:a[nñ]ad|agreg|se anad)\w*'),
    ('arch', r'devuelv\w*'),
    ('flip', r'da(?:le|r(?:le)?)? ?la ?vuelta'),
    ('back', r'lee ?el ?reverso'),
    ('take', r'\bgana\b'),
    ('show', r'\bcoge\b|aparece|muestra'),
]
NUMW = {'una': 1, 'un': 1, 'dos': 2, 'tres': 3, 'cuatro': 4}


def parse(text, me):
    acts = []
    for sent in re.split(r'(?<=[.;])\s*(?=[a-z(¿¡"“])', text):
        s = sent
        if 'no quites esta carta' in s or 'no devuelvas esta carta' in s:
            s = re.sub(r'\(?no (?:quites|devuelvas) esta carta[^.)]*\)?', ' ', s)
        # --- frases especiales con rango ---
        m = re.search(r'cartas?\s*(\d{1,3})\s*(?:-|–|—|a )\s*(\d{1,3})', s)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if b - a > 12 or b < a:
                m = None
        if m:
            if 'investigacion' in s and ('crea' in s or 'usando' in s):
                acts.append({'t': 'inv', 'a': a, 'b': b}); continue
            if 'azar' in s:
                km = re.search(r'(una|un|dos|tres|cuatro) (?:de ellas|carta al azar|al azar)', s) or re.search(r'elige (una|dos|tres)', s)
                acts.append({'t': 'rnd', 'k': NUMW[km.group(1)] if km else 1, 'a': a, 'b': b, 'hide': 'sin mirar' in s}); continue
            if 'aparta' in s:
                acts.append({'t': 'aside', 'a': a, 'b': b}); continue
            if 'mazo' in s and 'barrio' in s or ('coge' in s and 'archivo' in s and 'devuelv' not in s):
                acts.append({'t': 'mix', 'a': a, 'b': b}); continue
            if 'devuelv' in s:
                acts.append({'t': 'archr', 'a': a, 'b': b})
                s = s[:m.start()] + s[m.end():]
        # --- otras frases especiales ---
        if 'azar' in s and 'apartad' in s and 'vincula' in s:
            acts.append({'t': 'linkaside'}); continue
        if 'mazo de investigacion' in s:
            if 'aleatoria' in s and 'codice' in s:
                acts.append({'t': 'invpick'})
            elif 'aleatoria' in s and 'archivo' in s:
                acts.append({'t': 'invrnd'})
            elif 'primera carta' in s:
                acts.append({'t': 'invtop'})
            elif 'resto' in s and 'archivo' in s:
                acts.append({'t': 'invback'})
            elif 'solo quede una' in s:
                acts.append({'t': 'invlast'})
            continue
        if 'bajo esta carta' in s and ('muestra' in s or 'revela' in s):
            acts.append({'t': 'reveal'}); continue
        if 'mazo de titulares' in s and 'dos primeras' in s:
            for n in re.findall(r'carta (\d{1,3})', s):
                acts.append({'t': 'hlmix', 'n': int(n)})
            continue
        # --- verbos y números ---
        toks = []
        for kind, pat in VERBS:
            for mm in re.finditer(pat, s):
                toks.append((mm.start(), 'v', kind))
        for mm in re.finditer(r'cartas?\s*((?:\d{1,3}(?:\s*(?:,|y|e|u)\s*)?)+)', s):
            for nm in re.finditer(r'\d{1,3}', mm.group(1)):
                toks.append((mm.start(1) + nm.start(), 'n', int(nm.group())))
        for mm in re.finditer(r'esta ?carta', s):
            toks.append((mm.start(), 'n', 'me'))
        toks.sort(key=lambda t: t[0])
        verb = None
        for pos, typ, val in toks:
            if typ == 'v':
                verb = val
                continue
            n = me if val == 'me' else val
            if not (1 <= n <= 165):
                continue
            k = verb or 'show'
            if val == 'me' and k in ('codex', 'show', 'back'):
                continue
            if k == 'codex' and n == me:
                continue
            if k == 'show' and n < 3:
                continue
            if k == 'show' and 'junto al mazo' in s[pos:pos + 90]:
                k = 'link'
            a = {'t': k, 'n': n}
            if k == 'codex':
                tail = s[pos:pos + 80]
                if 'boca abajo' in tail and 'bocarriba' not in tail:
                    a['down'] = 1
            acts.append(a)
    # dedupe conservando el orden
    seen, out = set(), []
    for a in acts:
        key = json.dumps(a, sort_keys=True)
        if key not in seen:
            seen.add(key)
            out.append(a)
    # si una carta se añade al Códice, no ofrecer además "ver" la misma
    have = {(a['t'], a.get('n')) for a in out}
    out = [a for a in out if not (a['t'] == 'show' and any((t, a['n']) in have for t in ('codex', 'arch', 'flip', 'back')))]
    return out


# Correcciones manuales (texto cortado o ambiguo por OCR)
MANUAL = {
    (151, 'b'): [{'t': 'mix', 'a': 161, 'b': 165}, {'t': 'codex', 'n': 152}, {'t': 'arch', 'n': 151}],
    (12, 'f'): [{'t': 'flip', 'n': 11}],
    (20, 'b'): [{'t': 'flip', 'n': 21}, {'t': 'codex', 'n': 24}, {'t': 'codex', 'n': 25}, {'t': 'codex', 'n': 22}, {'t': 'arch', 'n': 20}],
    (106, 'b'): [{'t': 'invrnd'}, {'t': 'invlast'}, {'t': 'arch', 'n': 106}, {'t': 'arch', 'n': 107}],
    # --- revisión manual contra las imágenes ---
    (4, 'b'): [{'t': 'codex', 'n': 6, 'note': 'al mostrarse el indicador azul'},
               {'t': 'codex', 'n': 7, 'down': 1, 'note': 'al mostrarse el rojo, si la barrera fue destruida'},
               {'t': 'codex', 'n': 7, 'note': 'al mostrarse el rojo, si la barrera no fue destruida'},
               {'t': 'arch', 'n': 4, 'note': 'cuando se hayan mostrado el azul y el rojo'}],
    (5, 'f'): [{'t': 'codex', 'n': 4, 'note': 'con al menos 3 Pistas'}, {'t': 'codex', 'n': 8, 'note': 'con 7 Perdición'}, {'t': 'codex', 'n': 9, 'note': 'con 7 Perdición'}, {'t': 'arch', 'n': 5, 'note': 'con 7 Perdición'}],
    (42, 'b'): [{'t': 'codex', 'n': 44}, {'t': 'codex', 'n': 45}, {'t': 'arch', 'n': 42}, {'t': 'arch', 'n': 43}],
    (43, 'b'): [{'t': 'codex', 'n': 44, 'down': 1}, {'t': 'codex', 'n': 45, 'down': 1}, {'t': 'arch', 'n': 43}, {'t': 'arch', 'n': 42}],
    (77, 'b'): [{'t': 'codex', 'n': 79}, {'t': 'codex', 'n': 82}, {'t': 'arch', 'n': 77}],
    (78, 'b'): [{'t': 'codex', 'n': 79, 'down': 1}, {'t': 'codex', 'n': 82}, {'t': 'arch', 'n': 78}],
    (84, 'b'): [{'t': 'arch', 'n': 84, 'note': 'si 85 u 86 están en el Códice'}, {'t': 'codex', 'n': 85, 'note': 'con 8 Perdición'}],
    (117, 'f'): [{'t': 'board', 'nbs': ['Pueblo de Innsmouth', 'Costa de Innsmouth'], 'ev': 'Innsmouth'}, {'t': 'flip', 'n': 117}],
    (119, 'f'): [{'t': 'board', 'nbs': ['Pueblo de Innsmouth', 'Costa de Innsmouth'], 'ev': 'Innsmouth'}, {'t': 'flip', 'n': 119}],
    (118, 'f'): [{'t': 'board', 'nbs': ['Centro de Kingsport', 'Puerto de Kingsport'], 'ev': 'Kingsport'}, {'t': 'flip', 'n': 118}],
    (120, 'f'): [{'t': 'board', 'nbs': ['Centro de Kingsport', 'Puerto de Kingsport'], 'ev': 'Kingsport'}, {'t': 'flip', 'n': 120}],
    (117, 'b'): [{'t': 'codex', 'n': 108}, {'t': 'codex', 'n': 113, 'note': 'con 7 Perdición; esta carta se queda'}],
    (118, 'b'): [{'t': 'codex', 'n': 108}, {'t': 'codex', 'n': 114, 'note': 'con 7 Perdición; esta carta se queda'}],
    (119, 'b'): [{'t': 'codex', 'n': 108}, {'t': 'codex', 'n': 115, 'note': 'con 7 Perdición; esta carta se queda'}],
    (120, 'b'): [{'t': 'codex', 'n': 108}, {'t': 'codex', 'n': 116, 'note': 'con 7 Perdición; esta carta se queda'}],
    (125, 'f'): [{'t': 'flip', 'n': 122, 'note': 'si 122 está en el Códice'},
                 {'t': 'codex', 'n': 127, 'note': 'si 130 está en el Códice (lado «Resistir juntos»)'},
                 {'t': 'codex', 'n': 127, 'down': 1, 'note': 'si 130 no está en el Códice (lado «Resistir solos»)'},
                 {'t': 'archr', 'a': 121, 'b': 123}, {'t': 'codex', 'n': 126},
                 {'t': 'flip', 'n': 125, 'note': 'con 13 Perdición'}],
    (128, 'f'): [{'t': 'codex', 'n': 123, 'down': 1, 'note': 'si 125 no está en el Códice (lado «Un pacto nuevo»)'}],
    (129, 'f'): [{'t': 'codex', 'n': 123, 'down': 1, 'note': 'si 125 no está en el Códice (lado «Un pacto nuevo»)'}],
    (130, 'f'): [{'t': 'codex', 'n': 123, 'note': 'si 125 no está en el Códice (lado «Destruir los sellos»)'}],
    (131, 'f'): [{'t': 'codex', 'n': 128, 'note': 'con 0 Pistas'}, {'t': 'codex', 'n': 129, 'note': 'con 1–3 Pistas'}, {'t': 'codex', 'n': 130, 'note': 'con 4+ Pistas'}, {'t': 'arch', 'n': 131}],
    (132, 'f'): [{'t': 'codex', 'n': 128, 'note': 'con 0–2 Pistas'}, {'t': 'codex', 'n': 129, 'note': 'con 3–4 Pistas'}, {'t': 'codex', 'n': 130, 'note': 'con 5+ Pistas'}, {'t': 'arch', 'n': 132}],
    (133, 'f'): [{'t': 'codex', 'n': 128, 'note': 'con 0–2 Pistas'}, {'t': 'codex', 'n': 129, 'note': 'con 3 Pistas'}, {'t': 'codex', 'n': 130, 'note': 'con 4+ Pistas'}, {'t': 'arch', 'n': 133}],
    (134, 'f'): [{'t': 'codex', 'n': 128, 'note': 'con 0–1 Pistas'}, {'t': 'codex', 'n': 129, 'note': 'con 2–4 Pistas'}, {'t': 'codex', 'n': 130, 'note': 'con 5+ Pistas'}, {'t': 'codex', 'n': 25, 'note': 'con 5+ Pistas (lado «Surcar el vacío»)'}, {'t': 'arch', 'n': 134}],
    (138, 'f'): [{'t': 'show', 'n': 146}, {'t': 'hlmix', 'n': 146, 'note': 'cuando el Vidente de Mnar sea derrotado'}, {'t': 'flip', 'n': 138, 'note': 'con 13 Perdición'}],
    (140, 'b'): [{'t': 'codex', 'n': 141, 'note': 'si hay rojos mostrados'}, {'t': 'codex', 'n': 142, 'note': 'si hay azules mostrados'}, {'t': 'codex', 'n': 143, 'note': 'si hay verdes mostrados'}, {'t': 'arch', 'n': 140}],
    (142, 'f'): [{'t': 'rndto', 'a': 147, 'b': 149, 'to': 'El Mundo Subterráneo', 'pos': 'top', 'note': 'si hay dos indicadores azules mostrados'},
                 {'t': 'rndto', 'a': 147, 'b': 149, 'to': 'El Mundo Subterráneo', 'pos': 3, 'note': 'si no hay dos indicadores azules mostrados'},
                 {'t': 'flip', 'n': 142}],
    (147, 'f'): [{'t': 'arch', 'n': 147, 'note': 'si resolviste «Ciudad de los gugs»'}, {'t': 'totop', 'n': 147, 'to': 'El Mundo Subterráneo', 'note': 'si resolviste «Valle de Pnath» o «Las salas de Zin»'}],
    (148, 'f'): [{'t': 'arch', 'n': 148, 'note': 'si resolviste «Ciudad de los gugs»'}, {'t': 'totop', 'n': 148, 'to': 'El Mundo Subterráneo', 'note': 'si resolviste «Valle de Pnath» o «Las salas de Zin»'}],
    (149, 'f'): [{'t': 'arch', 'n': 149, 'note': 'si resolviste «Ciudad de los gugs»'}, {'t': 'totop', 'n': 149, 'to': 'El Mundo Subterráneo', 'note': 'si resolviste «Valle de Pnath» o «Las salas de Zin»'}],
    (151, 'b'): [{'t': 'mix', 'a': 161, 'b': 165, 'pos': 'top'}, {'t': 'codex', 'n': 152}, {'t': 'arch', 'n': 151}],
    (153, 'f'): [{'t': 'ms153'}, {'t': 'flip', 'n': 153}],
    (153, 'b'): [{'t': 'codex', 'n': 154, 'note': 'al mostrar el indicador verde'}, {'t': 'arch', 'n': 153}],
    (157, 'f'): [{'t': 'take', 'n': 158, 'note': 'con 1–3 investigadores'}, {'t': 'take', 'n': 159, 'note': 'con 4+ investigadores'}, {'t': 'flip', 'n': 157, 'note': 'cuando un investigador sea derrotado'}],
    (11, 'b'): [{'t': 'flip', 'n': 10, 'note': 'si 10 sigue en el Códice (antes de continuar)'}, {'t': 'show', 'n': 19}, {'t': 'codex', 'n': 18}, {'t': 'arch', 'n': 11}],
    (65, 'f'): [{'t': 'show', 'n': 74}, {'t': 'codex', 'n': 66, 'note': 'opción Padre Dagón (74 aparece en el Arrecife)'},
                {'t': 'show', 'n': 75}, {'t': 'codex', 'n': 67, 'note': 'opción Madre Hidra (75 aparece en el Arrecife)'},
                {'t': 'arch', 'n': 65, 'note': 'opción 3: con menos de tres Reliquias de los profundos'}],
    (73, 'f'): [{'t': 'show', 'n': 74}, {'t': 'show', 'n': 75}, {'t': 'codexclear', 'keep': [61, 73], 'note': 'todas menos la 61 y los Rumores'}, {'t': 'codex', 'n': 72}, {'t': 'flip', 'n': 73}],
    (93, 'b'): [{'t': 'codex', 'n': 99, 'note': 'opción «invocar y combatir a Ithaqua»'}, {'t': 'codex', 'n': 96, 'note': 'opción: si hay un indicador azul en la hoja'}, {'t': 'codex', 'n': 98, 'note': 'opción: si hay un indicador blanco en la hoja'}, {'t': 'arch', 'n': 93}],
    (94, 'b'): [{'t': 'codex', 'n': 100, 'note': 'opción «hacer añicos el Corazón de hielo»'}, {'t': 'codex', 'n': 96, 'note': 'opción: si hay un indicador verde en la hoja'}, {'t': 'codex', 'n': 97, 'note': 'opción: si hay un indicador blanco en la hoja'}, {'t': 'arch', 'n': 94}],
    (95, 'b'): [{'t': 'codex', 'n': 101, 'note': 'opción «salvaguarda eterna»'}, {'t': 'codex', 'n': 97, 'note': 'opción: si hay un indicador azul en la hoja'}, {'t': 'codex', 'n': 98, 'note': 'opción: si hay un indicador verde en la hoja'}, {'t': 'arch', 'n': 95}],
    (157, 'b'): [{'t': 'codex', 'n': 160, 'rside': 1}, {'t': 'arch', 'n': 157}],
    (158, 'f'): [{'t': 'take', 'n': 158}, {'t': 'flip', 'n': 158}],
    (158, 'b'): [{'t': 'take', 'n': 158}, {'t': 'flip', 'n': 158}],
    (159, 'f'): [{'t': 'take', 'n': 159}, {'t': 'flip', 'n': 159}],
    (159, 'b'): [{'t': 'take', 'n': 159}, {'t': 'flip', 'n': 159}],
}

actions, archnb = {}, {}
for n in sorted(AR):
    gi = AR[n]['id']
    e = {}
    for side in ('f', 'b'):
        acts = MANUAL.get((n, side)) or parse(side_text(gi, side), n)
        if acts:
            e[side] = acts
    if e:
        actions[n] = e
    nb = archive_nb(n)
    if nb:
        archnb[n] = nb

with open('C:/Users/gusta/Downloads/arkham-mazos/acciones.js', 'w', encoding='utf-8') as f:
    f.write('// Acciones sugeridas por carta del Archivo (generadas a partir del texto; se pueden corregir a mano).\n')
    f.write('// t: codex = añadir al Códice · arch = devolver al Archivo · flip = dar la vuelta · back = leer el reverso · show = ver\n')
    f.write('//    rnd = sortear k entre a–b · inv = mazo de Investigación a–b · mix = mezclar a–b en sus mazos de barrio · aside = apartar a–b\n')
    f.write('window.AH_ACTIONS = ' + json.dumps(actions, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('window.AH_ARCHNB = ' + json.dumps(archnb, ensure_ascii=False) + ';\n')
print('cartas con acciones', len(actions))
print(collections.Counter(a['t'] for e in actions.values() for acts in e.values() for a in acts))
print('archnb', archnb)
