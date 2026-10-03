import pickle,numpy as np,collections,re
recs=pickle.load(open('recs.pkl','rb')); D=np.load('D.npy')
BASEARCH={i:40-t for t,i in enumerate(range(1057,1097))}
n=len(recs); par=list(range(n))
def f(x):
    while par[x]!=x: par[x]=par[par[x]]; x=par[x]
    return x
for i,j in zip(*np.where(D<0.11)): par[f(i)]=f(j)
groups=collections.defaultdict(list)
for i in range(n): groups[f(i)].append(i)
NB=['Barrio Este','Barrio Fluvial','Centro','Periferia','Distrito Comercial','Barrio Norte','Barrio Sur','Universidad Miskatonic','Calles','Centro de Kingsport','Puerto de Kingsport','Costa de Innsmouth','Pueblo de Innsmouth','French Hill','El Mundo Subterráneo','La Casa de la Bruja','Lo Innombrable','La extraña Casa en la Niebla','La estraña Casa en la Niebla','Arrecife del Diablo','Ruta de Viaje','Umbrales','Encuentros - El Mundo Subterráneo']
AN={'Fisura temporal','Realidad fracturada','Brecha de pesadillas','Mazo de Anomalias','Mazo de Anomalías'}
TE={'Frenesí devorador','Ciudad Helada'}
SCN=['La llegada de Azathoth','El velo del crepúsculo','Festín de Umôrdhoth','Ecos de las profundidades','Disparos en la oscuridad','El silencio de Tsathoggua','La Lámpara Mortecina','Sueños de R´lyeh','La Progenie de Itaqua','Tiranos de la Desolación','La llave y la Puerta','Obligados a Servir','Los Muertos Gritan']
EVOLD={'La llegada de Azathoth':0,'Eco de las profundidades':3,'El velo del crepusculo':1,'Festín de Unmôrdhoth':2}
def cats(p,name):
    last=p[-1]; out=[]
    if re.match(r'#\d+$',name): out.append(('ARCH',int(name[1:])))
    if last in NB: out.append(('NB',last.replace('estraña','extraña').replace('Encuentros - ','')))
    if last in AN: out.append(('AN',p[0] if p[0] in SCN else 'x:'+last))
    if last in TE: out.append(('TE',last))
    if last=='Mazo de Eventos' and p[0] in SCN: out.append(('EV',p[0]))
    if last in EVOLD: out.append(('EV',SCN[EVOLD[last]]))
    if last=='Eventos - El Mundo Subterráneo': out.append(('EVX','La llave y la Puerta'))
    if last in ('Cartas de Evento de Kingsport','Cartas de Evento de Innsmouth'): out.append(('EVX','Sueños de R´lyeh'))
    if last=='Mazo de Titulares': out.append(('HL',''))
    return out
G=[]
for root,mem in groups.items():
    cs=collections.Counter(); ctxs=[]
    for i in mem:
        for p in recs[i]['ctx']:
            ctxs.append(' / '.join(p))
            for c in cats(p,recs[i]['name']): cs[c]+=1
        if i in BASEARCH: cs[('ARCH',BASEARCH[i])]+=1
    best=max(mem,key=lambda i:recs[i]['size'][0]*recs[i]['size'][1])
    G.append(dict(mem=mem,best=best,cats=cs,ctxs=ctxs,name=recs[best]['name']))
pickle.dump(G,open('groups.pkl','wb'))
print('groups',len(G))
kinds=collections.Counter()
for g in G:
    ks={c[0] for c in g['cats']}
    kinds[tuple(sorted(ks))]+=1
print(kinds)
