import { h } from '../core/dom';

export type ToastKind = 'info' | 'success' | 'error';

export class Toaster {
  private readonly region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });

  constructor(parent: HTMLElement) {
    parent.append(this.region);
  }

  show(message: string, kind: ToastKind = 'info', ms = 3200): void {
    const toast = h('div', { class: `toast toast-${kind}` }, message);
    this.region.append(toast);
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, ms);
  }
}
