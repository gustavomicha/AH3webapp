from concurrent.futures import ThreadPoolExecutor
from dl import get
us=open('need_urls.txt').read().split('\n')
def f(u):
    for i in range(3):
        try: get(u); return None
        except Exception as e: err=e
    return (u,str(err))
with ThreadPoolExecutor(8) as ex:
    res=[r for r in ex.map(f,us) if r]
print('failed',len(res)); [print(r) for r in res]
