import {writeFileSync} from "node:fs";
import data from "../src/core/minute-waltz.json";
import type { Song } from "../src/core/model";
const song = data as Song;
import {measures} from "../src/core/loops";
import {songFingerprint,questTargets,readPracticePlan,type PracticePlan} from "../src/core/quests";
const sections:[number,number,string][]=[[1,8,"Opening rotation"],[9,16,"Upper answer"],[17,20,"Opening cadence"],[21,28,"First repeated theme"],[29,36,"First ending"],[37,44,"Repeat return"],[45,52,"Second ending"],[53,60,"Sostenuto opening"],[61,68,"Singing response"],[69,76,"Grace-note variation"],[77,84,"Sostenuto close"],[85,88,"Held trill bridge"],[89,96,"Rotation returns"],[97,104,"Upper answer returns"],[105,108,"Return cadence"],[109,116,"Closing theme"],[117,124,"Closing response"],[125,132,"Final theme"],[133,140,"Coda"]];
const plan:PracticePlan={version:1,id:"minute-waltz-v1",title:"Minute Waltz · hands and connected passages",song:{title:song.title,fingerprint:await songFingerprint(song)},repetitions:10,counting:"total",quests:[]};
const bars=measures(song);let table="| Bars | Source seconds | RH / LH attacks |\n| --- | --- | --- |\n";
for(const [start,end,section] of sections)for(let from=start;from<=end;){
 const through=start===85?88:from===137?139:Math.min(from===140?140:from+1,end);
 const base={section,instruction:"Play all target attacks; wait mode does not grade articulation, pedal, ornament realization or phrasing.",fromBar:from,throughBar:through,focus:"all" as const,mode:"wait" as const,speed:0.5};
 for(const hand of ["right","left","both"] as const){const q={...base,id:`bars-${from}-${through}-${hand}`,title:`Bars ${from}–${through} · ${hand} hand${hand==="both"?"s":""}`,hand};if(questTargets(song,q).length)plan.quests.push(q);}
 if(from>start)plan.quests.push({...base,id:`review-${start}-${through}`,title:`Bars ${start}–${through} · ${through===end?"Section":"Build-up"} review`,fromBar:start,hand:"both",repetitions:5});
 const a=bars[from-1],b=bars[through-1];const ns=song.notes.filter(n=>n.tick>=a.tick&&n.tick<b.endTick);table+=`| ${from}–${through} | ${a.start.toFixed(3)}–${b.end.toFixed(3)} | ${ns.filter(n=>n.hand==="right").length} / ${ns.filter(n=>n.hand==="left").length} |\n`;from=through+1;
}
const md=`# Minute Waltz practice route\n\nBars use the unfolded five-page score. RH → LH → both hands, skipping silent hands. Ten total complete runs per passage; five per cumulative review. Start at half source tempo (quarter = 140). Two-bar cuts isolate rotations and answers; the held trill bridge stays together, and the final 24-note flourish stays across bars 137–139. Melody-only quests are omitted. Source MIDI does not realize every printed trill/prall; rehearse ornament technique separately.\n\n${table}\n\n\`\`\`cadance-plan\n${JSON.stringify(plan,null,2)}\n\`\`\`\n`;
await readPracticePlan(md,song);writeFileSync("public/plans/minute-waltz.md",md);console.log(`${plan.quests.length} validated quests`);
