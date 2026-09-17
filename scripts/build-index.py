from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
IGNORE_DIRS = {'.git', '.github', 'scripts'}
IGNORE_FILES = {'index.html', 'styles.css', 'app.js', 'assets.json', 'README.md'}
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'}

assets = []
for path in ROOT.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(ROOT)
    if any(part in IGNORE_DIRS for part in rel.parts):
        continue
    if path.name in IGNORE_FILES or path.suffix.lower() not in IMAGE_EXTENSIONS:
        continue
    assets.append({'path': rel.as_posix()})

assets.sort(key=lambda x: x['path'].lower())
(ROOT / 'assets.json').write_text(
    json.dumps({'version': 1, 'assets': assets}, ensure_ascii=False, separators=(',', ':')),
    encoding='utf-8'
)
print(f'Indexed {len(assets)} assets')
