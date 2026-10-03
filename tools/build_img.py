import pickle,hashlib,json,numpy as np
from PIL import Image
G=pickle.load(open('groups.pkl','rb'))
OUT='C:/Users/gusta/Downloads/arkham-mazos/img/'
backs={}; backmap={}
def save(im,path,w,q=80):
    im=im.convert('RGB')
    if im.size[0]>w: im=im.resize((w,round(im.size[1]*w/im.size[0])),Image.LANCZOS)
    im.save(OUT+path,'WEBP',quality=q,method=5)
for gi,g in enumerate(G):
    ks={c[0] for c in g['cats']}
    if not ks: continue
    b=g['best']
    save(Image.open(f'crops/f{b}.png'),f'c/{gi}.webp',700)
    bi=Image.open(f'crops/b{b}.png').convert('L').resize((24,34))
    h=hashlib.md5((np.asarray(bi)//24).tobytes()).hexdigest()[:10]
    if 'ARCH' in ks:
        save(Image.open(f'crops/b{b}.png'),f'c/{gi}b.webp',700); backmap[gi]=f'{gi}b'
    else:
        if h not in backs:
            backs[h]=len(backs); save(Image.open(f'crops/b{b}.png'),f'b/{backs[h]}.webp',420,75)
        backmap[gi]=backs[h]
json.dump(backmap,open('backmap.json','w'))
print('backs',len(backs))
