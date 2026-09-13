"""Contact sheets for reviewing Ballade score crop geometry."""
import json
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw

cuts = json.loads(Path('scripts/scores/ballade-1.cuts.json').read_text())
doc = pymupdf.open('public/pieces/chopin-ballade-1-player.pdf')
out = Path('/tmp/cadance-ballade-review')
out.mkdir(exist_ok=True)
for start in range(0, len(cuts['systems']), 6):
    canvas = Image.new('RGB', (1160, 780), '#dddddd')
    draw = ImageDraw.Draw(canvas)
    for j,s in enumerate(cuts['systems'][start:start+6]):
        pix = doc[s['page']-1].get_pixmap(matrix=pymupdf.Matrix(1,1), clip=pymupdf.Rect(s['crop']))
        im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        x,y=(j%2)*580,(j//2)*260
        canvas.paste(im,(x,y+20))
        draw.text((x+5,y+2),f'System {start+j+1} / bars {s["fromBar"]}-{s["throughBar"]}',fill='blue')
    canvas.save(out/f'mutopia-crops-{start+1:02}.png')
