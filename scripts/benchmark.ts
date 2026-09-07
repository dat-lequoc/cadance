import { performance } from "node:perf_hooks";
import { platform, arch, cpus } from "node:os";
import { readFileSync } from "node:fs";
import { parseMidi } from "../src/core/import";
import { NoteIndex } from "../src/core/render-index";
const bytes = readFileSync("public/fixtures/stress-10000.mid");
const start = performance.now();
const song = parseMidi(
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer,
  "stress",
);
const parsed = performance.now() - start;
const index = new NoteIndex(song.notes);
const t = performance.now();
let max = 0;
for (let i = 0; i < 10000; i++)
  max = Math.max(max, index.visible(i * 0.04, i * 0.04 + 6).length);
console.log(
  JSON.stringify(
    {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0].model,
      node: process.version,
      notes: song.notes.length,
      parseMs: parsed,
      indexQueries: 10000,
      indexQueryTotalMs: performance.now() - t,
      maxVisible: max,
      note: "CPU parsing/culling only; not a GPU or end-to-end frame-rate benchmark.",
    },
    null,
    2,
  ),
);
