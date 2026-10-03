import pickle,json,os,sys
SH=int(sys.argv[1]);NS=int(sys.argv[2]);OUT=f'ocr_{SH}.json'
from rapidocr_onnxruntime import RapidOCR
from PIL import Image
import numpy as np,time
G=pickle.load(open('groups.pkl','rb'))
o=RapidOCR(); out={}
if os.path.exists(OUT): out=json.load(open(OUT,encoding='utf-8'))
for gi,g in enumerate(G):
    if gi%NS!=SH: continue
    b=g['best']; ks={c[0] for c in g['cats']}
    if not ks: continue
    sides=['f']+(['b'] if 'ARCH' in ks else [])
    for s in sides:
        k=f'{s}{b}'
        if k in out: continue
        im=Image.open(f'crops/{k}.png').convert('RGB')
        sc=760/im.size[0]
        if sc<1: im=im.resize((760,round(im.size[1]*sc)))
        r,_=o(np.asarray(im))
        out[k]=[(round(float(x[0][0][0])/im.size[0],3),round(float(x[0][0][1])/im.size[1],3),x[1]) for x in (r or [])]
    if gi%25==0: json.dump(out,open(OUT,'w',encoding='utf-8'),ensure_ascii=False); print(gi,flush=True)
json.dump(out,open(OUT,'w',encoding='utf-8'),ensure_ascii=False); print('done')
