"""Detecta en cada carta de Evento qué localización tiene el icono de Perdición (el espacio inestable).

Usa el OCR (posición de los nombres de localización) y busca la plantilla del icono a la izquierda de cada nombre.
Salida: tools/work/doom_spaces.json  {id_carta: [nombre de localización, ...]}
"""
import json, glob, pickle, re, unicodedata, collections
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image

APP = 'C:/dev/AH3app/'
W_ = 'C:/dev/AH3app/tools/work/'
ocr = {}
for f in glob.glob(W_ + 'ocr_*.json'):
    ocr.update(json.load(open(f, encoding='utf-8')))
G = pickle.load(open(W_ + 'groups.pkl', 'rb'))
src = open(APP + 'data.js', encoding='utf-8').read()
cards = json.loads(src.split('window.AH_CARDS=')[1].split(';\nwindow.AH_ES2EN=')[0])


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]', '', s)


# Nombres de localización por barrio: líneas que se repiten en sus cartas de Encuentro (con su forma escrita).
pretty = {}
cnt = collections.defaultdict(collections.Counter)
for c in cards:
    if c['k'] != 'nb':
        continue
    for x, y, t in ocr.get(f'f{G[c["id"]]["best"]}', []):
        t2 = re.sub(r'^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+', '', t).strip()
        k = norm(t2)
        if 5 <= len(k) <= 34:
            cnt[c['d']][k] += 1
            pretty.setdefault(k, collections.Counter())[t2] += 1
LOCS = {nb: [k for k, v in c.items() if v >= 5] for nb, c in cnt.items()}


def gray(im):
    return np.asarray(im.convert('L'), dtype=np.float32)


# Plantilla del icono de Perdición (carta 175, «Estación de trenes»)
ref = gray(Image.open(APP + 'img/c/175.webp'))
H, W = ref.shape
y0, y1, x0, x1 = int(.655 * H), int(.705 * H), int(.24 * W), int(.36 * W)
patch = ref[y0:y1, x0:x1]
ys, xs = np.where(patch < 110)
T = patch[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
T = (T - T.mean()) / (T.std() + 1e-6)
th, tw = T.shape
print('plantilla', T.shape)


TS = []
for sc in (0.75, 0.85, 0.95, 1.05, 1.15, 1.3):
    t = Image.fromarray(T).resize((max(8, round(tw * sc)), max(8, round(th * sc))))
    t = np.asarray(t, dtype=np.float32); t = (t - t.mean()) / (t.std() + 1e-6)
    TS.append(t)


def ncc_max(region):
    best = 0.0
    for t in TS:
        hh, ww = t.shape
        if region.shape[0] < hh or region.shape[1] < ww:
            continue
        win = sliding_window_view(region, (hh, ww))[::2, ::2]
        m = win.mean(axis=(2, 3), keepdims=True); sd = win.std(axis=(2, 3), keepdims=True) + 1e-6
        best = max(best, float(((win - m) / sd * t).mean(axis=(2, 3)).max()))
    return best


def best_ncc(img, ycen, xmax):
    h, w = img.shape
    ya, yb = max(0, int(ycen - th * 1.9)), min(h, int(ycen + th * 1.9))
    return ncc_max(img[ya:yb, 0:min(w, int(xmax) + 4)])


out, stats = {}, collections.Counter()
for c in cards:
    if c['k'] != 'ev':
        continue
    img = gray(Image.open(APP + f'img/c/{c["id"]}.webp'))
    h, w = img.shape
    key = f'f{G[c["id"]]["best"]}' if c['id'] < 9000 else None
    items = ocr.get(key, []) if key else []
    locs = LOCS.get(c['nb'], [])
    heads = {}
    for x, y, t in items:
        k = norm(re.sub(r'^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+', '', t))
        for L in locs:
            if k == L or (len(L) >= 8 and L in k and len(k) - len(L) <= 3):
                if L not in heads or y < heads[L][1]:
                    heads[L] = (x, y)
    scores = {L: best_ncc(img, (yy + .012) * h, (xx + .30) * w) for L, (xx, yy) in heads.items()}
    hits = [L for L, v in scores.items() if v >= 0.6]
    missing = [L for L in locs if L not in heads]
    if not hits and len(missing) == 1:
        hits = missing; stats['por descarte'] += 1; c['_desc'] = True
    if not hits:
        stats['sin icono'] += 1; c['_odd'] = True
    c['_sc'] = {k: round(v, 2) for k, v in scores.items()}
    stats[f'{len(hits)} espacios'] += 1
    out[c['id']] = [pretty[L].most_common(1)[0][0] for L in hits]
json.dump(out, open(W_ + 'doom_spaces.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(stats)
odd = [c['id'] for c in cards if c.get('_odd')]
print('raros', odd)
for c in cards:
    if c.get('_odd') or c['id'] in (179, 211, 247, 520):
        print(c['id'], out.get(c['id']), c.get('_sc'))
