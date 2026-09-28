import { Component } from '../core/component';
import { h, icon, type IconName } from '../core/dom';
import type { AppStore } from '../state/appState';
import { buildScene, type Face, type LayerId, type Scene } from '../render/sceneBuilder';
import { centroid, createProjector, dot, normalize, sub, vec, type OrbitCamera, type Vec3 } from '../render/math3d';
import { dayOfYearFromMonth, MONTHS, sunPosition } from '../services/terrainAnalysis';

type Preset = 'iso' | 'front' | 'side' | 'top' | 'interior';

const PRESETS: Record<Preset, { label: string; yaw: number; pitch: number }> = {
  iso: { label: 'Isométrica', yaw: -2.45, pitch: 0.55 },
  front: { label: 'Frontal', yaw: Math.PI, pitch: 0.08 },
  side: { label: 'Lateral', yaw: -Math.PI / 2, pitch: 0.08 },
  top: { label: 'Superior', yaw: Math.PI, pitch: 1.5 },
  interior: { label: 'Interior', yaw: 0, pitch: 0.02 },
};

type LayerToggle = LayerId | 'construction';

const LAYERS: ReadonlyArray<[LayerToggle, string]> = [
  ['terrain', 'Terreno'],
  ['construction', 'Construcción'],
  ['walls', 'Paredes'],
  ['roof', 'Techo'],
  ['doors', 'Puertas'],
  ['windows', 'Ventanas'],
  ['furniture', 'Mobiliario'],
  ['vegetation', 'Vegetación'],
];

const BUILDING_LAYERS: ReadonlySet<LayerId> = new Set(['walls', 'roof', 'doors', 'windows', 'furniture']);

export class Viewer3D extends Component {
  private readonly canvas = h('canvas', { class: 'viewer-canvas', 'aria-label': 'Visualización 3D del proyecto' });
  private readonly ctx: CanvasRenderingContext2D;
  private readonly status = h('span', { class: 'viewer-status' });
  private camera: OrbitCamera = { target: vec(0, 0, 0), yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, distance: 40, fov: 0.9 };
  private preset: Preset = 'iso';
  private scene: Scene;
  private layers = new Set<LayerToggle>(LAYERS.map(([id]) => id));
  private wireframe = false;
  private frame = 0;
  private readonly presetButtons = new Map<Preset, HTMLButtonElement>();

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel viewer', 'data-area': 'viewer' }));
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.scene = buildScene(store.get().project);
    this.resetCamera();

    const presets = h('div', { class: 'segmented' });
    for (const p of Object.keys(PRESETS) as Preset[]) {
      const btn = h('button', { class: 'seg', type: 'button', onclick: () => this.applyPreset(p) }, PRESETS[p].label);
      this.presetButtons.set(p, btn);
      presets.append(btn);
    }

    this.el.append(
      h('header', { class: 'panel-head' }, h('h2', {}, 'Visualización principal'), h('span', { class: 'badge' }, 'Render 3D'), presets),
      h('div', { class: 'viewer-stage' },
        this.canvas,
        h('div', { class: 'viewer-toolbar' },
          this.tool('zoomIn', 'Acercar', () => this.zoom(0.85)),
          this.tool('zoomOut', 'Alejar', () => this.zoom(1.18)),
          this.tool('rotate', 'Restablecer vista', () => this.resetCamera()),
          this.tool('expand', 'Pantalla completa', () => this.fullscreen()),
          this.toggle('grid', 'Modo alámbrico', false, (on) => {
            this.wireframe = on;
            this.requestDraw();
          }),
        ),
        h('div', { class: 'viewer-hint' }, 'Arrastrar: rotar · Shift o botón derecho: desplazar · Rueda: zoom'),
        this.status,
      ),
      h('div', { class: 'layer-bar', role: 'group', 'aria-label': 'Capas' }, ...LAYERS.map(([id, label]) => this.layerToggle(id, label))),
      this.sunControls(),
    );
    this.highlightPreset();

    this.bindPointer();
    const resize = new ResizeObserver(() => this.requestDraw());
    resize.observe(this.canvas);
    this.track(() => resize.disconnect());
    this.track(store.select((s) => s.project, (project) => {
      this.scene = buildScene(project);
      this.requestDraw();
    }));
    this.track(store.select((s) => s.project.id, () => this.resetCamera()));
    this.track(store.subscribe((s, prev) => {
      if (s.sunMonth !== prev.sunMonth || s.sunHour !== prev.sunHour) this.requestDraw();
    }));
  }

  private tool(name: IconName, label: string, action: () => void): HTMLButtonElement {
    return h('button', { class: 'icon-btn', type: 'button', title: label, 'aria-label': label, onclick: action }, icon(name));
  }

  private toggle(name: IconName, label: string, initial: boolean, onChange: (on: boolean) => void): HTMLButtonElement {
    const btn = this.tool(name, label, () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      onChange(on);
    });
    btn.setAttribute('aria-pressed', String(initial));
    return btn;
  }

  private layerToggle(id: LayerToggle, label: string): HTMLLabelElement {
    const input = h('input', { type: 'checkbox', checked: true });
    input.addEventListener('change', () => {
      if (input.checked) this.layers.add(id);
      else this.layers.delete(id);
      this.requestDraw();
    });
    return h('label', { class: 'layer-toggle' }, input, h('span', {}, label));
  }

  private isVisible(face: Face): boolean {
    const layer = face.layer === 'site' ? 'terrain' : face.layer;
    if (!this.layers.has(layer)) return false;
    return !BUILDING_LAYERS.has(face.layer) || this.layers.has('construction');
  }

  private sunControls(): HTMLElement {
    const { sunMonth, sunHour } = this.store.get();
    const monthLabel = h('output', {}, MONTHS[sunMonth] ?? '');
    const hourLabel = h('output', {}, `${sunHour}:00`);
    const month = h('input', { type: 'range', min: 0, max: 11, value: sunMonth, 'aria-label': 'Mes' });
    const hour = h('input', { type: 'range', min: 6, max: 18, step: 0.5, value: sunHour, 'aria-label': 'Hora solar' });
    month.addEventListener('input', () => {
      this.store.set({ sunMonth: Number(month.value) });
      monthLabel.textContent = MONTHS[Number(month.value)] ?? '';
    });
    hour.addEventListener('input', () => {
      const value = Number(hour.value);
      this.store.set({ sunHour: value });
      hourLabel.textContent = `${Math.floor(value)}:${value % 1 ? '30' : '00'}`;
    });
    return h('footer', { class: 'viewer-sun' },
      icon('sun', 16),
      h('label', {}, 'Mes', month, monthLabel),
      h('label', {}, 'Hora', hour, hourLabel),
    );
  }

  private fullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.el.requestFullscreen().catch(() => undefined);
  }

  private highlightPreset(): void {
    this.presetButtons.forEach((btn, key) => btn.setAttribute('aria-pressed', String(key === this.preset)));
  }

  private resetCamera(): void {
    this.preset = 'iso';
    this.camera = { ...this.camera, yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, target: this.scene.center, distance: this.scene.radius * 2.6 };
    this.highlightPreset();
    this.requestDraw();
  }

  private applyPreset(preset: Preset): void {
    this.preset = preset;
    const { yaw, pitch } = PRESETS[preset];
    this.camera = preset === 'interior'
      ? { ...this.camera, yaw, pitch, target: this.scene.interior, distance: 0.3 }
      : { ...this.camera, yaw, pitch, target: this.scene.center, distance: Math.max(this.camera.distance, this.scene.radius * 1.6) };
    this.highlightPreset();
    this.requestDraw();
  }

  private zoom(factor: number): void {
    const min = this.preset === 'interior' ? 0.2 : 6;
    const distance = Math.min(this.scene.radius * 8, Math.max(min, this.camera.distance * factor));
    this.camera = { ...this.camera, distance };
    this.requestDraw();
  }

  private bindPointer(): void {
    let last: { x: number; y: number; pan: boolean } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 || e.button === 2 };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (last.pan) this.pan(dx, dy);
      else {
        const minPitch = this.preset === 'interior' ? -0.6 : 0.02;
        const pitch = Math.min(1.55, Math.max(minPitch, this.camera.pitch + dy * 0.006));
        this.camera = { ...this.camera, yaw: this.camera.yaw - dx * 0.008, pitch };
      }
      last = { ...last, x: e.clientX, y: e.clientY };
      this.requestDraw();
    });
    const end = () => (last = null);
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
  }

  private pan(dx: number, dy: number): void {
    const { yaw, distance, target } = this.camera;
    const k = Math.max(distance, 4) * 0.0016;
    const right = vec(Math.cos(yaw), 0, -Math.sin(yaw));
    this.camera = {
      ...this.camera,
      target: vec(target.x - right.x * dx * k, target.y + dy * k, target.z - right.z * dx * k),
    };
  }

  private requestDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private sunDirection(): { dir: Vec3; altitude: number } {
    const { project, sunMonth, sunHour } = this.store.get();
    const sun = sunPosition(project.terrain.latitude, dayOfYearFromMonth(sunMonth), sunHour);
    const alt = (Math.max(sun.altitude, 2) * Math.PI) / 180;
    const az = (sun.azimuth * Math.PI) / 180;
    return { dir: normalize(vec(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt))), altitude: sun.altitude };
  }

  private draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: hgt } = this.canvas;
    if (!w || !hgt) return;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, hgt);
    sky.addColorStop(0, '#0d2233');
    sky.addColorStop(1, '#07111a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hgt);

    const projector = createProjector(this.camera, w, hgt);
    const { dir: sun, altitude } = this.sunDirection();
    const interior = this.preset === 'interior';
    const cull = !this.wireframe && !interior;
    const visible: Array<{ face: Face; depth: number; pts: Array<{ x: number; y: number }> }> = [];

    for (const face of this.scene.faces) {
      if (!this.isVisible(face)) continue;
      const c = centroid(face.points);
      if (interior && (face.layer === 'roof' || c.y > this.scene.interiorTop || (face.layer !== 'terrain' && Math.abs(face.normal.y) > 0.9))) continue;
      const normal = dot(face.normal, sub(c, face.center)) < 0 ? vec(-face.normal.x, -face.normal.y, -face.normal.z) : face.normal;
      if (cull && dot(normal, sub(projector.eye, c)) <= 0) continue;
      const pts = projector.projectPolygon(face.points);
      if (!pts) continue;
      const depth = Math.hypot(...Object.values(sub(c, projector.eye))) - (face.overlay ? 0.6 : 0);
      visible.push({ face: { ...face, normal }, depth, pts });
    }

    const layerOrder = (f: Face) => (f.layer === 'terrain' ? 0 : f.layer === 'site' ? 1 : 2);
    visible.sort((a, b) => layerOrder(a.face) - layerOrder(b.face) || b.depth - a.depth);

    const daylight = altitude > 0 ? 1 : 0.35;
    for (const { face, pts } of visible) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      if (this.wireframe) {
        ctx.strokeStyle = face.layer === 'terrain' ? 'rgba(32,199,245,0.18)' : 'rgba(32,199,245,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        continue;
      }
      const diffuse = (0.42 + 0.58 * Math.max(0, dot(face.normal, sun))) * daylight;
      const view = normalize(sub(projector.eye, centroid(face.points)));
      const half = normalize(vec(sun.x + view.x, sun.y + view.y, sun.z + view.z));
      const specular = face.shine * Math.max(0, dot(face.normal, half)) ** 24 * 150 * daylight;
      const [r, g, b] = face.color.map((ch) => Math.round(Math.min(255, ch * diffuse + 12 + specular)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.strokeStyle = face.layer === 'terrain' ? 'rgba(7,17,26,0.25)' : 'rgba(7,17,26,0.55)';
      ctx.lineWidth = face.layer === 'terrain' ? 0.5 : 0.8;
      ctx.stroke();
    }

    this.drawNorth(ctx, w, hgt, projector);
    const zoom = this.preset === 'interior' ? 'Vista interior' : `Zoom ${(100 * (this.scene.radius * 2.6) / this.camera.distance).toFixed(0)} %`;
    this.status.textContent = `Sol ${altitude.toFixed(0)}° · ${zoom}`;
  }

  private drawNorth(ctx: CanvasRenderingContext2D, w: number, hgt: number, projector: ReturnType<typeof createProjector>): void {
    const cx = w - 34;
    const cy = hgt - 40;
    const t = this.camera.target;
    const a = projector.project(t);
    const b = projector.project(vec(t.x, t.y, t.z - 5));
    const angle = a && b ? Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2 : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(234,242,248,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(angle);
    ctx.fillStyle = '#20c7f5';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#eaf2f8';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy + 30);
  }
}
