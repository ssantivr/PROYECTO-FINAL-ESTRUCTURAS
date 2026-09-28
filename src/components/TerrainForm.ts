import { Component } from '../core/component';
import { formatNumber, h } from '../core/dom';
import { updateProject, type AppStore } from '../state/appState';
import type { Project, Terrain } from '../types/project';
import { ORIENTATION_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../../shared/i18n/es';
import { computeMetrics } from '../services/metrics';
import { numberField, readonlyField, selectField, textField } from './formFields';

type NumericKey = { [K in keyof Terrain]: Terrain[K] extends number ? K : never }[keyof Terrain];

interface Spec {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  integer?: boolean;
}

const DIMENSIONS: readonly Spec[] = [
  { key: 'width', label: 'Ancho', min: 5, max: 200, step: 0.5, unit: 'm' },
  { key: 'length', label: 'Largo', min: 5, max: 200, step: 0.5, unit: 'm' },
];

const TOPOGRAPHY: readonly Spec[] = [
  { key: 'slopePercent', label: 'Pendiente', min: 0, max: 40, step: 0.5, unit: '%' },
  { key: 'elevation', label: 'Elevación', min: 0, max: 5000, step: 1, unit: 'm s. n. m.' },
  { key: 'latitude', label: 'Latitud', min: -90, max: 90, step: 0.0001, unit: '°' },
  { key: 'longitude', label: 'Longitud', min: -180, max: 180, step: 0.0001, unit: '°' },
];

const ZONES: readonly Spec[] = [
  { key: 'gardenArea', label: 'Área de jardín', min: 0, max: 40000, step: 1, unit: 'm²' },
  { key: 'parkingArea', label: 'Área de estacionamiento', min: 0, max: 40000, step: 1, unit: 'm²' },
  { key: 'poolArea', label: 'Área de piscina', min: 0, max: 40000, step: 1, unit: 'm²' },
];

const RULES: readonly Spec[] = [
  { key: 'maxFloors', label: 'Número máximo de pisos', min: 1, max: 30, step: 1, integer: true },
  { key: 'maxCos', label: 'COS máximo', min: 0.1, max: 1, step: 0.05 },
  { key: 'maxCus', label: 'CUS máximo', min: 0.2, max: 10, step: 0.1 },
];

export class TerrainForm extends Component {
  private readonly error = h('p', { class: 'form-error', role: 'alert' });
  private readonly area = h('output', { class: 'computed' });
  private readonly built = h('output', { class: 'computed' });
  private readonly free = h('output', { class: 'computed' });
  private readonly body = h('form', { class: 'panel-body terrain-form', novalidate: true });

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel', 'data-area': 'terrainForm' }));
    this.body.addEventListener('submit', (e) => e.preventDefault());
    this.el.append(h('header', { class: 'panel-head' }, h('h2', {}, 'Terreno'), h('span', { class: 'badge' }, 'Los cambios actualizan 2D, 3D y análisis')), this.body);
    this.render();
    this.track(store.select((s) => s.project.id, () => this.render()));
    this.track(store.select((s) => s.project, (p) => this.updateComputed(p)));
  }

  private get project(): Project {
    return this.store.get().project;
  }

  private check(key: NumericKey, value: number): string | null {
    const p = this.project;
    const next = { ...p.terrain, [key]: value };
    const ground = p.building.floors[0];
    if (ground && key === 'width' && value < p.building.setbackX + ground.footprint.width) {
      return `El ancho mínimo para la construcción actual es ${formatNumber(p.building.setbackX + ground.footprint.width, 1)} m. Regenere la distribución para un lote menor.`;
    }
    if (ground && key === 'length' && value < p.building.setbackY + ground.footprint.depth) {
      return `El largo mínimo para la construcción actual es ${formatNumber(p.building.setbackY + ground.footprint.depth, 1)} m.`;
    }
    const lot = next.width * next.length;
    const footprint = computeMetrics({ ...p, terrain: next }).footprintArea;
    if (footprint + next.gardenArea + next.parkingArea + next.poolArea > lot) {
      return `Construcción, jardín, estacionamiento y piscina suman ${formatNumber(footprint + next.gardenArea + next.parkingArea + next.poolArea)} m², más que el lote (${formatNumber(lot)} m²).`;
    }
    if (key === 'maxFloors' && value < p.building.floors.length) {
      return `El proyecto ya tiene ${p.building.floors.length} pisos; reduzca primero los pisos en Construcción.`;
    }
    return null;
  }

  private field(spec: Spec): HTMLElement {
    return numberField({
      ...spec,
      value: this.project.terrain[spec.key],
      check: (v) => this.check(spec.key, v),
      onError: (m) => (this.error.textContent = m),
      onValid: (value) => {
        this.error.textContent = '';
        updateProject(this.store, (p) => ({ ...p, terrain: { ...p.terrain, [spec.key]: value } }));
      },
    });
  }

  private setTerrain<K extends keyof Terrain>(key: K, value: Terrain[K]): void {
    updateProject(this.store, (p) => ({ ...p, terrain: { ...p.terrain, [key]: value } }));
  }

  private render(): void {
    const { terrain } = this.project;
    const onError = (m: string) => (this.error.textContent = m);
    this.body.replaceChildren(
      h('fieldset', {}, h('legend', {}, 'Dimensiones'),
        ...DIMENSIONS.map((s) => this.field(s)),
        readonlyField('Área total (ancho × largo)', this.area),
        selectField('Forma', terrain.shape, SHAPE_LABEL, (v) => this.setTerrain('shape', v))),
      h('fieldset', {}, h('legend', {}, 'Topografía y ubicación'),
        ...TOPOGRAPHY.map((s) => this.field(s)),
        selectField('Orientación del frente', terrain.orientation, ORIENTATION_LABEL, (v) => this.setTerrain('orientation', v)),
        selectField('Acceso principal', terrain.accessSide, SIDE_LABEL, (v) => this.setTerrain('accessSide', v)),
        textField('Tipo de suelo', terrain.soilType, 120, (v) => this.setTerrain('soilType', v), onError)),
      h('fieldset', {}, h('legend', {}, 'Zonas del lote'),
        readonlyField('Área de construcción (huella)', this.built),
        ...ZONES.map((s) => this.field(s)),
        readonlyField('Zona libre restante', this.free)),
      h('fieldset', {}, h('legend', {}, 'Norma urbana'), ...RULES.map((s) => this.field(s))),
      this.error,
    );
    this.updateComputed(this.project);
  }

  private updateComputed(project: Project): void {
    const m = computeMetrics(project);
    const { terrain } = project;
    this.area.textContent = `${formatNumber(m.lotArea, 1)} m²`;
    this.built.textContent = `${formatNumber(m.footprintArea, 1)} m²`;
    this.free.textContent = `${formatNumber(m.lotArea - m.footprintArea - terrain.gardenArea - terrain.parkingArea - terrain.poolArea, 1)} m²`;
  }
}
