"""Run: python -m unittest discover -s scripts -p 'test_score_tools.py'."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import pymupdf

spec = importlib.util.spec_from_file_location("workbench", Path(__file__).with_name("score-workbench.py"))
wb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wb)


class ScoreToolsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.pdf"
        with pymupdf.open() as doc:
            page = doc.new_page(width=300, height=400)
            page.insert_text((20, 25), "Original study score")
            for y in [80, 86, 92, 98, 104, 150, 156, 162, 168, 174]:
                page.draw_line((25, y), (275, y))
            page.insert_text((130, 65), "Fingering 1-3-5", color=(0, 0, 1))
            doc.save(self.source)
        self.pdf = pymupdf.open(self.source)
        self.cuts = {"version": 1, "reviewed": False, "pdfSha256": wb.digest(self.source), "expectedBars": 2,
                     "systems": [{"page": 1, "fromBar": 1, "throughBar": 2, "crop": [10, 40, 290, 200], "barEdges": [25, 150, 275]}]}

    def tearDown(self):
        self.pdf.close()
        self.temp.cleanup()

    def test_inspection_and_workbench_preserve_source(self):
        before = self.source.read_bytes()
        report = wb.inspect_pdf(self.source, self.pdf)
        self.assertEqual(report["pages"], 1)
        self.assertEqual(report["pageInfo"][0]["width"], 300)
        self.assertGreater(report["pageInfo"][0]["vectorPaths"], 0)
        out = self.root / "workbench"
        wb.make_workbench(self.source, self.pdf, out, self.cuts)
        self.assertTrue((out / "page-001.png").exists())
        self.assertNotIn("/*WORKBENCH_DATA*/", (out / "index.html").read_text())
        self.assertEqual(before, self.source.read_bytes())
        with self.assertRaises(FileExistsError):
            wb.make_workbench(self.source, self.pdf, out)

    def test_review_preserves_original_and_does_not_approve(self):
        before = self.source.read_bytes()
        out = self.root / "review"
        wb.review_pdf(self.source, self.pdf, self.cuts, out)
        self.assertEqual(before, self.source.read_bytes())
        self.assertFalse(self.cuts["reviewed"])
        self.assertTrue((out / "system-001.png").exists())
        with pymupdf.open(out / "review.pdf") as review:
            self.assertIn("Fingering 1-3-5", review[0].get_text())
            self.assertIn("M1", review[0].get_text())

    def test_bad_geometry_is_rejected_before_any_render(self):
        variants = []
        for key, value in [("page", 0), ("page", 2), ("fromBar", 2), ("crop", [0, 0, 500, 100]),
                           ("barEdges", [25, 25, 275]), ("barEdges", [25, float("nan"), 275])]:
            cuts = copy.deepcopy(self.cuts)
            cuts["systems"][0][key] = value
            variants.append(cuts)
        for cuts in variants:
            cuts["reviewed"] = True
            with self.assertRaises(ValueError):
                wb.prepare.render(self.pdf, cuts, self.root / "invalid", 2)
            self.assertFalse((self.root / "invalid").exists())
        with self.assertRaises(ValueError):
            wb.prepare.render(self.pdf, self.cuts, self.root / "unreviewed", 2)

    def test_hash_and_coverage_guards(self):
        path = self.root / "wrong.json"
        cuts = copy.deepcopy(self.cuts)
        cuts["pdfSha256"] = "0" * 64
        path.write_text(json.dumps(cuts))
        with self.assertRaises(ValueError):
            wb.load_cuts(path, self.source)
        cuts["expectedBars"] = 3
        with self.assertRaises(ValueError):
            wb.prepare.validate_cuts(self.pdf, cuts, require_review=False)

    def test_reviewed_render_has_pixel_aligned_geometry(self):
        self.cuts["reviewed"] = True
        geometry = wb.prepare.render(self.pdf, self.cuts, self.root / "assets", 2)
        self.assertEqual(geometry[0]["width"], 560)
        self.assertAlmostEqual(geometry[0]["barEdges"][0], 15 / 280)
        self.assertTrue((self.root / "assets" / "systems.pdf").exists())

    def test_pdf_annotation_appearance_survives_crop_export(self):
        annot = self.pdf[0].add_freetext_annot(pymupdf.Rect(40, 45, 100, 65), "Keep me", fontsize=10)
        annot.update()
        self.cuts["reviewed"] = True
        wb.prepare.render(self.pdf, self.cuts, self.root / "annotated", 2)
        with pymupdf.open(self.root / "annotated" / "systems.pdf") as rendered:
            self.assertTrue(rendered[0].get_images(), "Annotation-bearing pages must retain their rendered appearance")


if __name__ == "__main__":
    unittest.main()
