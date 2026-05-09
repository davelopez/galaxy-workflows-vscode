type Timer = ReturnType<typeof setTimeout>;

/**
 * Per-key debounced scheduler. `schedule(key, fn)` cancels any pending call for
 * `key` and arms a new one `delayMs` later. Pure logic — no vscode dependency,
 * no shared global state. Tests use Jest's fake timers, which intercept the
 * global setTimeout/clearTimeout used here.
 */
export class RenderScheduler {
  private readonly pending = new Map<string, Timer>();

  constructor(private readonly delayMs: number) {}

  public schedule(key: string, run: () => void): void {
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(key);
      run();
    }, this.delayMs);
    this.pending.set(key, timer);
  }

  public cancel(key: string): void {
    const existing = this.pending.get(key);
    if (!existing) return;
    clearTimeout(existing);
    this.pending.delete(key);
  }

  public dispose(): void {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  public hasPending(key: string): boolean {
    return this.pending.has(key);
  }
}
