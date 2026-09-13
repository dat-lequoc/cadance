"""Generate a diagnostic MIDI retaining voice ownership through staff crossings."""
from pathlib import Path
import zipfile

out = Path('/tmp/cadance-ballade-hands')
out.mkdir(exist_ok=True)
with zipfile.ZipFile('public/pieces/chopin-ballade-1-source.zip') as archive:
    for name in archive.namelist():
        if not name.endswith('.ly'): continue
        text = archive.read(name).decode()
        if name.endswith('-defs.ly'):
            text = text.replace('staffUp = \\change Staff = "upper"', 'staffUp = {}')
            text = text.replace('staffDown = \\change Staff = "lower"', 'staffDown = {}')
        else:
            start = text.index('%-------Typeset music')
            end = text.index('%-------generate Midi')
            text = text[:start] + text[end:]
        (out / Path(name).name).write_text(text)
