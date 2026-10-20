#!/usr/bin/env python3
"""Build a jsDelivr-compatible SVG entry point from the existing website.

No dependencies. Run this again after editing index.html, style.css, or script.js.
The original HTML site and its assets remain usable without changes.
"""

import json
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent


def inline_script(source):
    # HTML's script parser treats a closing script tag as markup, even in a JS string.
    return source.replace('</script', r'<\/script')


def build():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    script = (ROOT / 'script.js').read_text(encoding='utf-8')
    gn_math = (ROOT / 'gn-math.js').read_text(encoding='utf-8')
    gn_import = 'import { initializeGnMath } from "./gn-math.js";'
    if script.count(gn_import) != 1:
        raise SystemExit('Expected one initializeGnMath import in script.js.')
    script = script.replace(gn_import, gn_math.replace('export function initializeGnMath', 'function initializeGnMath', 1))

    # srcdoc has an about:srcdoc location. Resolve links against the SVG URL instead.
    script = script.replace('window.location.href', 'document.baseURI')
    script = script.replace('window.location.hash =', 'window.parent.location.hash =')
    script = script.replace('window.location.replace(', 'window.parent.location.replace(')
    # There is no favicon.ico in the source tree. Default means no custom icon.
    script = script.replace("'favicon.ico'", "'data:,'")

    stylesheet = '<link rel="stylesheet" href="style.css">'
    module = '<script type="module" src="script.js"></script>'
    if html.count(stylesheet) != 1 or html.count(module) != 1:
        raise SystemExit('Expected one style.css link and one script.js module in index.html.')
    # The existing icon setting expects this element; the source page omits it.
    if 'id="favicon-link"' not in html:
        html = html.replace('</head>', '<link id="favicon-link" rel="icon" href="data:,">\n</head>', 1)
    html = html.replace('<head>', '<head>\n<base id="svg-base">', 1)
    html = html.replace(stylesheet, '<style>\n' + css + '\n</style>')
    html = html.replace(module, '<script type="module">\n' + inline_script(script) + '\n</script>')

    # Escape XML delimiters inside the JS string so source edits cannot end CDATA.
    payload = json.dumps(html, ensure_ascii=True).replace('<', r'\u003c').replace('>', r'\u003e')
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
     style="position:fixed;inset:0;width:100%;height:100%;background:#53644b">
  <title id="site-title">New Tab</title>
  <desc>Geeks Bunker. Open this SVG directly in a browser to use the interactive website.</desc>
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%">
      <iframe id="site" title="Geeks Bunker" style="display:block;width:100%;height:100%;border:0"
              allow="autoplay; fullscreen; clipboard-write" allowfullscreen="allowfullscreen"></iframe>
      <noscript>This website needs JavaScript enabled.</noscript>
    </div>
  </foreignObject>
  <script><![CDATA[
(() => {
    const frame = document.getElementById('site');
    const page = __PAYLOAD__;
    const baseURL = new URL(window.location.href);
    baseURL.hash = '';
    const escapedURL = baseURL.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    // Keep the browser tab's title and icon in sync with the original Options UI.
    const icon = document.createElementNS('http://www.w3.org/1999/xhtml', 'link');
    icon.setAttribute('rel', 'icon');
    icon.setAttribute('href', 'data:,');
    document.documentElement.appendChild(icon);
    frame.addEventListener('load', () => {
        const child = frame.contentDocument;
        if (!child || !child.head) return;
        const syncTab = () => {
            document.getElementById('site-title').textContent = child.title;
            const childIcon = child.getElementById('favicon-link');
            if (childIcon) icon.setAttribute('href', childIcon.href);
        };
        syncTab();
        new MutationObserver(syncTab).observe(child.head, {
            subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['href']
        });
    });
    frame.srcdoc = page.replace('<base id="svg-base">', '<base href="' + escapedURL + '">');
})();
  ]]></script>
</svg>
'''.replace('__PAYLOAD__', payload)

    ET.fromstring(svg)  # A malformed XML file would show a parser error in the browser.
    output = ROOT / 'index.svg'
    output.write_text(svg, encoding='utf-8')
    size = output.stat().st_size
    if size > 20_000_000:
        raise SystemExit('SVG exceeds the conservative 20 MB jsDelivr GitHub file limit.')
    print(f'Built {output.name}: {size:,} bytes')
    print('Keep links.js, mojangles.otf, images/, and audio/ next to it.')


if __name__ == '__main__':
    build()
