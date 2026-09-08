import { useEffect, useRef, useState } from "react";
import type { PracticeController } from "./usePracticeController";
export default function UpdateNotice({ c }: { c: PracticeController }) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const activating = useRef(false);
  const reload = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let alive = true;
    let loadedController = navigator.serviceWorker.controller;
    const cleanups: (() => void)[] = [];
    const changed = () => {
      const controller = navigator.serviceWorker.controller;
      if (reload.current) location.reload();
      else if (loadedController && controller !== loadedController)
        setWaiting(controller);
      // The first offline installation is not a newer app build.
      else if (!loadedController) {
        loadedController = controller;
        setWaiting(null);
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (!alive) return;
        registrationRef.current = registration;
        const check = () => {
          if (alive && loadedController && registration.waiting)
            setWaiting(registration.waiting);
        };
        const found = () => {
          const worker = registration.installing;
          if (worker) {
            worker.addEventListener("statechange", check);
            cleanups.push(() =>
              worker.removeEventListener("statechange", check),
            );
          }
        };
        check();
        found();
        registration.addEventListener("updatefound", found);
        cleanups.push(() =>
          registration.removeEventListener("updatefound", found),
        );
        void registration.update().catch(() => {});
        const checkOnReturn = () => {
          if (!document.hidden) void registration.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", checkOnReturn);
        window.addEventListener("focus", checkOnReturn);
        cleanups.push(() => {
          document.removeEventListener("visibilitychange", checkOnReturn);
          window.removeEventListener("focus", checkOnReturn);
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      cleanups.forEach((fn) => fn());
    };
  }, []);
  useEffect(() => {
    if (!requested || !waiting || c.savesPending || activating.current) return;
    activating.current = true;
    void c
      .flushPreferences()
      .then(async () => {
        const registration = registrationRef.current;
        // The banner may refer to a build superseded while this tab was open.
        // Resolve the newest worker only after durable saves have completed.
        if (registration) await registration.update().catch(() => {});
        const installing = registration?.installing;
        if (installing)
          await new Promise<void>((resolve, reject) => {
            const finish = () => {
              if (
                ["installed", "activated", "redundant"].includes(
                  installing.state,
                )
              ) {
                clearTimeout(timeout);
                installing.removeEventListener("statechange", finish);
                if (installing.state === "redundant")
                  reject(Error("The update download failed. Please retry."));
                else resolve();
              }
            };
            const timeout = setTimeout(() => {
              installing.removeEventListener("statechange", finish);
              reject(
                Error(
                  "The update is taking longer than expected. Please retry.",
                ),
              );
            }, 20000);
            installing.addEventListener("statechange", finish);
            finish();
          });
        const target = registration?.waiting ?? registration?.active ?? waiting;
        if (target.state === "redundant")
          throw Error("A newer update replaced this one. Please retry.");
        reload.current = true;
        if (target.state === "activated") {
          location.reload();
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            if (target.state === "activated") {
              clearTimeout(timeout);
              target.removeEventListener("statechange", finish);
              resolve();
              location.reload();
            } else if (target.state === "redundant") {
              clearTimeout(timeout);
              target.removeEventListener("statechange", finish);
              reject(Error("The update was replaced. Please retry."));
            }
          };
          const timeout = setTimeout(() => {
            target.removeEventListener("statechange", finish);
            reject(Error("The update could not activate. Please retry."));
          }, 10000);
          target.addEventListener("statechange", finish);
          target.postMessage({ type: "ACTIVATE_UPDATE" });
          finish();
        });
      })
      .catch((error) => {
        activating.current = false;
        reload.current = false;
        setRequested(false);
        setError(error instanceof Error ? error.message : String(error));
      });
  }, [requested, waiting, c.savesPending]);
  if (!waiting) return null;
  return (
    <aside className="update-notice" aria-label="App update">
      <strong>Update available</strong>
      <span>
        {error ||
          (requested
            ? c.savesPending
              ? "Finish saving your results to update."
              : "Updating…"
            : "Your practice stays here until you choose to reload.")}
      </span>
      <button
        disabled={requested}
        onClick={() => {
          c.stopForUpdate();
          setError("");
          setRequested(true);
        }}
      >
        Update and reload
      </button>
    </aside>
  );
}
