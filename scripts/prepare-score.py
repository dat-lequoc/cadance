"""Propose/review PDF system cuts, then render reproducible score assets.

Run with --help. Coordinates are PDF points, origin top-left; pages are one-based.
Detection is for vector grand-staff scores. Scans require manually authored cuts.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pymupdf


def propose(pdf):
    systems = []
    bar = 1
    for page_number, page in enumerate(pdf, 1):
        drawings = page.get_drawings()
        ys = sorted({round(d["rect"].y0, 2) for d in drawings
                     if d["rect"].width > page.rect.width * .65 and d["rect"].height < 1})
        staves = []
        for i, y in enumerate(ys[:-4]):
            gap = ys[i + 1] - y
            if 3 < gap < 9 and all(abs(ys[i + k] - y - gap * k) < .1 for k in range(5)):
                if not staves or y > staves[-1][0] + staves[-1][1] * 4 + 1:
                    staves.append((y, gap))
        if len(staves) % 2 or not staves:
            raise ValueError(f"Page {page_number}: cannot pair grand staves; author cuts manually")
        for i in range(0, len(staves), 2):
            top, gap = staves[i]
            bottom, lower_gap = staves[i + 1]

            def lines(y, height):
                return [d["rect"].x0 for d in drawings if d["rect"].width < 2
                        and abs(d["rect"].y0 - y) < .4
                        and abs(d["rect"].y1 - y - height) < .5]

            lower = lines(bottom, lower_gap * 4)
            xs = [x for x in lines(top, gap * 4) if any(abs(x - z) < .5 for z in lower)]
            xs += lines(top, bottom + lower_gap * 4 - top)
            edges = []
            for x in sorted(xs):
                if not edges or x - edges[-1] > 3:
                    edges.append(round(x, 2))
            if len(edges) < 2:
                raise ValueError(f"Page {page_number}: no complete bar boundaries")
            last = bar + len(edges) - 2
            systems.append({"page": page_number, "fromBar": bar, "throughBar": last,
                            "crop": [8, round(max(32, top - 45), 2),
                                     round(page.rect.width - 15, 2),
                                     round(min(page.rect.height - 12, bottom + lower_gap * 4 + 38), 2)],
                            "barEdges": edges})
            bar = last + 1
    return {"version": 1, "reviewed": False, "expectedBars": bar - 1, "systems": systems}


def render(pdf, cuts, output, scale):
    if cuts.get("version") != 1 or cuts.get("reviewed") is not True:
        raise ValueError("Visually check every proposed crop and bar boundary, then set reviewed: true")
    output.mkdir(parents=True, exist_ok=True)
    geometry = []
    next_bar = 1
    cropped = pymupdf.open()
    for index, system in enumerate(cuts["systems"]):
        first, last = system["fromBar"], system["throughBar"]
        page = pdf[system["page"] - 1]
        rect = pymupdf.Rect(system["crop"])
        edges = system["barEdges"]
        if (first != next_bar or last < first or len(edges) != last - first + 2
                or not page.rect.contains(rect) or rect.is_empty
                or any(a >= b for a, b in zip(edges, edges[1:]))
                or edges[0] < rect.x0 or edges[-1] > rect.x1):
            raise ValueError(f"Invalid crop/bar coverage at system {index + 1}")
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=rect, alpha=False)
        name = f"system-{index + 1:02}.png"
        pix.save(str(output / name))
        target = cropped.new_page(width=rect.width, height=rect.height)
        target.show_pdf_page(target.rect, pdf, system["page"] - 1, clip=rect)
        geometry.append({"image": name, "width": pix.width, "height": pix.height,
                         "page": system["page"], "fromBar": first, "throughBar": last,
                         "barEdges": [round((x * scale - pix.x) / pix.width, 7) for x in edges]})
        next_bar = last + 1
    if next_bar - 1 != cuts["expectedBars"]:
        raise ValueError("Expected bar count differs from crop coverage")
    cropped.save(str(output / "systems.pdf"), garbage=4, deflate=True)
    return geometry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["propose", "render"])
    parser.add_argument("pdf", type=Path)
    parser.add_argument("cuts", type=Path, help="Reviewed JSON with page/crop/fromBar/throughBar/barEdges per system")
    parser.add_argument("--output", type=Path, default=Path("/tmp/cadance-score"))
    parser.add_argument("--scale", type=float, default=3, help="Pixels per PDF point; default 216 DPI")
    args = parser.parse_args()
    if not 1 <= args.scale <= 6:
        parser.error("scale must be between 1 and 6")
    with pymupdf.open(args.pdf) as pdf:
        digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
        if args.action == "propose":
            if args.cuts.exists():
                parser.error("Proposal destination exists; choose a new file to preserve reviewed cuts")
            cuts = propose(pdf)
            cuts["pdfSha256"] = digest
            args.cuts.parent.mkdir(parents=True, exist_ok=True)
            args.cuts.write_text(json.dumps(cuts, indent=2) + "\n")
            print(f"Proposed {len(cuts['systems'])} systems / {cuts['expectedBars']} bars. Review before rendering.")
        else:
            cuts = json.loads(args.cuts.read_text())
            if cuts["pdfSha256"] != digest:
                raise ValueError("PDF has changed; review cuts against the new source")
            geometry = render(pdf, cuts, args.output, args.scale)
            (args.output / "geometry.json").write_text(json.dumps({
                "version": 1, "pdfSha256": digest, "renderer": f"PyMuPDF {pymupdf.VersionBind}",
                "scale": args.scale, "systems": geometry}, indent=2) + "\n")
            print(f"Rendered {len(geometry)} systems to {args.output}")


if __name__ == "__main__":
    main()
