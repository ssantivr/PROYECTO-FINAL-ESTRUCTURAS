export type Listener<T> = (state: T, previous: T) => void;

/** Minimal observable store (Observer pattern) with immutable updates. */
export class Store<T extends object> {
  private state: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(patch: Partial<T> | ((state: T) => Partial<T>)): void {
    const previous = this.state;
    const delta = typeof patch === 'function' ? patch(previous) : patch;
    this.state = { ...previous, ...delta };
    this.listeners.forEach((listener) => listener(this.state, previous));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe only to changes of a derived slice. */
  select<S>(selector: (state: T) => S, listener: (slice: S) => void): () => void {
    return this.subscribe((state, previous) => {
      const next = selector(state);
      if (next !== selector(previous)) listener(next);
    });
  }
}
