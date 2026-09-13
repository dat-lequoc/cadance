"""Promote a reviewed automatic proposal to the committed cuts manifest."""
import argparse, hashlib, json
from pathlib import Path
parser = argparse.ArgumentParser(); parser.add_argument("proposal", type=Path); parser.add_argument("pdf", type=Path); parser.add_argument("output", type=Path); args = parser.parse_args()
cuts = json.loads(args.proposal.read_text()); cuts["reviewed"] = True; cuts["pdfSha256"] = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
if cuts["expectedBars"] != 72 or len(cuts["systems"]) != 20: raise ValueError("Unexpected Clair de lune proposal")
args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(cuts, indent=2) + "\n"); print("Reviewed 20 systems / 72 bars")
