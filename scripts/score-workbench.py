"""Offline PDF inspection, manual scan markup and visual cuts review.

No OCR, inferred barlines or automatic review approval. Originals are never edited.
Coordinates: PDF points, top-left origin; pages and MIDI bars are one-based.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil

try:
    import pymupdf
except ImportError:
    raise SystemExit("Install preparation tools: python -m pip install -r scripts/score-requirements.txt")

spec = importlib.util.spec_from_file_location("prepare_score", Path(__file__).with_name("prepare-score.py"))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_new(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        stream.write(text)


def load_cuts(path, source):
    cuts = json.loads(path.read_text())
    if cuts.get("pdfSha256") != digest(source):
        raise ValueError("PDF hash differs from cuts; do not reuse coordinates from another edition")
    return cuts


def inspect_pdf(source, pdf):
    return {
        "source": source.name, "pdfSha256": digest(source), "pages": len(pdf),
        "metadata": pdf.metadata,
        "pageInfo": [{
            "page": page.number + 1, "width": page.rect.width, "height": page.rect.height,
            "rotation": page.rotation, "images": len(page.get_images()),
            "vectorPaths": len(page.get_drawings()), "textCharacters": len(page.get_text()),
            "annotationCount": sum(1 for _ in page.annots()),
        } for page in pdf],
        "note": "Image/path counts are diagnostic only. Flattened handwriting is page content, not a PDF annotation object.",
    }


def make_workbench(source, pdf, output, cuts=None, scale=1.5):
    if any(page.rotation for page in pdf):
        raise ValueError("Rotated pages require a separate normalized derivative before marking coordinates")
    # Refuse reuse, so source images and a previous review session stay intact.
    output.mkdir(parents=True, exist_ok=False)
    report = inspect_pdf(source, pdf)
    pages = []
    for page in pdf:
        filename = f"page-{page.number + 1:03}.png"
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        pix.save(str(output / filename))
        pages.append({"image": filename, "width": page.rect.width, "height": page.rect.height})
    (output / "inspection.json").write_text(json.dumps(report, indent=2) + "\n")
    initial = cuts or {"version": 1, "reviewed": False, "pdfSha256": report["pdfSha256"], "expectedBars": 0, "systems": []}
    payload = json.dumps({"pages": pages, "cuts": initial}).replace("<", "\\u003c")
    template = Path(__file__).with_name("score-workbench.html").read_text()
    (output / "index.html").write_text(template.replace("/*WORKBENCH_DATA*/", payload))


def review_pdf(source, pdf, cuts, output, scale=1.5):
    prepare.validate_cuts(pdf, cuts, require_review=False)
    output.mkdir(parents=True, exist_ok=False)
    report = []
    # Reopen the original for each review, never accumulating overlays.
    with pymupdf.open(source) as annotated:
        for index, system in enumerate(cuts["systems"], 1):
            page = annotated[system["page"] - 1]
            rect = pymupdf.Rect(system["crop"])
            page.draw_rect(rect, color=(0, .5, 1), width=.8, overlay=True)
            for offset, x in enumerate(system["barEdges"]):
                page.draw_line((x, rect.y0), (x, rect.y1), color=(1, .2, .1), width=.5)
                if offset < len(system["barEdges"]) - 1:
                    page.insert_text((x + 2, rect.y0 + 10), f"M{system['fromBar'] + offset}", fontsize=8, color=(1, 0, 0))
            # A clean crop and annotated full-page view make clipping review possible.
            name = f"system-{index:03}.png"
            pdf[system["page"] - 1].get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=rect, alpha=False).save(str(output / name))
            report.append({"image": name, "page": system["page"], "fromBar": system["fromBar"], "throughBar": system["throughBar"]})
        for page in annotated:
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False).save(str(output / f"review-page-{page.number + 1:03}.png"))
        annotated.save(output / "review.pdf", garbage=4, deflate=True)
    # Labels are MIDI measure indices, not a claim about printed numbering.
    body = "".join(f'<figure><figcaption>System {i}: page {s["page"]}, MIDI bars {s["fromBar"]}-{s["throughBar"]}</figcaption><img src="{s["image"]}"></figure>' for i, s in enumerate(report, 1))
    (output / "index.html").write_text('<!doctype html><meta charset="utf-8"><title>Score cut review</title><style>body{font:16px system-ui;max-width:1200px;margin:24px auto}img{width:100%}figure{margin:24px 0}</style><h1>Score cut review — not approved automatically</h1><p>Compare clean crops below with review-page PNGs and review.pdf. M labels denote MIDI bars, not verified printed labels.</p>' + body)
    (output / "review.json").write_text(json.dumps({"pdfSha256": digest(source), "reviewed": cuts.get("reviewed", False), "systems": report}, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("doctor", help="Report installed preparation executables; optional tools are not installed automatically")
    for action in ("inspect", "init", "workbench", "review", "check"):
        command = sub.add_parser(action)
        command.add_argument("pdf", type=Path)
        if action in ("review", "check"):
            command.add_argument("cuts", type=Path)
        elif action == "workbench":
            command.add_argument("--cuts", type=Path)
        if action in ("init", "workbench", "review"):
            command.add_argument("--output", type=Path, required=True, help="New path; refuses to overwrite existing work")
        if action == "init":
            command.add_argument("--bars", type=int, required=True, help="Verified target MIDI bar count, not an inferred PDF count")
        if action in ("workbench", "review"):
            command.add_argument("--scale", type=float, default=1.5)
    args = parser.parse_args()
    try:
        if args.action == "doctor":
            print(json.dumps({"PyMuPDF": pymupdf.VersionBind, "tools": {name: shutil.which(name) for name in ("rtk", "node", "pnpm", "pdfinfo", "pdftoppm", "lilypond", "convert-ly")}, "note": "LilyPond is optional for source re-engraving; no OMR engine is required for manual scan markup."}, indent=2))
            return
        if hasattr(args, "scale") and not 0.5 <= args.scale <= 4:
            raise ValueError("scale must be between 0.5 and 4")
        with pymupdf.open(args.pdf) as pdf:
            if pdf.needs_pass:
                raise ValueError("Encrypted PDF: provide an accessible authorized copy")
            if args.action == "inspect":
                print(json.dumps(inspect_pdf(args.pdf, pdf), indent=2))
            elif args.action == "init":
                if args.bars < 1:
                    raise ValueError("bars must be positive")
                write_new(args.output, json.dumps({"version": 1, "reviewed": False, "pdfSha256": digest(args.pdf), "expectedBars": args.bars, "systems": []}, indent=2) + "\n")
            elif args.action == "workbench":
                cuts = load_cuts(args.cuts, args.pdf) if args.cuts else None
                make_workbench(args.pdf, pdf, args.output, cuts, args.scale)
            else:
                cuts = load_cuts(args.cuts, args.pdf)
                prepare.validate_cuts(pdf, cuts, require_review=False)
                if args.action == "review":
                    review_pdf(args.pdf, pdf, cuts, args.output, args.scale)
                else:
                    print(json.dumps({"validGeometry": True, "reviewed": cuts.get("reviewed") is True, "systems": len(cuts["systems"]), "bars": cuts["expectedBars"], "note": "Geometry is structurally valid; visual and musical correspondence still require review."}, indent=2))
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
