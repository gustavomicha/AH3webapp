import os,re,sys,urllib.request,hashlib
C=os.path.join(os.path.dirname(os.path.abspath(__file__)),'sheets')
def norm(u):
    u=u.strip()
    m=re.match(r'https?://cloud-3\.steamusercontent\.com/ugc/(\d+)/([0-9A-F]+)/?',u)
    if m: return f'https://steamusercontent-a.akamaihd.net/ugc/{m.group(1)}/{m.group(2)}/'
    return u.replace('http://','https://')
def fname(u):
    return hashlib.md5(u.strip().encode()).hexdigest()[:16]
def get(u):
    p=os.path.join(C,fname(u))
    if os.path.exists(p) and os.path.getsize(p)>1000: return p
    req=urllib.request.Request(norm(u),headers={'User-Agent':'Mozilla/5.0'})
    data=urllib.request.urlopen(req,timeout=120).read()
    open(p,'wb').write(data); return p
if __name__=='__main__':
    for u in sys.argv[1:]: print(get(u))
