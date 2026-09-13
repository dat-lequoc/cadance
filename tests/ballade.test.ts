import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ballade } from "../src/core/catalogue";
import { parseMidi } from "../src/core/import";
import { measures } from "../src/core/loops";
import { TempoMap } from "../src/core/model";
import { readPracticePlan, questTargets, unlocked, emptyProgress } from "../src/core/quests";
import { preparedScoreFor } from "../src/core/scores";
import { scoreBarAt } from "../src/core/score";

it("preserves every original Ballade MIDI event while correcting source hand ownership", () => {
  const source = parseMidi(ballade.original!, "source");
  const events = (song: typeof ballade) => song.notes.map(n => [n.tick,n.durationTicks,n.pitch,n.velocity,n.track,n.channel]).sort();
  expect(events(ballade)).toEqual(events(source));
  expect(ballade.tempos).toEqual(source.tempos);
  expect(ballade.meters).toEqual(source.meters);
  expect(ballade.notes).toHaveLength(5013);
  expect(ballade.notes.filter(n=>n.hand==="right")).toHaveLength(2865);
  expect(ballade.notes.filter(n=>n.hand==="left")).toHaveLength(2148);
  expect(ballade.notes.find(n=>n.tick===0 && n.pitch===48)?.hand).toBe("right");
  expect(ballade.notes.find(n=>n.tick===374784 && n.pitch===34)?.hand).toBe("left");
  expect(ballade.notes.find(n=>n.tick===536064 && n.pitch===31)?.hand).toBe("left");
  expect(ballade.roleSource).toBe("suggested");
});

it("covers 264 bars with freely selectable hand quests and bounded cumulative reviews", async () => {
  const loaded=await readPracticePlan(readFileSync("public/plans/ballade-1.md","utf8"),ballade);
  expect(loaded.plan.quests).toHaveLength(596);
  const covered=new Set<number>();
  for (const [i,q] of loaded.plan.quests.entries()) {
    expect(questTargets(ballade,q).length).toBeGreaterThan(0);
    expect(unlocked(loaded.plan,emptyProgress(),i)).toBe(true);
    if(q.id.startsWith("review-")) {
      expect(q.repetitions).toBe(5);
      expect(q.throughBar-q.fromBar+1).toBeLessThanOrEqual(10);
    } else if(q.hand==="both") {
      for(let b=q.fromBar;b<=q.throughBar;b++)covered.add(b);
    }
  }
  expect([...covered]).toEqual(measures(ballade).map(b=>b.number));
  const oversized={...loaded.plan, quests:Array.from({length:1001},(_,i)=>({...loaded.plan.quests[0],id:`q-${i}`}))};
  await expect(readPracticePlan("```cadance-plan\n"+JSON.stringify(oversized)+"\n```",ballade)).rejects.toThrow();
});

it("validates all score images, source identity and exact bar boundaries through tempo changes", async () => {
  const score=await preparedScoreFor(ballade);
  expect(score).not.toBeNull();
  expect(score!.bars).toHaveLength(264);
  expect(score!.systems).toHaveLength(60);
  expect(createHash("sha256").update(readFileSync(`public${score!.sourcePdf}`)).digest("hex")).toBe(score!.pdfSha256);
  for (const system of score!.systems) {
    const image=readFileSync(`public${system.image}`);
    expect(image.readUInt32BE(16)).toBe(system.width);
    expect(image.readUInt32BE(20)).toBe(system.height);
  }
  const map=new TempoMap(ballade.ppq,ballade.tempos);
  for(const bar of measures(ballade)) {
    expect(scoreBarAt(score!,map,bar.start).number).toBe(bar.number);
    expect(scoreBarAt(score!,map,bar.end-.0001).number).toBe(bar.number);
  }
  expect(scoreBarAt(score!,map,-3).number).toBe(1);
  expect(scoreBarAt(score!,map,ballade.duration).number).toBe(264);
});
