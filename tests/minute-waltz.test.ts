import {test,expect} from "vitest";
import {readFileSync} from "node:fs";
import {minuteWaltz as song} from "../src/core/catalogue";
import {parseMidi} from "../src/core/import";
import {measures} from "../src/core/loops";
import {readPracticePlan} from "../src/core/quests";
import {validateScore,type PreparedScore} from "../src/core/score";
import score from "../public/scores/minute-waltz/score.json";
test("Minute Waltz preserves original performance and validates its complete route and score",async()=>{
 const raw=readFileSync("public/pieces/minute-waltz.mid");const original=parseMidi(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),"source");
 const events=(s:typeof song)=>s.notes.map(n=>[n.tick,n.durationTicks,n.pitch,n.velocity].join(":")).sort();
 expect(events(song)).toEqual(events(original));expect(song.notes).toHaveLength(1370);expect(song.notes.filter(n=>n.hand==="left")).toHaveLength(634);expect(measures(song)).toHaveLength(140);
 const plan=await readPracticePlan(readFileSync("public/plans/minute-waltz.md","utf8"),song);expect(plan.plan.quests).toHaveLength(252);expect(plan.plan.quests.every(q=>q.throughBar-q.fromBar<10)).toBe(true);
 expect((await validateScore(score as PreparedScore,song)).bars).toHaveLength(140);
 for(const system of score.systems)expect(readFileSync("public"+system.image).length).toBeGreaterThan(1000);
});
