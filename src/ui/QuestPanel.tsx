import { Fragment, useEffect, useRef, useState } from "react";
import type { PracticeController } from "./usePracticeController";
import { questCount, questGoal } from "../core/quests";
import { download } from "../core/files";
import Dialog from "./Dialog";
import QuestEditor from "./QuestEditor";
export default function QuestPanel({ c }: { c: PracticeController }) {
  const input = useRef<HTMLInputElement>(null),
    [editing, setEditing] = useState(false),
    { runner, loading, loadError } = c.quests;
  const loaded = runner.loaded,
    plan = loaded?.plan,
    next = runner.next ? (runner.lastQuest ?? runner.next) : null;
  const complete =
    plan?.quests.filter((q) => runner.progress.passes[q.id]?.completed)
      .length ?? 0;
  return (
    <section className="quest-panel" aria-label="Practice quests">
      <div className="quest-heading">
        <div>
          <span className="eyebrow">PRACTICE QUESTS</span>
          <h2>One passage at a time.</h2>
        </div>
        <span className="quest-emblem">♜</span>
      </div>
      {loading ? (
        <p role="status">Loading your practice plan…</p>
      ) : plan ? (
        <>
          <div className="quest-overall">
            <span>
              {complete} / {plan.quests.length} quests completed
            </span>
            <progress
              aria-label="Quest plan progress"
              value={complete}
              max={plan.quests.length}
            />
          </div>
          {next ? (
            <div className="next-quest">
              <small>{next.section}</small>
              <h3>{next.title}</h3>
              <p>{next.instruction}</p>
              <strong>
                {questCount(plan, runner.progress, next)} / {questGoal(plan, next)}{" "}
                completed runs{plan.counting === "consecutive" ? " in a row" : ""}
              </strong>
              <small>
                {Math.round(next.speed * 100)}% speed ·{" "}
                {next.mode === "wait" ? "Wait for notes" : "Play in time"} ·
                incomplete runs{" "}
                {plan.counting === "total"
                  ? "keep your earned runs"
                  : "reset the streak"}
              </small>
              <button
                className="primary wide"
                disabled={runner.saving || !!runner.error}
                onClick={() => c.startQuest(next.id)}
              >
                {complete ? "Continue quest" : "Start first quest"} →
              </button>
            </div>
          ) : (
            <div className="next-quest">
              <h3>Plan complete ✓</h3>
              <p>
                You’ve cleared every quest. Replay any checkpoint below or
                return to free practice.
              </p>
            </div>
          )}
          <details className="quest-map">
            <summary>
              All checkpoints <span>{plan.quests.length} quests</span>
            </summary>
            <div>
              {plan.quests.map((q, index) => {
                const done = runner.progress.passes[q.id]?.completed;
                return (
                  <Fragment key={q.id}>
                  {(index === 0 || q.section !== plan.quests[index - 1].section) && (
                    <h3 className="quest-session-divider">{q.section}</h3>
                  )}
                  <button
                    disabled={runner.saving || !!runner.error}
                    aria-label={`${done ? "Replay" : "Start"} quest ${index + 1}: ${q.title}`}
                    onClick={() => c.startQuest(q.id)}
                  >
                    <span>{done ? "✓" : "→"}</span>
                    <span>
                      <strong>{q.title}</strong>
                      <small>
                        {done
                          ? "Completed"
                          : `${questCount(plan, runner.progress, q)} / ${questGoal(plan, q)} completed runs`}
                      </small>
                    </span>
                  </button>
                  </Fragment>
                );
              })}
            </div>
          </details>
          <p className="quest-rule">
            Jump into any checkpoint at any time. {" "}
            Complete = finish the passage and play every target note. Wrong notes and chord retries do not cancel your repetition. Wait mode does not grade rhythm or how long you hold
            notes.
          </p>
        </>
      ) : (
        <p>
          {loadError ||
            "Import a Markdown practice plan for this MIDI to turn its passages into quests."}
        </p>
      )}
      {runner.error && (
        <div role="alert" className="warning">
          {runner.message}
          <button onClick={() => void runner.retry()}>Retry quest save</button>
        </div>
      )}
      <div className="quest-file-actions">
        <button className="secondary" disabled={!loaded} onClick={() => setEditing(true)}>Customize quests</button>
        <button className="secondary" onClick={() => input.current?.click()}>
          Import plan .md
        </button>
        {loaded && (
          <button
            onClick={() =>
              download(`${loaded.plan.id}.md`, loaded.markdown, "text/markdown")
            }
          >
            Download plan ↗
          </button>
        )}
      </div>
      {editing && <Dialog title="Customize quests" onClose={() => setEditing(false)}><QuestEditor c={c} onClose={() => setEditing(false)} /></Dialog>}
      <input
        ref={input}
        className="hidden-input"
        aria-label="Import practice plan"
        type="file"
        accept=".md"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void c.quests.importPlan(file);
          e.target.value = "";
        }}
      />
    </section>
  );
}
function QuestRunProgress({
  c,
  count,
  goal,
  questId,
}: {
  c: PracticeController;
  count: number;
  goal: number;
  questId: string;
}) {
  const confirmation = useRef<HTMLDialogElement>(null);
  const resumeOnCancel = useRef(false);
  const cancelSkip = () => {
    confirmation.current?.close();
    c.setQuestDialogOpen(false);
    if (resumeOnCancel.current) void c.play();
    resumeOnCancel.current = false;
  };
  const lastRun = c.quests.runner.lastRun;
  const previous = useRef(lastRun?.id);
  const [reward, setReward] = useState<{
    serial: string;
    complete: boolean;
  } | null>(null);
  useEffect(() => {
    if (!lastRun || previous.current === lastRun.id) return;
    previous.current = lastRun.id;
    setReward({ serial: lastRun.id, complete: lastRun.complete });
    const timer = setTimeout(() => setReward(null), 2400);
    return () => clearTimeout(timer);
  }, [lastRun]);
  const active = c.quests.runner.activeId === questId;
  const completed = !!c.quests.runner.progress.passes[questId]?.completed;
  const hits = active ? c.engine.hits.size : 0;
  const targets = active ? c.engine.targets.length : 0;
  return (
    <div
      className={
        "quest-run-progress" +
        (reward ? " rewarded" : "") +
        (count === goal || reward?.complete ? " mastered" : "")
      }
    >
      <div className="quest-run-label">
        <button
          className="quest-counter"
          title={completed ? "Reset this checkpoint" : "Skip and mark this checkpoint complete"}
          aria-haspopup="dialog"
          disabled={!active || c.quests.runner.saving || !!c.quests.runner.error}
          onClick={() => {
            resumeOnCancel.current = c.engine.status === "playing" || c.engine.status === "waiting";
            c.pause();
            c.setQuestDialogOpen(true);
            confirmation.current?.showModal();
          }}
        >
          <strong>{c.quests.runner.progress.passes[questId]?.manual ? "Marked complete ✓" : `${count} / ${goal} completed runs`}</strong>
        </button>
        <span
          className="quest-reward"
          role="status"
          key={reward?.serial ?? "idle"}
        >
          {reward
            ? reward.complete
              ? "★ Checkpoint cleared!"
              : "✓ +1 run completed!"
            : count === goal
              ? "★ Complete"
              : "Earn your next checkpoint"}
        </span>
      </div>
      <div
        className="quest-reps"
        role="progressbar"
        aria-label="Completed runs toward checkpoint"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={count}
      >
        {Array.from({ length: Math.min(goal, 20) }, (_, i) => (
          <i
            key={i}
            className={
              i + 1 <= (count * Math.min(goal, 20)) / goal ? "earned" : ""
            }
          />
        ))}
      </div>
      <dialog
        ref={confirmation}
        className="quest-skip-dialog"
        aria-label={completed ? "Reset checkpoint?" : "Skip checkpoint?"}
        onCancel={(event) => { event.preventDefault(); cancelSkip(); }}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
        onClick={(event) => { if (event.target === event.currentTarget) cancelSkip(); }}
      >
        <div>
          <h3>{completed ? "Reset checkpoint?" : "Skip checkpoint?"}</h3>
          <p>{completed ? "Reset this quest to zero runs and mark it incomplete? Later quest results and session history stay saved." : "Mark this checkpoint complete and move to the next one?"}</p>
          <footer>
            <button onClick={cancelSkip}>Keep practicing</button>
            <button className="primary" onClick={() => {
              resumeOnCancel.current = false;
              confirmation.current?.close();
              c.setQuestDialogOpen(false);
              setReward(null);
              void c.quests.runner.markComplete(completed);
            }}>{completed ? "Reset quest" : "Mark complete & next →"}</button>
          </footer>
        </div>
      </dialog>
      {active && (
        <div
          className="quest-attempt"
          role="progressbar"
          aria-label="Notes played in this run"
          aria-valuemin={0}
          aria-valuemax={targets || 1}
          aria-valuenow={hits}
          title={`${hits} of ${targets} notes in this run`}
        >
          <i
            style={{
              width: `${targets ? Math.min(100, (hits / targets) * 100) : 0}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function QuestJourney({ c }: { c: PracticeController }) {
  const { runner } = c.quests;
  const plan = runner.loaded!.plan;
  const sections = [...new Set(plan.quests.map((q) => q.section))];
  const done = plan.quests.filter((q) => runner.progress.passes[q.id]?.completed).length;
  const earned = (q: typeof plan.quests[number]) => runner.progress.passes[q.id]?.completed
    ? 1 : questCount(plan, runner.progress, q) / questGoal(plan, q);
  const percent = Math.floor(100 * plan.quests.reduce((sum, q) => sum + earned(q), 0) / plan.quests.length);
  const current = (runner.active ?? runner.next)?.section;
  return (
    <div className="quest-journey" aria-label="Whole piece quest progress">
      <div className="quest-journey-label">
        <span><b>{percent}%</b></span>
        <span className="quest-section-number">Section {Math.max(1, sections.indexOf(current ?? sections.at(-1)!) + 1)} / {sections.length}</span>
      </div>
      <div className="quest-journey-track" role="progressbar" aria-label="Overall quest journey" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${done} of ${plan.quests.length} checkpoints cleared; ${percent}% of repetitions completed`}>
        {sections.map((section, i) => {
          const quests = plan.quests.filter((q) => q.section === section);
          const cleared = quests.filter((q) => runner.progress.passes[q.id]?.completed).length;
          const fill = quests.reduce((sum, q) => sum + earned(q), 0) / quests.length;
          return <span key={section} className={(cleared === quests.length ? "cleared " : "") + (section === current ? "current" : "")} style={{ flex: quests.length }} title={`Section ${i + 1}: ${section} · ${cleared} / ${quests.length} checkpoints cleared`}><i style={{ width: `${fill * 100}%` }} /></span>;
        })}
      </div>
    </div>
  );
}

export function QuestStatus({ c }: { c: PracticeController }) {
  const runner = c.quests.runner,
    plan = runner.loaded?.plan;
  const quest = runner.active ?? runner.next;
  const [announcedQuest, setAnnouncedQuest] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const priorQuest = useRef<string | null>(null);
  useEffect(() => {
    if (!runner.activeId || runner.completed) {
      setAnnouncedQuest(null);
      priorQuest.current = runner.activeId;
      return;
    }
    setContinuing(priorQuest.current === runner.activeId);
    priorQuest.current = runner.activeId;
    setAnnouncedQuest(runner.activeId);
    const timer = setTimeout(() => setAnnouncedQuest(null), 4000);
    return () => clearTimeout(timer);
  }, [runner.activeId, runner.lastRun?.id]);
  const entering = !!runner.activeId && announcedQuest === runner.activeId;
  if (!plan) return null;
  const goal = quest ? questGoal(plan, quest) : plan.repetitions;
  const count = quest
    ? runner.progress.passes[quest.id]?.completed ? goal : questCount(plan, runner.progress, quest)
    : goal;
  return (
    <div
      className="quest-dock quest-header"
      aria-label="Quest status"
      inert={!!c.panel || undefined}
    >
      <div className={"quest-route-control" + (entering ? " quest-entering" : "")}>
      <QuestJourney c={c} />
      <select
        aria-label="Choose checkpoint"
        value={runner.activeId ?? ""}
        disabled={runner.saving || !!runner.error}
        onChange={(e) => {
          if (e.target.value) c.startQuest(e.target.value);
          else {
            runner.leave();
            c.pause();
          }
        }}
      >
        <option value="">
          {quest ? `Next: ${quest.title}` : "Plan complete"} · Free practice
        </option>
        {[...new Set(plan.quests.map((q) => q.section))].map((section) => (
          <optgroup key={section} label={section}>
          {plan.quests.map((q, i) => q.section === section && (
          <option
            key={q.id}
            value={q.id}
          >
            {runner.progress.passes[q.id]?.completed ? "✓ " : ""}
            {i + 1}. {q.title}
          </option>
          ))}
          </optgroup>
        ))}
      </select>
      <div className="quest-transition" role="status" aria-live="polite" aria-atomic="true">
        {entering && runner.active && <div key={`${runner.activeId}:${runner.lastRun?.id ?? "start"}`} className="quest-transition-cue">
          <b>{continuing ? "↻ Continue" : "→ New quest"}</b>
          <span>{continuing ? `Run ${Math.min(count + 1, goal)} of ${goal} · ` : ""}{runner.active.fromBar === runner.active.throughBar ? `Bar ${runner.active.fromBar}` : `Bars ${runner.active.fromBar}–${runner.active.throughBar}`} · {runner.active.hand === "both" ? "Both hands" : runner.active.hand === "right" ? "Right hand" : "Left hand"}{runner.active.id.startsWith("review-") ? " · Review" : ""}</span>
        </div>}
      </div>
      </div>
      <span>{quest?.title ?? "Plan complete"}</span>
      <QuestRunProgress
        key={runner.loaded!.signature}
        c={c}
        count={count}
        goal={goal}
        questId={quest?.id ?? "complete"}
      />
      <progress
        aria-label="Current quest progress"
        value={count}
        max={goal}
      />
      <small role="status">
        {runner.active
          ? runner.message
          : "Explore freely. Start a checkpoint to earn runs."}
      </small>
      {runner.error ? (
        <button onClick={() => void runner.retry()}>Retry quest save</button>
      ) : runner.completed && c.engine.status === "finished" ? (
        <>
          <h2>Quest complete</h2>
          {runner.next && (
            <button onClick={() => c.startQuest(runner.next!.id)}>
              Next quest →
            </button>
          )}
        </>
      ) : (
        !runner.active &&
        quest && (
          <button
            disabled={runner.saving}
            onClick={() => c.startQuest(quest.id)}
          >
            Start checkpoint →
          </button>
        )
      )}
    </div>
  );
}
