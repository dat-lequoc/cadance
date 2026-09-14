import { Fragment, useEffect, useRef, useState } from "react";
import { measures } from "../core/loops";
import { bothHandsOnly, mergeQuests, newQuestId, planMarkdown, rangeTitle, sameCheckpoint, splitQuest } from "../core/quest-editor";
import { questGoal, readPracticePlan, type PracticePlan, type Quest } from "../core/quests";
import type { PracticeController } from "./usePracticeController";

export default function QuestEditor({ c, onClose }: { c: PracticeController; onClose: () => void }) {
  const original = c.quests.runner.loaded!.plan;
  const [history, setHistory] = useState<PracticePlan[]>([original]);
  const draft = history.at(-1)!;
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [form, setForm] = useState({ from: "1", through: "4", hand: "both" as Quest["hand"], runs: String(original.repetitions), title: "", section: "My passages", split: "2" });
  const barCount = measures(c.song).length;
  const rememberedId = c.quests.runner.activeId ?? c.quests.runner.lastId ?? c.quests.runner.next?.id ?? null;
  const currentQuestId = draft.quests.some((q) => q.id === rememberedId)
    ? rememberedId
    : draft.quests.find((q) => !c.quests.runner.progress.passes[q.id]?.completed)?.id ?? draft.quests[0]?.id ?? null;
  const currentSection = draft.quests.find((q) => q.id === currentQuestId)?.section;
  const currentRow = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    if (!currentQuestId) return;
    const frame = requestAnimationFrame(() => currentRow.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [currentQuestId]);
  const pick = (ids: string[]) => {
    setSelected(ids);
    setError("");
    const quests = draft.quests.filter((q) => ids.includes(q.id));
    if (!quests.length) return;
    const first = quests[0], from = Math.min(...quests.map((q) => q.fromBar)), through = Math.max(...quests.map((q) => q.throughBar));
    setForm({ from: String(from), through: String(through), hand: quests.length === 1 ? first.hand : "both", runs: String(questGoal(draft, first)), title: quests.length === 1 ? first.title : "", section: first.section, split: String(Math.floor((from + through) / 2)) });
  };
  const change = async (transform: () => PracticePlan) => {
    setError("");
    setBusy(true);
    try {
      const next = transform();
      await readPracticePlan(planMarkdown(next), c.song);
      setHistory((items) => [...items, next]);
      setSelected([]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const settings = (): Partial<Quest> => ({
    fromBar: Number(form.from), throughBar: Number(form.through), hand: form.hand,
    repetitions: Number(form.runs), title: form.title.trim() || rangeTitle(Number(form.from), Number(form.through)),
    section: form.section.trim() || "My passages",
  });
  const save = async (restore = false) => {
    setBusy(true); setError("");
    try {
      if (restore) await c.quests.restorePlan();
      else await c.quests.savePlan(draft);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };
  const move = (direction: number) => void change(() => {
    const quests = [...draft.quests], index = quests.findIndex((q) => q.id === selected[0]);
    if (index + direction < 0 || index + direction >= quests.length) return draft;
    [quests[index], quests[index + direction]] = [quests[index + direction], quests[index]];
    return { ...draft, quests };
  });
  return <section className="quest-editor" aria-label="Quest editor" aria-busy={busy}>
    <p>Make this piece fit your practice. Select quests to merge, edit, split or remove—or add any bar range. Nothing changes until you save.</p>
    <fieldset disabled={busy}>
      <div className="quest-editor-actions">
        <button onClick={() => void change(() => bothHandsOnly(draft))}>Both hands only</button>
        <button disabled={!selected.length} onClick={() => pick([])}>Clear selection</button>
        <button disabled={history.length < 2} onClick={() => { setHistory(history.slice(0, -1)); setSelected([]); setError(""); }}>Undo</button>
      </div>
      <p className="quest-editor-help">Both hands only removes hand-by-hand duplicates without dropping passages. Select a section heading to merge its passages and reviews at once.</p>
      {currentSection && <p className="quest-editor-current" role="status"><b>Current section</b> · {currentSection} <span>({currentQuestId === c.quests.runner.activeId ? "currently playing" : "last played"})</span></p>}
      <div className="quest-editor-list" role="group" aria-label="Quests to customize">
        {draft.quests.map((q, index) => <Fragment key={q.id}>
          {(index === 0 || q.section !== draft.quests[index - 1].section) && <button className={"quest-editor-section" + (q.section === currentSection ? " current" : "")} onClick={() => pick([...new Set([...selected, ...draft.quests.filter((item) => item.section === q.section).map((item) => item.id)])])} aria-label={`Select section ${q.section}`}>{q.section} <span>{q.section === currentSection ? "Current · select section" : "Select section"}</span></button>}
          <label ref={q.id === currentQuestId ? currentRow : undefined} className={"quest-editor-row" + (q.id === currentQuestId ? " current" : "")} aria-current={q.id === currentQuestId ? "step" : undefined}>
            <input type="checkbox" checked={selected.includes(q.id)} aria-label={`Select quest ${index + 1}: ${q.title}`} onChange={(e) => pick(e.target.checked ? [...selected, q.id] : selected.filter((id) => id !== q.id))} />
            <span><b>{q.title} {q.id === currentQuestId && <em>Current</em>}</b><small>{rangeTitle(q.fromBar, q.throughBar)} · {q.hand === "both" ? "Both hands" : q.hand === "right" ? "Right hand" : "Left hand"} · {questGoal(draft, q)} runs</small></span>
          </label>
        </Fragment>)}
      </div>
      <p role="status">{selected.length ? `${selected.length} selected · ${rangeTitle(Number(form.from), Number(form.through))}` : "Select quests above, or enter a new passage below."}</p>
      <div className="quest-editor-fields">
        <label>First bar<input aria-label="Quest first bar" type="number" min="1" max={barCount} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
        <label>Last bar<input aria-label="Quest last bar" type="number" min="1" max={barCount} value={form.through} onChange={(e) => setForm({ ...form, through: e.target.value })} /></label>
        <label>Hands<select aria-label="Quest hands" value={form.hand} onChange={(e) => setForm({ ...form, hand: e.target.value as Quest["hand"] })}><option value="both">Both hands</option><option value="right">Right hand</option><option value="left">Left hand</option></select></label>
        <label>Completed runs<input aria-label="Quest repetitions" type="number" min="1" max="100" value={form.runs} onChange={(e) => setForm({ ...form, runs: e.target.value })} /></label>
        <label>Title (optional)<input aria-label="Quest title" maxLength={200} value={form.title} placeholder="Use bar range" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Section<input aria-label="Quest section" maxLength={200} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></label>
      </div>
      <div className="quest-editor-actions">
        <button disabled={selected.length !== 1} onClick={() => void change(() => ({ ...draft, quests: draft.quests.map((q) => {
          if (q.id !== selected[0]) return q;
          const changed = { ...q, ...settings(), instruction: "Play all target notes for the selected hands in this passage." };
          return { ...changed, id: sameCheckpoint(q, draft, changed, draft) ? q.id : newQuestId() };
        }) }))}>Update selected</button>
        <button disabled={selected.length < 2} onClick={() => void change(() => mergeQuests(draft, selected, settings()))}>Merge selected</button>
        <button onClick={() => void change(() => ({ ...draft, quests: [...draft.quests, {
          id: newQuestId(), title: "My passage", section: "My passages", instruction: "Play all target notes for the selected hands in this passage.",
          fromBar: 1, throughBar: 1, hand: "both", focus: "all", mode: "wait", speed: 0.5, ...settings(),
        }] }))}>Add quest</button>
        <button disabled={!selected.length || selected.length === draft.quests.length} onClick={() => void change(() => ({ ...draft, quests: draft.quests.filter((q) => !selected.includes(q.id)) }))}>Remove selected</button>
      </div>
      <div className="quest-editor-actions">
        <label>Split after bar<input aria-label="Split after bar" type="number" min="1" max={barCount - 1} value={form.split} onChange={(e) => setForm({ ...form, split: e.target.value })} /></label>
        <button disabled={selected.length !== 1} onClick={() => void change(() => splitQuest(draft, selected[0], Number(form.split)))}>Split selected</button>
        <button disabled={selected.length !== 1 || draft.quests[0]?.id === selected[0]} onClick={() => move(-1)}>Move up</button>
        <button disabled={selected.length !== 1 || draft.quests.at(-1)?.id === selected[0]} onClick={() => move(1)}>Move down</button>
      </div>
      <p className="quest-editor-help">Saved only for this piece in your browser, and included in backups. Unchanged quests keep progress. Merged, resized or changed-hand quests start fresh; original progress remains saved. Draft ranges must contain target notes.</p>
      {confirmRestore ? <div className="warning"><p>Restore the plan from before your first customization? Your saved run records will be kept.</p><button onClick={() => setConfirmRestore(false)}>Keep my plan</button><button onClick={() => void save(true)}>Confirm restore</button></div> : <button onClick={() => setConfirmRestore(true)}>Restore original plan</button>}
      <footer className="quest-editor-actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={history.length < 2} onClick={() => void save()}>Save my plan</button></footer>
    </fieldset>
    {error && <p role="alert" className="warning">{error}</p>}
    {busy && <p role="status">Validating and saving your plan…</p>}
  </section>;
}
