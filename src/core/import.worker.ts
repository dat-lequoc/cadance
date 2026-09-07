import { parseMidi } from "./import";
self.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer; title: string }>) => {
  try {
    self.postMessage({ song: parseMidi(e.data.buffer, e.data.title) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Could not parse MIDI.",
    });
  }
};
