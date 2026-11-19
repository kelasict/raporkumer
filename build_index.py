"""Rakit apps-script/Index.html dari src/ (head.html + app.js sebagai base64 + tail.html)."""
import base64, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf8').read()
b64 = base64.b64encode(rd('src/app.js').encode('utf8')).decode()
wrapped = '\n'.join(b64[i:i + 100] for i in range(0, len(b64), 100))
out = rd('src/head.html') + '<script type="text/plain" id="appsrc">\n' + wrapped + '\n</script>' + rd('src/tail.html')
open(os.path.join(R, 'apps-script/Index.html'), 'w', encoding='utf8').write(out)
print('Index.html', len(out), 'bytes')
