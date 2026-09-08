import { useEffect } from "react";
import { usePracticeController } from "./usePracticeController";
import { Icon } from "./shared";
import SetupView from "./SetupView";
import PlayerView from "./PlayerView";
import LibraryView from "./LibraryView";
import ReviewView, { HistoryView } from "./ReviewView";
import SettingsView from "./SettingsView";
import UpdateNotice from "./UpdateNotice";
import ConnectionDialog from "./ConnectionDialog";
export default function App() {
  const c = usePracticeController();
  const focused = c.page === "player";
  useEffect(() => {
    document.body.style.overflow = focused ? "hidden" : "";
    if (!focused && document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    return () => {
      document.body.style.overflow = "";
    };
  }, [focused]);
  useEffect(() => {
    if (!c.modal) return;
    const prior = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".modal")!;
    const items = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,a[href]",
        ),
      ].filter((el) => el.getClientRects().length);
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = items(),
        first = all[0],
        last = all.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", key);
    return () => {
      dialog.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [c.modal]);
  if (!c.ready)
    return (
      <div className="startup" role="status">
        Loading your pieces…
      </div>
    );
  return (
    <div
      className={"app" + (focused ? " app-focused" : "")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (c.panel || c.modal) return;
        void c.importSong(e.dataTransfer.files[0]);
      }}
    >
      <div className="app-surface" inert={c.modal || undefined}>
        {!focused && (
          <header className="app-header">
            <button className="brand" onClick={() => c.navigate("library")}>
              <Icon name="piano" size={25} />
              cadance<span>.</span>
            </button>
            <nav aria-label="Main navigation">
              <button
                aria-current={c.page === "library" ? "page" : undefined}
                onClick={() => c.navigate("library")}
              >
                Pieces
              </button>
              <button
                aria-current={c.page === "progress" ? "page" : undefined}
                onClick={() => c.navigate("progress")}
              >
                History
              </button>
              <button
                aria-current={c.page === "settings" ? "page" : undefined}
                onClick={() => c.navigate("settings")}
              >
                Settings
              </button>
            </nav>
            <button
              className="theme-toggle"
              aria-label="Dark mode"
              aria-pressed={c.dashboardDark}
              title="Switch dashboard appearance"
              onClick={() => c.setDashboardDark(!c.dashboardDark)}
            >
              {c.dashboardDark ? "☾ Dark" : "☀ Light"}
            </button>
            <button
              className="device-pill"
              aria-label="Connect your piano"
              onClick={() => c.setModal(true)}
            >
              <i
                className={
                  "connection-dot" + (c.source !== "none" ? " online" : "")
                }
              />
              {c.source === "simulated"
                ? "Simulated input"
                : c.hardware.connected
                  ? "Piano connected"
                  : "Connect your piano"}
            </button>
          </header>
        )}
        {c.error && (
          <div className="error" role="alert">
            {c.error}
            {c.pendingSave && (
              <button onClick={c.retrySave}>Retry saving</button>
            )}
            <button aria-label="Dismiss error" onClick={() => c.setError("")}>
              ×
            </button>
          </div>
        )}
        {focused ? (
          <PlayerView c={c} />
        ) : (
          <main className="content">
            {c.page === "setup" && <SetupView c={c} />}{" "}
            {c.page === "library" && <LibraryView c={c} />}{" "}
            {c.page === "review" && <ReviewView c={c} />}{" "}
            {c.page === "progress" && <HistoryView c={c} />}{" "}
            {c.page === "settings" && <SettingsView c={c} />}
            <footer>
              <span>Your MIDI. Your practice.</span>
              <span>Cadance · saved on this device</span>
            </footer>
          </main>
        )}
      </div>
      <input
        ref={c.fileRef}
        className="hidden-input"
        type="file"
        accept=".mid,.midi,.json"
        onChange={(e) => {
          void c.importSong(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <ConnectionDialog c={c} />
      <UpdateNotice c={c} />
    </div>
  );
}
