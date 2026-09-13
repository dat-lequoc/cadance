import { PracticeEngine, type Result } from "./engine";
import type { Song } from "./model";
import {
  emptyProgress,
  questBounds,
  questConfig,
  unlocked,
  questCount,
  questGoal,
  type LoadedPlan,
  type QuestProgress,
  type creditQuest,
} from "./quests";
type Outcome = ReturnType<typeof creditQuest>;
export class QuestRunner {
  loaded: LoadedPlan | null = null;
  progress: QuestProgress = emptyProgress();
  activeId: string | null = null;
  lastId: string | null = null;
  saving = false;
  message = "";
  error = "";
  speedOverride: number | null = null;
  lastRun: { id: string; count: number; goal: number; complete: boolean } | null = null;
  private manualJob: { loaded: LoadedPlan; id: string; token: number; reset: boolean } | null = null;
  private token = 0;
  private autoContinue = true;
  private pending: {
    loaded: LoadedPlan;
    song: Song;
    id: string;
    result: Result;
    token: number;
  } | null = null;
  constructor(
    public engine: PracticeEngine,
    private persist: (
      loaded: LoadedPlan,
      song: Song,
      id: string,
      result: Result,
    ) => Promise<Outcome>,
    private changed: () => void,
    private persistManual?: (loaded: LoadedPlan, id: string, reset?: boolean) => Promise<QuestProgress>,
    private remember?: (loaded: LoadedPlan, id: string) => Promise<void>,
  ) {}
  get active() {
    return this.loaded?.plan.quests.find((q) => q.id === this.activeId) ?? null;
  }
  get next() {
    return (
      this.loaded?.plan.quests.find(
        (q) => !this.progress.passes[q.id]?.completed,
      ) ?? null
    );
  }
  get lastQuest() {
    return this.loaded?.plan.quests.find((q) => q.id === this.lastId) ?? null;
  }
  get count() {
    return this.loaded && this.active
      ? questCount(this.loaded.plan, this.progress, this.active)
      : 0;
  }
  get completed() {
    return !!this.activeId && !!this.progress.passes[this.activeId]?.completed;
  }
  load(loaded: LoadedPlan | null, progress = emptyProgress(), lastId: string | null = null) {
    this.leave();
    this.loaded = loaded;
    this.progress = progress;
    this.lastId = loaded?.plan.quests.some((q) => q.id === lastId) ? lastId : null;
    this.message = "";
    this.lastRun = null;
    this.changed();
  }
  prepare(id: string) {
    if (this.saving || this.pending || this.manualJob)
      throw Error(
        "Save the current quest result before starting another quest.",
      );
    const plan = this.loaded?.plan,
      index = plan?.quests.findIndex((q) => q.id === id) ?? -1;
    if (!plan || !unlocked(plan, this.progress, index))
      throw Error("Unknown quest.");
    this.leave();
    this.engine.stop();
    const quest = plan.quests[index];
    this.engine.adaptive = false;
    this.engine.configure({ ...questConfig(quest), speed: this.speedOverride ?? quest.speed });
    this.engine.selectPassage(...questBounds(this.engine.song, quest), false);
    this.activeId = id;
    this.lastId = id;
    const loaded = this.loaded;
    if (this.remember && loaded) void this.remember(loaded, id).catch(() => {});
    this.autoContinue = true;
    this.error = "";
    this.message =
      "Play the complete passage. Choose any checkpoint whenever you like.";
    this.changed();
  }
  leave() {
    this.token++;
    this.activeId = null;
    this.autoContinue = false;
    this.changed();
  }
  suspend() {
    this.autoContinue = false;
  }
  resume() {
    this.autoContinue = true;
  }
  handleResult(result: Result) {
    if (!this.loaded || !this.activeId || !result.completed) return false;
    if (this.saving || this.pending || this.manualJob) return true;
    this.pending = {
      loaded: this.loaded,
      song: this.engine.song,
      id: this.activeId,
      result,
      token: this.token,
    };
    void this.savePending();
    return true;
  }
  async retry() {
    if (this.saving) return;
    if (this.manualJob) await this.saveManual();
    else if (this.pending) await this.savePending();
  }
  async markComplete(reset = false) {
    if (!this.loaded || !this.activeId || this.saving || this.pending || this.manualJob || !this.persistManual) return;
    this.engine.pause();
    this.manualJob = { loaded: this.loaded, id: this.activeId, token: this.token, reset };
    await this.saveManual();
  }
  private async saveManual() {
    const job = this.manualJob;
    if (!job || !this.persistManual) return;
    this.saving = true;
    this.error = "";
    this.changed();
    try {
      const progress = await this.persistManual(job.loaded, job.id, job.reset);
      this.manualJob = null;
      if (this.loaded?.signature !== job.loaded.signature) return;
      this.progress = progress;
      if (this.token !== job.token || this.activeId !== job.id) return;
      if (job.reset) {
        this.lastRun = null;
        this.saving = false;
        this.prepare(job.id);
        this.message = "Checkpoint reset. Press Play when ready.";
        return;
      }
      this.lastRun = { id: crypto.randomUUID(), count: this.count, goal: questGoal(job.loaded.plan, job.loaded.plan.quests.find((q) => q.id === job.id)!), complete: true };
      this.message = "Checkpoint marked complete.";
      this.saving = false;
      if (this.next) {
        const id = this.next.id;
        this.prepare(id);
        this.engine.start(0);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.message = "Checkpoint change has not been saved. Retry to continue.";
    } finally {
      this.saving = false;
      this.changed();
    }
  }
  private async savePending() {
    const job = this.pending;
    if (!job) return;
    this.saving = true;
    this.error = "";
    this.message = "Saving your run…";
    this.changed();
    try {
      const outcome = await this.persist(
        job.loaded,
        job.song,
        job.id,
        job.result,
      );
      this.pending = null;
      if (this.loaded?.signature !== job.loaded.signature) return;
      this.progress = outcome.progress;
      this.message = outcome.reason;
      if (outcome.success && this.token === job.token && this.activeId === job.id)
        this.lastRun = { id: job.result.id, count: this.count, goal: questGoal(job.loaded.plan, job.loaded.plan.quests.find((q) => q.id === job.id)!), complete: this.completed };
      if (this.progress.passes[job.id]?.completed)
        this.message = "Quest complete! Choose any checkpoint to keep practicing.";
      if (
        this.token === job.token &&
        this.activeId === job.id &&
        this.autoContinue &&
        this.engine.status === "finished"
      ) {
        if (this.completed && this.next) {
          const nextId = this.next.id;
          this.saving = false;
          this.prepare(nextId);
          this.engine.start(0);
        } else if (!this.completed) {
          this.engine.restart();
          this.engine.start(0);
        }
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.message = "Your run has not been saved. Retry to keep this result.";
    } finally {
      this.saving = false;
      this.changed();
    }
  }
}
