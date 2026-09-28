import type { Project } from '../../types/project';
import { computeMetrics } from '../metrics';
import { BUILDING_TYPE_LABEL, ORIENTATION_LABEL } from '../../../shared/i18n/es';

export const EXTERNAL_SYSTEM_PROMPT = [
  'Eres el asistente de arquitectura de ARQUILA.',
  'Respondes en español, con recomendaciones preliminares y prácticas sobre diseño, terreno, materiales y normativa urbana básica.',
  'Aclara que las respuestas no sustituyen la revisión de un profesional certificado.',
].join(' ');

export function describeProject(project: Project): string {
  const m = computeMetrics(project);
  const t = project.terrain;
  const floors = project.building.floors.map((f) => `${f.name}: ${f.rooms.map((r) => r.name).join(', ')}`).join(' | ');
  return [
    `Proyecto: ${project.name} (${BUILDING_TYPE_LABEL[project.buildingType]}, estilo ${project.style}) en ${project.city}, ${project.region}.`,
    `Lote ${t.width} × ${t.length} m (${m.lotArea.toFixed(0)} m²), pendiente ${t.slopePercent} %, elevación ${t.elevation} m s. n. m., orientación ${ORIENTATION_LABEL[t.orientation]}, suelo ${t.soilType}.`,
    `Área construida ${m.builtArea.toFixed(0)} m², COS ${m.cos.toFixed(2)} (máx. ${t.maxCos}), CUS ${m.cus.toFixed(2)} (máx. ${t.maxCus}).`,
    `Distribución: ${floors}.`,
  ].join('\n');
}
