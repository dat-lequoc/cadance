"""Propose/review PDF system cuts, then render reproducible score assets.

Run with --help. Coordinates are PDF points, origin top-left; pages are one-based.
Detection is for vector grand-staff scores. Scans require manually authored cuts.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import pymupdf


def propose(pdf, min_staff_width=.65):
    systems = []
    bar = 1
    for page_number, page in enumerate(pdf, 1):
        drawings = page.get_drawings()
        ys = sorted({round(d["rect"].y0, 2) for d in drawings
                     if d["rect"].width > page.rect.width * min_staff_width and d["rect"].height < 1})
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


def validate_cuts(pdf, cuts, require_review=True):
    """Validate the complete document before writing any rendered assets."""
    if cuts.get("version") != 1:
        raise ValueError("Unsupported cuts version")
    if require_review and cuts.get("reviewed") is not True:
        raise ValueError("Visually check every proposed crop and bar boundary, then set reviewed: true")
    if not isinstance(cuts.get("systems"), list) or not cuts["systems"]:
        raise ValueError("Cuts need at least one system")
    integer = lambda value: type(value) is int
    number = lambda value: type(value) in (int, float) and math.isfinite(value)
    if not integer(cuts.get("expectedBars")) or cuts["expectedBars"] < 1:
        raise ValueError("expectedBars must be a positive integer")
    next_bar = 1
    for index, system in enumerate(cuts["systems"], 1):
        if not isinstance(system, dict):
            raise ValueError(f"Invalid system {index}")
        first, last, page_number = (system.get(key) for key in ("fromBar", "throughBar", "page"))
        crop, edges = system.get("crop"), system.get("barEdges")
        if (not all(integer(v) for v in (first, last, page_number))
                or first != next_bar or last < first or not 1 <= page_number <= len(pdf)
                or not isinstance(crop, list) or len(crop) != 4 or not all(number(v) for v in crop)
                or not isinstance(edges, list) or len(edges) != last - first + 2
                or not all(number(v) for v in edges)):
            raise ValueError(f"Invalid crop/bar coverage at system {index}")
        page, rect = pdf[page_number - 1], pymupdf.Rect(crop)
        if page.rotation:
            raise ValueError(f"Page {page_number} is rotated; normalize a separate derivative before measuring cuts")
        if (not page.rect.contains(rect) or rect.is_empty
                or any(a >= b for a, b in zip(edges, edges[1:]))
                or edges[0] < rect.x0 or edges[-1] > rect.x1):
            raise ValueError(f"Invalid crop/bar coverage at system {index}")
        next_bar = last + 1
    if next_bar - 1 != cuts["expectedBars"]:
        raise ValueError("Expected bar count differs from crop coverage")


def render(pdf, cuts, output, scale):
    validate_cuts(pdf, cuts)
    if not math.isfinite(scale) or not 1 <= scale <= 6:
        raise ValueError("scale must be between 1 and 6")
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
        if any(page.annots()):
            # show_pdf_page omits PDF annotation objects. Preserve their visible
            # appearance in the derivative instead of silently losing markup.
            target.insert_image(target.rect, pixmap=pix)
        else:
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
    parser.add_argument("--min-staff-width", type=float, default=.65, help="Minimum staff-line length as a page-width fraction (proposal only)")
    args = parser.parse_args()
    if not 1 <= args.scale <= 6:
        parser.error("scale must be between 1 and 6")
    if not 0 < args.min_staff_width <= 1:
        parser.error("min-staff-width must be between 0 and 1")
    with pymupdf.open(args.pdf) as pdf:
        digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
        if args.action == "propose":
            if args.cuts.exists():
                parser.error("Proposal destination exists; choose a new file to preserve reviewed cuts")
            cuts = propose(pdf, args.min_staff_width)
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
