/** Shared stage tokens. CSS reads these through custom properties installed at startup. */
export const stageColors = {
  stage: "#102238",
  left: "#59b3ff",
  right: "#ffc15a",
  background: "#a8b8c9",
  wrong: "#ff7171",
  sustain: "#b199ff",
  success: "#42e89b",
};
export function installTheme() {
  for (const [key, value] of Object.entries(stageColors))
    document.documentElement.style.setProperty(`--${key}`, value);
  let dark = true;
  try {
    const stored = JSON.parse(
      localStorage.getItem("cadance-practice-preferences-v1") ?? "null",
    );
    if (stored?.version === 1 && typeof stored.dashboardDark === "boolean")
      dark = stored.dashboardDark;
  } catch {
    /* Use the default until saved preferences load. */
  }
  applyDashboardTheme(dark);
}
export function applyDashboardTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#111a23" : "#f7f7f2");
}
