import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, writeFileSync } from "node:fs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "offline-shell",
      closeBundle() {
        const files = [
          ...new Set([
            "/",
            "/index.html",
            "/icon.svg",
            "/manifest.webmanifest",
            ...readdirSync("dist", { recursive: true, withFileTypes: true })
              .filter((f) => f.isFile() && f.name !== "sw.js")
              .map(
                (f) =>
                  "/" + (f.parentPath + "/" + f.name).replace(/^dist\//, ""),
              ),
          ]),
        ];
        const version = "cadence-" + Date.now();
        writeFileSync(
          "dist/sw.js",
          `const CACHE=${JSON.stringify(version)}, FILES=${JSON.stringify(files)};
 self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
 self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cadence-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
 self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.open(CACHE).then(c=>c.match(e.request.mode==='navigate'?'/index.html':e.request,{ignoreVary:true})).then(r=>r||fetch(e.request)));});`,
        );
      },
    },
  ],
});
