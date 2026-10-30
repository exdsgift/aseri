import sys, io, base64
from PIL import Image
tpl, imgdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(tpl, encoding='utf-8').read()
total = 0
for name in ('mercury', 'hercules', 'apollo', 'melencolia'):
    b = io.BytesIO(); Image.open(f'{imgdir}/{name}.png').convert('L').save(b, 'JPEG', quality=64, optimize=True)
    uri = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    total += len(uri); html = html.replace(f'__IMG_{name}__', uri)
assert '__IMG_' not in html
open(out, 'w', encoding='utf-8').write(html)
print('images', total, 'page', len(html.encode('utf-8')))
