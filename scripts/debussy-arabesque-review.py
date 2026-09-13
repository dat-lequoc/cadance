import argparse, hashlib, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("proposal", type=Path)
p.add_argument("pdf", type=Path)
p.add_argument("output", type=Path)
a = p.parse_args()
c = json.loads(a.proposal.read_text())
c["reviewed"] = True
c["pdfSha256"] = hashlib.sha256(a.pdf.read_bytes()).hexdigest()
if c["expectedBars"] != 107:
    raise ValueError("Unexpected Arabesque bar count")
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(c, indent=2) + "\n")
print(f"Reviewed {len(c['systems'])} systems / 107 bars")
