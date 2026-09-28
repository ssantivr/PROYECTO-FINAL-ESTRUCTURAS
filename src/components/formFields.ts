import { h } from '../core/dom';

export interface NumberFieldOptions {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  integer?: boolean;
  check?: (value: number) => string | null;
  onValid: (value: number) => void;
  onError: (message: string) => void;
}

export function numberField(o: NumberFieldOptions): HTMLLabelElement {
  const input = h('input', { type: 'number', value: o.value, min: o.min, max: o.max, step: o.step, inputmode: 'decimal' });
  input.addEventListener('change', () => {
    const next = Number(input.value);
    const problem =
      input.value.trim() === '' || !Number.isFinite(next) ? `${o.label}: ingrese un número.`
        : next < o.min || next > o.max ? `${o.label}: ingrese un valor entre ${o.min} y ${o.max}.`
          : o.integer && !Number.isInteger(next) ? `${o.label}: debe ser un número entero.`
            : o.check?.(next) ?? null;
    if (problem) {
      o.onError(problem);
      input.value = String(o.value);
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    o.value = next;
    o.onValid(next);
  });
  return h('label', { class: 'field' }, h('span', {}, o.label),
    o.unit ? h('div', { class: 'input-unit' }, input, h('em', {}, o.unit)) : input);
}

export function textField(label: string, value: string, maxLength: number, onValid: (value: string) => void, onError: (message: string) => void, multiline = false): HTMLLabelElement {
  const input = multiline ? h('textarea', { rows: 3, maxlength: maxLength }) : h('input', { type: 'text', value, maxlength: maxLength });
  if (multiline) input.value = value;
  input.addEventListener('change', () => {
    const trimmed = input.value.trim();
    if (!trimmed && !multiline) {
      onError(`${label}: el campo no puede estar vacío.`);
      input.value = value;
      return;
    }
    value = trimmed;
    onValid(trimmed);
  });
  return h('label', { class: multiline ? 'field span-2' : 'field' }, h('span', {}, label), input);
}

export function selectField<T extends string>(label: string, value: T, options: Record<T, string>, onChange: (value: T) => void): HTMLLabelElement {
  const keys = Object.keys(options) as T[];
  const select = h('select', {}, ...keys.map((k) => h('option', { value: k, selected: k === value }, options[k])));
  select.addEventListener('change', () => {
    const next = keys.find((k) => k === select.value);
    if (next) onChange(next);
  });
  return h('label', { class: 'field' }, h('span', {}, label), select);
}

export function readonlyField(label: string, output: HTMLElement): HTMLDivElement {
  return h('div', { class: 'field field-readonly' }, h('span', {}, label), output);
}
