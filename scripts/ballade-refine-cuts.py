"""Apply reviewed boundary corrections to the spacious Ballade engraving."""
import json
from pathlib import Path

path=Path('scripts/scores/ballade-1.cuts.json')
cuts=json.loads(Path('/tmp/cadance-ballade-review/player-cuts.json').read_text())
cuts['systems'][0]['crop'][1]=20
cuts['systems'][3]['crop'][3]=790
# Two dashed boundaries are rendered as short strokes by modern LilyPond.
cuts['systems'][55]['barEdges'].append(552.3)
cuts['systems'][56]['barEdges'].insert(-1,380.39)
# Preserve the unusually high cadenza slur in full.
cuts['systems'][56]['crop'][1]=190
# High slurs/tempo text on these first-page systems overlap the page-number
# height. Retain the complete page number as well, rather than clipping either.
for index in [33,37,41,48]:
    cuts['systems'][index]['crop'][1]=8
# Final thin and thick strokes belong to one closing barline, not two bars.
cuts['systems'][-1]['barEdges'].pop(-2)
bar=1
for system in cuts['systems']:
    system['fromBar']=bar
    system['throughBar']=bar+len(system['barEdges'])-2
    bar=system['throughBar']+1
assert bar==265
cuts['expectedBars']=264
path.write_text(json.dumps(cuts,indent=2)+'\n')
