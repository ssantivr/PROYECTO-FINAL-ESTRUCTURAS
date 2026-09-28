import type { Project } from '../types/project';
import { BUILDING_TYPE_LABEL, PRELIMINARY_DISCLAIMER } from '../../shared/i18n/es';
import { drawPlanSheet } from '../render/planDrawing';
import { drawSitePlan } from '../render/sitePlan';
import { drawElevation } from '../render/elevationDrawing';
import { computeMetrics } from './metrics';
import { EXPORT_STYLE } from './persistence';

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function svgMarkup(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clone.outerHTML;
}

export function exportPdf(project: Project): boolean {
  const m = computeMetrics(project);
  const ground = project.building.floors[0];
  const date = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const sheet = (title: string, svg: SVGSVGElement) => `<section class="sheet"><h2>${escape(title)}</h2><div class="drawing">${svgMarkup(svg)}</div></section>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(project.name)} · Planos preliminares</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 11px/1.4 Arial, sans-serif; color: #111; }
header { display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; border: 1.5px solid #111; padding: 10px 14px; margin-bottom: 10px; }
header h1 { margin: 0; font-size: 18px; letter-spacing: .04em; }
header dl { display: grid; grid-template-columns: repeat(4, auto); gap: 2px 16px; margin: 0; }
header dt { color: #555; } header dd { margin: 0; font-weight: bold; }
.note { grid-column: 1 / -1; margin: 0; padding: 6px 8px; background: #f3f3f3; border-left: 3px solid #111; }
.sheet { page-break-inside: avoid; margin-bottom: 12px; }
.sheet h2 { font-size: 12px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .08em; }
.drawing svg { width: 100%; max-height: 150mm; display: block; }
.sheet + .sheet { page-break-before: always; }
${EXPORT_STYLE}
</style></head><body>
<header>
  <h1>${escape(project.name.toUpperCase())}</h1>
  <strong>ARQUILA · ${escape(date)}</strong>
  <dl>
    <dt>Tipo</dt><dd>${escape(BUILDING_TYPE_LABEL[project.buildingType])}</dd>
    <dt>Ubicación</dt><dd>${escape(`${project.city}, ${project.region}`)}</dd>
    <dt>Lote</dt><dd>${m.lotArea.toFixed(1)} m² (${project.terrain.width} × ${project.terrain.length} m)</dd>
    <dt>Área construida</dt><dd>${m.builtArea.toFixed(1)} m²</dd>
    <dt>Huella</dt><dd>${ground ? `${ground.footprint.width.toFixed(2)} × ${ground.footprint.depth.toFixed(2)} m` : '—'}</dd>
    <dt>Pisos</dt><dd>${project.building.floors.length}</dd>
    <dt>COS / CUS</dt><dd>${m.cos.toFixed(2)} / ${m.cus.toFixed(2)}</dd>
    <dt>Altura total</dt><dd>${m.totalHeight.toFixed(2)} m</dd>
  </dl>
  <p class="note"><strong>PROPUESTA PRELIMINAR.</strong> ${escape(PRELIMINARY_DISCLAIMER)}</p>
</header>
${project.building.floors.map((f) => sheet(`${f.name} · cotas en metros`, drawPlanSheet([f]))).join('\n')}
${sheet('Plano de implantación', drawSitePlan(project))}
${sheet('Fachada principal', drawElevation(project, 'front'))}
${sheet('Corte esquemático A-A', drawElevation(project, 'section'))}
<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
