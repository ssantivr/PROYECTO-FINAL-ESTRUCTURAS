import { Component } from '../core/component';
import { h, icon, type IconName } from '../core/dom';
import type { AppStore } from '../core/appState';
import { buildScene, type Face, type Scene } from '../render/sceneBuilder';
import { centroid, createProjector, dot, normalize, sub, vec, type OrbitCamera, type Vec3 } from '../render/math3d';
import { dayOfYearFromMonth, MONTHS, sunPosition } from '../services/terrainAnalysis';

type Preset = 'iso' | 'front' | 'side' | 'top';

const PRESETS: Record<Preset, Pick<OrbitCamera, 'yaw' | 'pitch'>> = {
  iso: { yaw: -2.45, pitch: 0.55 },
  front: { yaw: Math.PI, pitch: 0.08 },
  side: { yaw: -Math.PI / 2, pitch: 0.08 },
  top: { yaw: Math.PI, pitch: 1.5 },
};

export class Viewer3D extends Component {
  private readonly canvas = h('canvas', { class: 'viewer-canvas', 'aria-label': 'Visualización 3D del proyecto' });
  private readonly ctx: CanvasRenderingContext2D;
  private readonly status = h('span', { class: 'viewer-status' });
  private camera: OrbitCamera = { target: vec(0, 0, 0), yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, distance: 40, fov: 0.9 };
  private scene: Scene;
  private options = { showTerrain: true, wireframe: false };
  private frame = 0;

  constructor(private readonly store: AppStore) {
    super(h('section', { class: 'panel viewer', 'data-area': 'viewer' }));
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.scene = buildScene(store.get().project, this.options);
    this.resetCamera();

    this.el.append(
      h('header', { class: 'panel-head' },
        h('h2', {}, 'Visualizador 3D'),
        h('div', { class: 'segmented' }, ...(['iso', 'front', 'side', 'top'] as const).map((p) =>
          h('button', { class: 'seg', type: 'button', onclick: () => this.applyPreset(p) }, { iso: 'Isométrica', front: 'Frontal', side: 'Lateral', top: 'Planta' }[p]))),
      ),
      h('div', { class: 'viewer-stage' },
        this.canvas,
        h('div', { class: 'viewer-toolbar' },
          this.tool('zoomIn', 'Acercar', () => this.zoom(0.85)),
          this.tool('zoomOut', 'Alejar', () => this.zoom(1.18)),
          this.tool('rotate', 'Restablecer vista', () => this.resetCamera()),
          this.toggle('terrain', 'Mostrar terreno', true, (on) => this.setOption('showTerrain', on)),
          this.toggle('grid', 'Modo alámbrico', false, (on) => this.setOption('wireframe', on)),
        ),
        h('div', { class: 'viewer-hint' }, 'Arrastrar: orbitar · Shift + arrastrar: desplazar · Rueda: zoom'),
        this.status,
      ),
      this.sunControls(),
    );

    this.bindPointer();
    const resize = new ResizeObserver(() => this.requestDraw());
    resize.observe(this.canvas);
    this.track(() => resize.disconnect());
    this.track(store.select((s) => s.project, (project) => {
      this.scene = buildScene(project, this.options);
      this.requestDraw();
    }));
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

  private setOption<K extends keyof Viewer3D['options']>(key: K, value: boolean): void {
    this.options = { ...this.options, [key]: value };
    if (key === 'showTerrain') this.scene = buildScene(this.store.get().project, this.options);
    this.requestDraw();
  }

  private resetCamera(): void {
    this.camera = { ...this.camera, ...PRESETS.iso, target: this.scene.center, distance: this.scene.radius * 2.6 };
    this.requestDraw();
  }

  private applyPreset(preset: Preset): void {
    this.camera = { ...this.camera, ...PRESETS[preset], target: this.scene.center };
    this.requestDraw();
  }

  private zoom(factor: number): void {
    const distance = Math.min(this.scene.radius * 8, Math.max(6, this.camera.distance * factor));
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
        const pitch = Math.min(1.55, Math.max(0.02, this.camera.pitch + dy * 0.006));
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
    const k = distance * 0.0016;
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
    // World: -z faces the street (north for orientation "N"), +x east.
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
    const visible: Array<{ face: Face; depth: number; pts: Array<{ x: number; y: number }> }> = [];

    for (const face of this.scene.faces) {
      const c = centroid(face.points);
      let normal = face.normal;
      if (face.layer === 'terrain') {
        if (normal.y < 0) normal = vec(-normal.x, -normal.y, -normal.z);
      } else if (dot(normal, sub(c, this.scene.buildingCenter)) < 0) {
        normal = vec(-normal.x, -normal.y, -normal.z);
      }
      if (!this.options.wireframe && dot(normal, sub(projector.eye, c)) <= 0) continue;
      const pts = face.points.map((p) => projector.project(p));
      if (pts.some((p) => p === null)) continue;
      const depth = Math.hypot(...Object.values(sub(c, projector.eye))) - (face.overlay ? 0.6 : 0);
      visible.push({ face: { ...face, normal }, depth, pts: pts as Array<{ x: number; y: number }> });
    }

    const layerOrder = (f: Face) => (f.layer === 'terrain' ? 0 : 1);
    visible.sort((a, b) => layerOrder(a.face) - layerOrder(b.face) || b.depth - a.depth);

    const daylight = altitude > 0 ? 1 : 0.35;
    for (const { face, pts } of visible) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      if (this.options.wireframe) {
        ctx.strokeStyle = face.layer === 'terrain' ? 'rgba(32,199,245,0.18)' : 'rgba(32,199,245,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        continue;
      }
      const light = (0.42 + 0.58 * Math.max(0, dot(face.normal, sun))) * daylight;
      const [r, g, b] = face.color.map((ch) => Math.round(Math.min(255, ch * light + 12)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.strokeStyle = face.layer === 'terrain' ? 'rgba(7,17,26,0.25)' : 'rgba(7,17,26,0.55)';
      ctx.lineWidth = face.layer === 'terrain' ? 0.5 : 0.8;
      ctx.stroke();
    }

    this.drawNorth(ctx, w, hgt, projector);
    this.status.textContent = `Sol ${altitude.toFixed(0)}° · Zoom ${(100 * (this.scene.radius * 2.6) / this.camera.distance).toFixed(0)} %`;
  }

  private drawNorth(ctx: CanvasRenderingContext2D, w: number, hgt: number, projector: ReturnType<typeof createProjector>): void {
    const cx = w - 34;
    const cy = hgt - 40;
    // Screen direction of world -z (north), measured from the projected target.
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
