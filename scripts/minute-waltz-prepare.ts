import { readFileSync, writeFileSync } from "node:fs";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
const read = (p: string) => { const b = readFileSync(p); return parseMidi(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),p); };
const song=read("public/pieces/minute-waltz.mid"), hands=read("public/pieces/minute-waltz-hands.midi");
const key=(n:typeof song.notes[number])=>`${n.tick}:${n.pitch}`;
const buckets=new Map<string,typeof hands.notes>();
for(const n of hands.notes){ const k=key(n); buckets.set(k,[...(buckets.get(k)??[]),n]); }
let corrected=0;
for(const [i,n] of song.notes.entries()) { const h=buckets.get(key(n))?.shift(); if(!h) throw Error(`No source match ${key(n)}`); if(n.hand!==h.hand)corrected++; n.hand=h.hand; n.id=`chopin-minute-waltz:${i}`; }
if([...buckets.values()].some(x=>x.length))throw Error("Unmatched rendered notes");
song.id="chopin-minute-waltz"; song.title="Chopin · Minute Waltz (Op. 64 No. 1)";
song.explanation="Mutopia/Peters edition, unfolded repeats. Hands verified against source voices, including cross-staff chords. Melody/harmony labels remain suggestions. Printed ornaments are not fully realized in the source MIDI.";
const {original,...data}=song;
writeFileSync("src/core/minute-waltz.json",JSON.stringify({...data,originalBytes:[...new Uint8Array(original!)]},null,2)+"\n");
console.log({notes:song.notes.length,bars:measures(song).length,corrected,right:song.notes.filter(n=>n.hand==="right").length,left:song.notes.filter(n=>n.hand==="left").length});
