export abstract class Component<E extends HTMLElement = HTMLElement> {
  readonly el: E;
  private readonly disposers: Array<() => void> = [];

  protected constructor(el: E) {
    this.el = el;
  }

  protected track(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  mount(parent: HTMLElement): this {
    parent.append(this.el);
    return this;
  }

  destroy(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.el.remove();
  }
}
