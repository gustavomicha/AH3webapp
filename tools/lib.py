import json,collections
d=json.load(open('es.json',encoding='utf-8'))
top={x['GUID']:x for x in d['ObjectStates']}
SCEN=['a11a5e','52e9f2','d837bb','88a107','dbdd33','f75075','87e303','077a32','b17e16','2bf96f','505432','43be18','796851']
def cardkey(c,parent=None):
    cid=c['CardID']; k=str(cid//100)
    cd=(c.get('CustomDeck') or {}).get(k) or (parent.get('CustomDeck') or {}).get(k)
    return (cd['FaceURL'],cid%100,cd['BackURL'],cd['NumWidth'],cd['NumHeight'],cd.get('UniqueBack',False),c.get('Nickname',''))
