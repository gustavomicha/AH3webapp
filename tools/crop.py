import pickle,re,os,json
from PIL import Image
import numpy as np
from dl import fname
allc=pickle.load(open('allcards.pkl','rb'))
TOPS=set(l for l in open('tops.txt',encoding='utf-8').read().split('\n') if l)
Image.MAX_IMAGE_PIXELS=None
cache={}
def sheet(u):
    if u not in cache:
        if len(cache)>6: cache.clear()
        cache[u]=Image.open('sheets/'+fname(u)).convert('RGB')
    return cache[u]
def cropc(u,idx,nw,nh):
    im=sheet(u); W,H=im.size; w=W/nw; h=H/nh
    c=idx%nw; r=idx//nw
    return im.crop((round(c*w),round(r*h),round(c*w+w),round(r*h+h)))
recs=[]; seen={}
items=[(p,n,k) for p,n,k in allc if k and (n=='' or re.match(r'#\d+$',n)) and p and p[0] in TOPS]
items.sort(key=lambda t:t[2][0])
for p,n,k in items:
    face,idx,back,nw,nh,ub,_=k
    key=(face,idx)
    if key in seen: recs[seen[key]]['ctx'].append(p); continue
    f=cropc(face,idx,nw,nh)
    if ub: b=cropc(back,idx,nw,nh)
    else: b=Image.open('sheets/'+fname(back)).convert('RGB')
    i=len(recs); seen[key]=i
    fn=f'crops/f{i}.png'; bn=f'crops/b{i}.png'
    f.save(fn); 
    bkey=(back,idx if ub else -1)
    b.save(bn)
    g=np.asarray(f.convert('L').resize((48,64)),dtype=np.int16)
    gb=np.asarray(b.convert('L').resize((24,32)),dtype=np.int16)
    recs.append(dict(i=i,face=face,idx=idx,back=back,ub=ub,name=n,ctx=[p],size=f.size,sig=g.tolist(),bsig=gb.tolist()))
pickle.dump(recs,open('recs.pkl','wb'))
print(len(recs))
