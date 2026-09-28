import type { BuildingProgram, Project, Terrain } from '../../../../shared/types/project';
import { computeMetrics } from '../../../../shared/domain/metrics';
import { describeRooms } from '../../../../shared/domain/layoutGenerator';
import { climateFor } from '../../../../shared/domain/assistantRules';
import { BUILDING_TYPE_LABEL, FINISH_SLOT_LABEL, ORIENTATION_LABEL, PROGRAM_TOGGLE_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../../../../shared/i18n/es';

export const SYSTEM_PROMPT = [
  'Eres ARQUILA IA, asistente de una plataforma de arquitectura, terrenos y construcción en Colombia.',
  'Responde SIEMPRE en español, con un tono profesional, claro y breve.',
  'Tus recomendaciones son PRELIMINARES: no sustituyen la revisión de un arquitecto, ingeniero u otro profesional competente, y nunca debes presentarlas como certificadas.',
  'Usa únicamente los datos del proyecto que se te entregan; si falta un dato, dilo en lugar de inventarlo.',
  'Cita valores con unidades (m, m², %, m s. n. m.).',
].join(' ');

const fmt = (value: number, digits = 1) => value.toLocaleString('es-CO', { maximumFractionDigits: digits });

export function terrainContext(terrain: Terrain): string {
  return [
    `Terreno: ${fmt(terrain.width)} m × ${fmt(terrain.length)} m (${fmt(terrain.width * terrain.length, 0)} m²), forma ${SHAPE_LABEL[terrain.shape].toLowerCase()}.`,
    `Pendiente: ${fmt(terrain.slopePercent)} %. Elevación: ${fmt(terrain.elevation, 0)} m s. n. m. (clima ${climateFor(terrain.elevation)}).`,
    `Orientación del frente: ${ORIENTATION_LABEL[terrain.orientation]}. Acceso principal: ${SIDE_LABEL[terrain.accessSide].toLowerCase()}. Latitud ${fmt(terrain.latitude, 3)}°.`,
    `Suelo: ${terrain.soilType}. Jardín ${fmt(terrain.gardenArea, 0)} m², estacionamiento ${fmt(terrain.parkingArea, 0)} m², piscina ${fmt(terrain.poolArea, 0)} m².`,
    `Norma: COS máx. ${terrain.maxCos}, CUS máx. ${terrain.maxCus}, máximo ${terrain.maxFloors} pisos.`,
  ].join('\n');
}

export function programContext(program: BuildingProgram): string {
  const spaces = (Object.keys(PROGRAM_TOGGLE_LABEL) as Array<keyof typeof PROGRAM_TOGGLE_LABEL>)
    .filter((key) => program[key])
    .map((key) => PROGRAM_TOGGLE_LABEL[key]);
  return `Programa: ${program.floors} pisos, ${program.bedrooms} habitaciones, ${program.bathrooms} baños. Espacios: ${spaces.join(', ') || 'ninguno adicional'}.`;
}

export function projectContext(project: Project): string {
  const metrics = computeMetrics(project);
  const rooms = describeRooms(project.building);
  const finishes = (Object.keys(project.finishes) as Array<keyof Project['finishes']>).map((slot) => {
    const material = project.materials.find((m) => m.id === project.finishes[slot]);
    return `${FINISH_SLOT_LABEL[slot]}: ${material?.name ?? project.finishes[slot]}`;
  });
  return [
    `Proyecto: ${project.name} (${BUILDING_TYPE_LABEL[project.buildingType]}, estilo ${project.style}) en ${project.city}, ${project.region}.`,
    project.description ? `Descripción: ${project.description}` : '',
    `Presupuesto aproximado: ${fmt(project.budget, 0)} COP.`,
    terrainContext(project.terrain),
    programContext(project.building.program),
    `Edificación: ${project.building.floors.length} pisos, área construida ${fmt(metrics.builtArea, 0)} m², huella ${fmt(metrics.footprintArea, 0)} m², COS ${metrics.cos.toFixed(2)}, CUS ${metrics.cus.toFixed(2)}, altura ${fmt(metrics.totalHeight)} m.`,
    ...project.building.floors.map((floor, i) =>
      `${floor.name}: ${rooms.filter((r) => r.floor === i).map((r) => `${r.name} ${fmt(r.area)} m²`).join(', ')}.`),
    `Acabados: ${finishes.join('; ')}.`,
  ].filter(Boolean).join('\n');
}
