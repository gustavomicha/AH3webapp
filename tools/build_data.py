import pickle,json,collections,re,unicodedata,glob
G=pickle.load(open('groups.pkl','rb'))
backmap=json.load(open('backmap.json'))
evnb_back=pickle.load(open('evnb.pkl','rb'))
ocr={}
for f in glob.glob('ocr_*.json'): ocr.update(json.load(open(f,encoding='utf-8')))
SCID={'La llegada de Azathoth':'azathoth','El velo del crepúsculo':'velo','Festín de Umôrdhoth':'festin','Ecos de las profundidades':'ecos','Disparos en la oscuridad':'disparos','El silencio de Tsathoggua':'tsathoggua','La Lámpara Mortecina':'lampara','Sueños de R´lyeh':'rlyeh','La Progenie de Itaqua':'itaqua','Tiranos de la Desolación':'tiranos','La llave y la Puerta':'llave','Obligados a Servir':'obligados','Los Muertos Gritan':'muertos'}
ANSET={'x:Fisura temporal':'Fisura temporal','x:Realidad fracturada':'Realidad fracturada','x:Brecha de pesadillas':'Brecha de pesadillas',
 'La llegada de Azathoth':'Fisura temporal','El velo del crepúsculo':'Realidad fracturada','La llave y la Puerta':'Realidad fracturada','Ecos de las profundidades':'Brecha de pesadillas',
 'El silencio de Tsathoggua':'Yuggoth ascendente','La Lámpara Mortecina':'Visiones de la luna','Obligados a Servir':'Almas perdidas'}
TESET={'Frenesí devorador':'Frenesí devorador','Ciudad Helada':'Ciudad helada'}
def norm(s):
    s=unicodedata.normalize('NFKD',s.lower()); s=''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]','',s)
def lines(k): return [t for x,y,t in ocr.get(k,[])]
# ubicaciones por barrio
locs=collections.defaultdict(collections.Counter)
for gi,g in enumerate(G):
    nb=[c[1] for c in g['cats'] if c[0]=='NB']
    if nb:
        for t in set(norm(l) for l in lines(f"f{g['best']}")):
            if 4<=len(t)<=34: locs[nb[0]][t]+=1
NOEV={'Calles','Ruta de Viaje','Umbrales'}
LOC={nb:{t for t,c in cnt.items() if c>=3} for nb,cnt in locs.items() if nb not in NOEV}
def ev_nb(k):
    ls=[norm(l) for l in lines(k)]
    score=collections.Counter()
    for nb,ts in LOC.items():
        for t in ts:
            if any(t==l or (len(t)>=7 and t in l) for l in ls): score[nb]+=1
    if not score: return None,0
    (a,sa),*rest=score.most_common(2)+[(None,0)]
    return a, sa-(rest[0][1] if rest else 0)
cards=[]; stats=collections.Counter(); unsure=[]
for gi,g in enumerate(G):
    cs=g['cats']; ks={c[0] for c in cs}
    if not ks: continue
    b=backmap.get(str(gi))
    t=' '.join(lines(f"f{g['best']}"))
    if 'ARCH' in ks:
        n=[c[1] for c in cs if c[0]=='ARCH'][0]
        cards.append(dict(id=gi,k='ar',n=n,b=b,t=t+' || '+' '.join(lines(f"b{g['best']}")))); continue
    if 'NB' in ks:
        cards.append(dict(id=gi,k='nb',d=[c[1] for c in cs if c[0]=='NB'][0],b=b,t=t)); continue
    if ks & {'EV','EVX'}:
        sc=[c[1] for c in cs if c[0] in('EV','EVX')][0]
        x=1 if ('EVX' in ks and 'EV' not in ks) else 0
        nb,marg=ev_nb(f"f{g['best']}")
        src='ocr'
        if nb is None: nb=evnb_back.get(gi); src='back'
        stats[src]+=1
        if src=='back' or marg<1: unsure.append((gi,SCID[sc],nb,marg))
        c=dict(id=gi,k='ev',s=SCID[sc],nb=nb,b=b,t=t)
        if x: c['x']=1
        cards.append(c); continue
    if 'AN' in ks:
        v=[c[1] for c in cs if c[0]=='AN']; s=next(ANSET[a] for a in v if a in ANSET)
        cards.append(dict(id=gi,k='an',set=s,b=b,t=t)); continue
    if 'TE' in ks:
        cards.append(dict(id=gi,k='te',set=TESET[[c[1] for c in cs if c[0]=='TE'][0]],b=b,t=t)); continue
    if 'HL' in ks:
        cards.append(dict(id=gi,k='hl',b=b,t=t)); continue
print(stats, 'unsure',len(unsure))
json.dump(unsure,open('unsure.json','w'))
cnt=collections.Counter((c['s'],c['nb']) for c in cards if c['k']=='ev')
for k,v in sorted(cnt.items(),key=lambda kv:(kv[0][0],str(kv[0][1]))): print(k,v)
open('C:/Users/gusta/Downloads/arkham-mazos/data.js','w',encoding='utf-8').write('window.AH_CARDS='+json.dumps(cards,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(cards), collections.Counter(c['k'] for c in cards))
with open('C:/Users/gusta/Downloads/arkham-mazos/data.js','a',encoding='utf-8') as f:
    f.write('window.AH_ES2EN='+json.dumps(json.load(open('es2en.json',encoding='utf-8')),ensure_ascii=False)+';\n')
# Carta que falta en el mod en español: Evento 13/24 de «Tiranos de la Desolación» (Pueblo de Innsmouth), tomada del mod en inglés.
ref=next(c for c in cards if c['k']=='ev' and c['s']=='tiranos' and c['nb']=='Pueblo de Innsmouth')
en13=json.load(open('en_tyr/ocr.json',encoding='utf-8'))['9']['t']
cards.append(dict(id=9001,k='ev',s='tiranos',nb='Pueblo de Innsmouth',b=ref['b'],t=' '.join(en13),en=1))
open('C:/Users/gusta/Downloads/arkham-mazos/data.js','w',encoding='utf-8').write('window.AH_CARDS='+json.dumps(cards,ensure_ascii=False,separators=(',',':'))+';\nwindow.AH_ES2EN='+json.dumps(json.load(open('es2en.json',encoding='utf-8')),ensure_ascii=False)+';\n')
print('tiranos events',sum(1 for c in cards if c['k']=='ev' and c['s']=='tiranos'))
