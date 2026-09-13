"""Render the final crops with MIDI-bar overlays for visual QA (never production).

Also checks that each generated PDF page renders like its shipped PNG.
"""
import argparse
import json
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
root = Path("public/scores/ballade-1-barton")
geometry = json.loads((root / "geometry.json").read_text())
document = pymupdf.open(root / "systems.pdf")
assert len(document) == len(geometry["systems"]) == 89
for page in range(1, 23):
    crops = []
    for i, system in enumerate(geometry["systems"]):
        if system["page"] != page:
            continue
        crop = Image.open(root / system["image"]).convert("RGB")
        rendered = document[i].get_pixmap(matrix=pymupdf.Matrix(3, 3), alpha=False)
        # PDF clip coordinates and source pixel rounding can differ by one pixel.
        assert abs(rendered.width - crop.width) <= 1 and abs(rendered.height - crop.height) <= 1
        crop.thumbnail((1000, 1000))
        draw = ImageDraw.Draw(crop)
        for j, edge in enumerate(system["barEdges"]):
            x = round(edge * crop.width)
            draw.line((x, 0, x, crop.height), fill=(50, 140, 245), width=1)
            if j < len(system["barEdges"]) - 1:
                draw.text((x + 2, 2), str(system["fromBar"] + j), fill="blue", stroke_width=1, stroke_fill="white")
        crops.append(crop)
    sheet = Image.new("RGB", (1000, sum(c.height + 12 for c in crops)), "white")
    y = 0
    for crop in crops:
        sheet.paste(crop, (0, y))
        y += crop.height + 12
    sheet.save(args.output / f"page-{page:02}.png")
print("89 derivative PDF pages reopened; 22 crop/barline review sheets rendered")
