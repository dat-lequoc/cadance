"""Conservative note anchors for reviewed Emmentaler vector piano PDFs.

Match ordered PDF notehead columns to MIDI onset groups inside verified bars.
Require equal column counts and an unambiguous staff-pitch match for every MIDI
pitch. Accidentals may differ by one semitone from the natural staff position;
this is a cross-check, not a complete notation/accidental parser. Ambiguous bars
retain bar-only following. Never distribute times uniformly across engraving.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

import pymupdf
from fontTools.cffLib import CFFFontSet


def anchors(pdf, cuts, score, song, scale):
    heads = []
    for si, system in enumerate(cuts['systems']):
        page = pdf[system['page'] - 1]
        fonts = [f for f in page.get_fonts() if 'Emmentaler-20' in f[3]]
        if len(fonts) != 1:
            raise ValueError('This extractor requires one Emmentaler-20 CFF music font per page')
        cff = CFFFontSet()
        cff.decompile(io.BytesIO(pdf.extract_font(fonts[0][0])[3]), None)
        names = cff[cff.fontNames[0]].charset
        glyphs = []
        for span in page.get_texttrace():
            if span['font'] != 'Emmentaler-20':
                continue
            for _, gid, (x, y), bbox in span['chars']:
                if system['crop'][1] < y < system['crop'][3]:
                    glyphs.append(dict(name=names[gid], x=x, y=y, center=(bbox[0] + bbox[2]) / 2, step=span['size'] / 8))
        clefs = sorted([g for g in glyphs if g['name'] in ('clefs.G', 'clefs.F')], key=lambda g: g['y'])
        if len(clefs) != 2:
            raise ValueError(f'System {si + 1}: expected two initial clefs')
        image = score['systems'][si]
        def nx(x):
            return round((x * scale - math.floor(system['crop'][0] * scale)) / image['width'], 7)
        def ny(y):
            return round((y * scale - math.floor(system['crop'][1] * scale)) / image['height'], 7)
        image['staves'] = [dict(step=round(initial['step'] * scale / image['height'], 7),
            clefs=[dict(x=nx(g['x']), y=ny(g['y']), pitch=67 if 'G' in g['name'] else 53)
                for g in sorted(glyphs, key=lambda g: g['x']) if g['name'].startswith('clefs.') and abs(g['y'] - initial['y']) < 16])
            for initial in clefs]
        for h in glyphs:
            if not h['name'].startswith('noteheads.'):
                continue
            staff = min(range(2), key=lambda i: abs(h['y'] - clefs[i]['y']))
            changes = [g for g in glyphs if g['name'].startswith('clefs.') and g['x'] < h['x'] and abs(g['y'] - clefs[staff]['y']) < 16]
            clef = max(changes, key=lambda g: g['x'])
            steps = (clef['y'] - h['y']) / h['step']
            if abs(steps - round(steps)) > .1:
                continue
            diatonic = (7 * 4 + 4 if 'G' in clef['name'] else 7 * 3 + 3) + round(steps)
            natural = (diatonic // 7 + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][diatonic % 7]
            heads.append(dict(**h, system=si, natural=natural))
    report = []
    for bar in score['bars']:
        bar.pop('anchors', None)
        system = cuts['systems'][bar['system']]
        image = score['systems'][bar['system']]
        i = bar['number'] - system['fromBar']
        selected = sorted([h for h in heads if h['system'] == bar['system'] and system['barEdges'][i] < h['x'] < system['barEdges'][i + 1]], key=lambda h: h['x'])
        columns = []
        for h in selected:
            if not columns or h['x'] - columns[-1][0]['x'] > 1:
                columns.append([])
            columns[-1].append(h)
        notes = [n for n in song['notes'] if bar['tick'] <= n['tick'] < bar['endTick']]
        ticks = sorted({n['tick'] for n in notes})
        reason = None
        aligned = []
        if len(columns) != len(ticks) or not ticks:
            reason = f'{len(columns)} printed columns / {len(ticks)} MIDI onsets'
        else:
            for tick, column in zip(ticks, columns):
                matched = []
                for pitch in sorted({n['pitch'] for n in notes if n['tick'] == tick}):
                    candidates = {(round(h['center'], 2), round(h['y'], 2)) for h in column if abs(pitch - h['natural']) <= 1}
                    if len(candidates) != 1:
                        reason = f'Ambiguous pitch {pitch} at tick {tick}'
                        break
                    x, y = next(iter(candidates))
                    matched.append(dict(pitch=pitch, x=round((x * scale - math.floor(system['crop'][0] * scale)) / image['width'], 7), y=round((y * scale - math.floor(system['crop'][1] * scale)) / image['height'], 7)))
                if reason:
                    break
                if len({(n['x'], n['y']) for n in matched}) != len(matched):
                    reason = f'Two pitches share a candidate at tick {tick}'
                    break
                aligned.append(dict(tick=tick, x=round(sum(n['x'] for n in matched) / len(matched), 7), notes=matched))
        if not reason:
            bar['anchors'] = aligned
        report.append(dict(bar=bar['number'], mode='bar' if reason else 'notes', reason=reason, onsets=len(ticks)))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('cuts', type=Path)
    parser.add_argument('song', type=Path)
    parser.add_argument('score', type=Path)
    args = parser.parse_args()
    cuts = json.loads(args.cuts.read_text())
    score = json.loads(args.score.read_text())
    song = json.loads(args.song.read_text())
    geometry = json.loads((args.score.parent / 'geometry.json').read_text())
    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    if not cuts.get('reviewed') or any(v['pdfSha256'] != digest for v in [cuts, score, geometry]):
        raise ValueError('Reviewed PDF/cut/score identities do not match')
    with pymupdf.open(args.pdf) as pdf:
        report = anchors(pdf, cuts, score, song, geometry['scale'])
    args.score.write_text(json.dumps(score, indent=2) + '\n')
    (args.score.parent / 'note-alignment-report.json').write_text(json.dumps(dict(version=1, pdfSha256=digest, method='ordered-columns-and-staff-pitch', bars=report), indent=2) + '\n')
    print(f"Note anchors: {sum(b['mode'] == 'notes' for b in report)}/{len(report)} bars; others retain verified bar following")


if __name__ == '__main__':
    main()
