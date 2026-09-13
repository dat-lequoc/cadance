"""Diagnostic scan measurements; proposals must be checked against the page images."""
import argparse
import json
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
pdf = pymupdf.open("public/pieces/chopin-ballade-1-barton.pdf")
cuts = json.loads(Path("scripts/scores/ballade-1-barton.cuts.json").read_text())
for page in pdf:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    dark = rgb.max(axis=2) < 130
    density = dark.sum(axis=1)
    # List five-line staff candidates from horizontal ink peaks. This is only a
    # diagnostic and deliberately does not decide measure or hand ownership.
    peaks = [y for y in range(2, len(density)-2) if density[y] > pix.width*.16 and density[y] == max(density[y-2:y+3])]
    staves = []
    for y in peaks:
        for gap in np.arange(7., 15., .5):
            positions = [min(peaks, key=lambda p: abs(p-y-k*gap)) for k in range(5)]
            if len(set(positions)) == 5 and max(abs(p-y-k*gap) for k,p in enumerate(positions)) < 2:
                if not staves or y > staves[-1][-1]+5:
                    staves.append(positions)
                break
    missing = {2: [224, 272], 3: [48], 8: [247], 19: [765]}
    for y in missing.get(page.number+1, []):
        staves.append([int(2*(y+4.8*k)) for k in range(5)])
    staves.sort(key=lambda s:s[0])
    print(page.number+1, "staves", [[round(y/2,1) for y in s] for s in staves])
    for i in range(0, len(staves)-1, 2):
        a,b=staves[i],staves[i+1]
        thick = dark.copy()
        thick[:,2:-2] = np.logical_or.reduce([dark[:,j:pix.width-4+j] for j in range(5)])
        # True grand-staff barlines also cross the inter-staff gap. This removes
        # aligned stems/chords, but broken/tilted lines still require review.
        profile = thick[a[0]+2:b[-1]-1].mean(axis=0)
        xs=np.where(profile>.80)[0]
        groups=[]
        for x in xs:
            if not groups or x-groups[-1][-1]>5: groups.append([int(x)])
            else: groups[-1].append(int(x))
        print("  system",i//2+1,"barline candidates",[round(sum(g)/len(g)/2,1) for g in groups if sum(g)/len(g)>50])
    image = Image.fromarray(rgb)
    draw = ImageDraw.Draw(image)
    for x in range(0, pix.width, 100):
        draw.line((x,0,x,pix.height), fill=(210,225,255), width=1)
        draw.text((x+2,3), str(x/2), fill="blue")
    for y in range(0, pix.height, 100):
        draw.line((0,y,pix.width,y), fill=(210,225,255), width=1)
        draw.text((2,y+3), str(y/2), fill="blue")
    for i,s in enumerate(staves):
        draw.text((pix.width-80,s[0]), str(i), fill="red")
    image.save(args.output / f"page-{page.number+1:02}.png")
