"""Make a spacious engraving from the same source, retaining original notes."""
from pathlib import Path
import zipfile

out=Path('/tmp/cadance-ballade-layout')
out.mkdir(exist_ok=True)
with zipfile.ZipFile('public/pieces/chopin-ballade-1-source.zip') as archive:
    for name in archive.namelist():
        if not name.endswith('.ly'): continue
        text=archive.read(name).decode()
        if not name.endswith('-defs.ly'):
            text=text.replace('min-systems-per-page = 6','system-system-spacing.padding = #14\n    system-system-spacing.basic-distance = #35')
            text=text[:text.index('%-------generate Midi')]
        (out/Path(name).name).write_text(text)
