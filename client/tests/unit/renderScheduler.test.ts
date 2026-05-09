import { RenderScheduler } from "../../src/providers/renderScheduler";

describe("RenderScheduler", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("invokes the run callback after delayMs elapses", () => {
    const scheduler = new RenderScheduler(400);
    const run = jest.fn();
    scheduler.schedule("k", run);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPending("k")).toBe(false);
  });

  it("rapid schedules collapse into one call (debounce)", () => {
    const scheduler = new RenderScheduler(400);
    const run = jest.fn();
    scheduler.schedule("k", run);
    jest.advanceTimersByTime(100);
    scheduler.schedule("k", run);
    jest.advanceTimersByTime(100);
    scheduler.schedule("k", run);
    jest.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("uses the most recent callback when re-scheduled", () => {
    const scheduler = new RenderScheduler(400);
    const first = jest.fn();
    const second = jest.fn();
    scheduler.schedule("k", first);
    jest.advanceTimersByTime(200);
    scheduler.schedule("k", second);
    jest.advanceTimersByTime(400);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keys are independent — scheduling one doesn't cancel another", () => {
    const scheduler = new RenderScheduler(400);
    const a = jest.fn();
    const b = jest.fn();
    scheduler.schedule("a", a);
    jest.advanceTimersByTime(100);
    scheduler.schedule("b", b);
    jest.advanceTimersByTime(300);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("cancel(key) prevents the pending call from firing", () => {
    const scheduler = new RenderScheduler(400);
    const run = jest.fn();
    scheduler.schedule("k", run);
    scheduler.cancel("k");
    jest.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.hasPending("k")).toBe(false);
  });

  it("cancel(key) on an unknown key is a no-op", () => {
    const scheduler = new RenderScheduler(400);
    expect(() => scheduler.cancel("nope")).not.toThrow();
  });

  it("dispose() cancels all pending callbacks", () => {
    const scheduler = new RenderScheduler(400);
    const a = jest.fn();
    const b = jest.fn();
    scheduler.schedule("a", a);
    scheduler.schedule("b", b);
    scheduler.dispose();
    jest.advanceTimersByTime(1000);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(scheduler.hasPending("a")).toBe(false);
    expect(scheduler.hasPending("b")).toBe(false);
  });
});
