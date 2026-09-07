import { fromExercise, validateExercise } from "./lessons";
import type { Song } from "./model";
export async function importFile(file: File): Promise<Song> {
  if (file.size > 5 * 1024 * 1024)
    throw Error("Files must be smaller than 5 MB.");
  if (file.name.toLowerCase().endsWith(".json"))
    return fromExercise(validateExercise(JSON.parse(await file.text())));
  if (!/\.midi?$/i.test(file.name))
    throw Error("Choose a .mid, .midi or exercise .json file.");
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./import.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = setTimeout(() => {
      w.terminate();
      reject(Error("Parsing exceeded 5 seconds. Try a smaller file."));
    }, 5000);
    w.onmessage = (e) => {
      clearTimeout(timeout);
      w.terminate();
      e.data.error ? reject(Error(e.data.error)) : resolve(e.data.song);
    };
    w.onerror = () => {
      clearTimeout(timeout);
      w.terminate();
      reject(Error("Malformed MIDI file."));
    };
    w.postMessage({ buffer, title: file.name }, [buffer]);
  });
}
export function download(
  name: string,
  data: BlobPart,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
