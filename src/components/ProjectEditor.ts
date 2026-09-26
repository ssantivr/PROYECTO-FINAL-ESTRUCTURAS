import { Component } from '../core/component';
import { h } from '../core/dom';
import { updateProject, type AppStore } from '../core/appState';
import type { Orientation, Project, Terrain } from '../types/project';

type NumericTerrainKey = { [K in keyof Terrain]: Terrain[K] extends number ? K : never }[keyof Terrain];

interface NumericField {
  key: NumericTerrainKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const FIELDS: readonly NumericField[] = [
  { key: 'width', label: 'Ancho del lote', min: 15, max: 40, step: 0.5, unit: 'm' },
  { key: 'length', label: 'Largo del lote', min: 15, max: 60, step: 0.5, unit: 'm' },
  { key: 'slopePercent', label: 'Pendiente media', min: 0, max: 25, step: 0.5, unit: '%' },
  { key: 'elevation', label: 'Cota base', min: 0, max: 4500, step: 1, unit: 'm s. n. m.' },
  { key: 'maxCos', label: 'COS máximo', min: 0.1, max: 1, step: 0.05, unit: '' },
  { key: 'maxCus', label: 'CUS máximo', min: 0.2, max: 5, step: 0.1, unit: '' },
];

const ORIENTATIONS: readonly Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class ProjectEditor extends Component {
  private readonly error = h('p', { class: 'form-error', role: 'alert' });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'editor' }));
    const { project } = store.get();
    const form = h('form', { class: 'panel-body form-grid', novalidate: true });

    form.append(
      this.textField('Nombre del proyecto', project.name, (value) => ({ ...this.current(), name: value })),
      this.textField('Estilo arquitectónico', project.style, (value) => ({ ...this.current(), style: value })),
      this.textField('Ciudad', project.city, (value) => ({ ...this.current(), city: value })),
      this.textField('Departamento', project.region, (value) => ({ ...this.current(), region: value })),
      ...FIELDS.map((field) => this.numberField(field, project.terrain[field.key])),
      this.orientationField(project.terrain.orientation),
      this.error,
    );
    form.addEventListener('submit', (e) => e.preventDefault());
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Datos del proyecto'), h('span', { class: 'badge' }, 'Edición en vivo')), form);
  }

  private current(): Project {
    return this.store.get().project;
  }

  private textField(label: string, value: string, apply: (value: string) => Project): HTMLElement {
    const input = h('input', { type: 'text', value, maxlength: 60 });
    input.addEventListener('change', () => {
      const trimmed = input.value.trim();
      if (!trimmed) {
        this.error.textContent = `${label}: el campo no puede estar vacío.`;
        input.value = value;
        return;
      }
      this.error.textContent = '';
      updateProject(this.store, () => apply(trimmed));
    });
    return h('label', { class: 'field' }, h('span', {}, label), input);
  }

  private numberField(field: NumericField, value: number): HTMLElement {
    const input = h('input', { type: 'number', value, min: field.min, max: field.max, step: field.step });
    input.addEventListener('change', () => {
      const next = Number(input.value);
      if (!Number.isFinite(next) || next < field.min || next > field.max) {
        this.error.textContent = `${field.label}: ingrese un valor entre ${field.min} y ${field.max}.`;
        input.value = String(this.current().terrain[field.key]);
        return;
      }
      const ground = this.current().building.floors[0];
      const { setbackX, setbackY } = this.current().building;
      if (ground && field.key === 'width' && next < setbackX + ground.footprint.width + 1) {
        this.error.textContent = `El ancho mínimo para la huella actual es ${setbackX + ground.footprint.width + 1} m.`;
        input.value = String(this.current().terrain.width);
        return;
      }
      if (ground && field.key === 'length' && next < setbackY + ground.footprint.depth + 2) {
        this.error.textContent = `El largo mínimo para la huella actual es ${setbackY + ground.footprint.depth + 2} m.`;
        input.value = String(this.current().terrain.length);
        return;
      }
      this.error.textContent = '';
      updateProject(this.store, (p) => ({ ...p, terrain: { ...p.terrain, [field.key]: next } }));
    });
    return h('label', { class: 'field' }, h('span', {}, field.label), h('div', { class: 'input-unit' }, input, field.unit ? h('em', {}, field.unit) : null));
  }

  private orientationField(value: Orientation): HTMLElement {
    const select = h('select', {}, ...ORIENTATIONS.map((o) => h('option', { value: o, selected: o === value }, o)));
    select.addEventListener('change', () => {
      const orientation = ORIENTATIONS.find((o) => o === select.value);
      if (orientation) updateProject(this.store, (p) => ({ ...p, terrain: { ...p.terrain, orientation } }));
    });
    return h('label', { class: 'field' }, h('span', {}, 'Orientación del frente'), select);
  }
}
