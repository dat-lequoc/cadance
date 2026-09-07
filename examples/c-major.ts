import { fromExercise } from "../src/core/lessons";
import { PracticeEngine } from "../src/core/engine";
import { HardwareInput } from "../src/core/midi";

/** Call from a user gesture in your browser application. Returns cleanup. */
export async function startCMajor(
  selectPort: (ports: { id: string; name: string | null }[]) => Promise<string>,
) {
  const song = fromExercise({
    version: 1,
    title: "My C-major exercise",
    explanation: "Play C through G, then C–E–G together.",
    tempo: 80,
    meter: [4, 4],
    range: [60, 67],
    mode: "wait",
    notes: [60, 62, 64, 65, 67]
      .map((pitch, i) => ({
        pitch,
        beat: i + 2,
        duration: 0.75,
        hand: "right" as const,
      }))
      .concat(
        [60, 64, 67].map((pitch) => ({
          pitch,
          beat: 8,
          duration: 2,
          hand: "right" as const,
        })),
      ),
  });
  const engine = new PracticeEngine(song);
  const input = new HardwareInput(
    () => console.log("Available ports changed"),
    (port) => engine.deviceLost(port),
  );
  await input.connect();
  const id = await selectPort(input.ports());
  input.select(id);
  if (!input.connected) throw Error("Select a connected MIDI input.");
  engine.attach(input);
  const unsubscribe = input.subscribe((event) =>
    console.log("Piano event", event),
  );
  engine.onResult = (result) => console.log("Actual practice result", result);
  engine.subscribe(() => console.log(engine.status, engine.feedback));
  engine.start();
  const tick = setInterval(() => engine.tick(), 10);
  return {
    engine,
    stop() {
      clearInterval(tick);
      engine.stop();
      unsubscribe();
      engine.dispose();
      input.dispose();
    },
  };
}
