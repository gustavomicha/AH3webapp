import json,re,collections
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image
src=open('doom_spaces.py',encoding='utf-8').read()
exec(src[:src.index('out, stats')])
out=json.load(open(W_+'doom_spaces.json',encoding='utf-8'))
out['358']=['Pension de Ma']; out['9001']=['Orden Esoterica de Dagon']
def count_icons(img, x0, ycen):
    h,w=img.shape; best=(0,1)
    for t in TS:
        hh,ww=t.shape
        ya,yb=max(0,int(ycen-hh*1.4)),min(h,int(ycen+hh*1.4))
        xa,xb=max(0,int(x0-3.5*ww)),min(w,int(x0+0.18*w))
        reg=img[ya:yb,xa:xb]
        if reg.shape[0]<hh or reg.shape[1]<ww: continue
        win=sliding_window_view(reg,(hh,ww))
        m=win.mean(axis=(2,3),keepdims=True); sd=win.std(axis=(2,3),keepdims=True)+1e-6
        col=((win-m)/sd*t).mean(axis=(2,3)).max(axis=0)
        if col.max()<0.55: continue
        half=max(2,int(ww*0.55)); peaks=0
        for i,v in enumerate(col):
            if v>=0.55 and v==col[max(0,i-half):i+half+1].max(): peaks+=1
        if col.max()>best[0]: best=(col.max(),max(1,peaks))
    return best[1]
res={}
for c in cards:
    if c['k']!='ev': continue
    names=out.get(str(c['id']),[])
    img=gray(Image.open(APP+f'img/c/{c["id"]}.webp')); h,w=img.shape
    items=ocr.get(f'f{G[c["id"]]["best"]}',[]) if c['id']<9000 else []
    lst=[]
    for nm in names:
        hit=next(((x,yy) for x,yy,t in items if norm(nm) in norm(t)),None)
        k=count_icons(img,hit[0]*w,(hit[1]+.012)*h) if hit else 1
        if c['id']==9001: k=2
        lst.append([nm,k])
    res[c['id']]=lst
json.dump(res,open(W_+'doom_spaces_final.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print(collections.Counter(sum(k for _,k in v) for v in res.values()))
print([ (i,v) for i,v in res.items() if any(k>1 for _,k in v)])
