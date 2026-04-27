type Timer = ReturnType<typeof setTimeout>;

interface SchedulerHooks {
  setTimer: (cb: () => void, ms: number) => Timer;
  clearTimer: (t: Timer) => void;
}

const REAL_HOOKS: SchedulerHooks = {
  setTimer: (cb, ms) => setTimeout(cb, ms),
  clearTimer: (t) => clearTimeout(t),
};

/**
 * Per-key debounced scheduler. `schedule(key, fn)` cancels any pending call for
 * `key` and arms a new one `delayMs` later. Pure logic — no vscode dependency,
 * no shared global state. The hooks parameter is a seam for fake timers in tests.
 */
export class RenderScheduler {
  private readonly pending = new Map<string, Timer>();

  constructor(private readonly delayMs: number, private readonly hooks: SchedulerHooks = REAL_HOOKS) {}

  public schedule(key: string, run: () => void): void {
    const existing = this.pending.get(key);
    if (existing) this.hooks.clearTimer(existing);
    const timer = this.hooks.setTimer(() => {
      this.pending.delete(key);
      run();
    }, this.delayMs);
    this.pending.set(key, timer);
  }

  public cancel(key: string): void {
    const existing = this.pending.get(key);
    if (!existing) return;
    this.hooks.clearTimer(existing);
    this.pending.delete(key);
  }

  public dispose(): void {
    for (const timer of this.pending.values()) this.hooks.clearTimer(timer);
    this.pending.clear();
  }

  public hasPending(key: string): boolean {
    return this.pending.has(key);
  }
}
