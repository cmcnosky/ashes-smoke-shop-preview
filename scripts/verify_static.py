from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
ROOT=Path(__file__).resolve().parents[1]/'docs'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.refs=[];self.h1=0;self.images=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if t=='h1':self.h1+=1
  if t=='img':self.images.append(a);self.refs.append(a.get('src',''))
  if t in ['a','link']:self.refs.append(a.get('href',''))
  if t=='script' and 'src'in a:self.refs.append(a['src'])
  if t=='meta' and a.get('property')=='og:image':self.refs.append(a['content'].replace('https://cmcnosky.github.io/ashes-smoke-shop-preview/',''))
files={p.name:p for p in ROOT.glob('*.html')};parsed={}
for name,p in files.items():
 v=Page();v.feed(p.read_text());parsed[name]=v
errors=[];links=0
for name,p in parsed.items():
 if len(p.ids)!=len(set(p.ids)):errors.append([name,'duplicate IDs'])
 if p.h1!=1:errors.append([name,'h1 count',p.h1])
 for img in p.images:
  if img.get('src') and not img.get('alt'):errors.append([name,'missing image alt',img.get('src')])
 for url in p.refs:
  q=urlsplit(url)
  if q.scheme or q.netloc:continue
  path=unquote(q.path);target=ROOT/(path or name)
  if not target.exists():errors.append([name,'missing target',url])
  if q.fragment and target.name in parsed and q.fragment not in parsed[target.name].ids:errors.append([name,'missing fragment',url])
  links+=1
import re
for css in (ROOT/'assets').glob('*.css'):
 for ref in re.findall(r'url\([\"\']?([^\)\"\']+)',css.read_text()):
  if ref.startswith(('data:','http:','https:','#','%23')):continue
  links+=1
  if not (css.parent/ref).exists():errors.append([css.name,'missing CSS asset',ref])
result={'pages':len(files),'local_references_checked':links,'errors':errors}
Path(__file__).with_name('static-verification.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2));assert not errors
