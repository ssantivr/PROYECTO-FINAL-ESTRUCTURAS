import type { FinishSlot, Material, Project } from '../types/project';
import type { MaterialRecommendationResult, TerrainAnalysisInput, TerrainAnalysisResult } from '../types/ai';
import { BUILDING_TYPE_LABEL, ORIENTATION_LABEL, SHAPE_LABEL, SIDE_LABEL } from '../i18n/es';
import { computeMetrics } from './metrics';
import { monthlyInsolation, slopeDistribution } from './terrainAnalysis';
import { describeRooms } from './layoutGenerator';

const fmt = (value: number, digits = 0) =>
  value.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export type Climate = 'cálido' | 'templado' | 'frío' | 'páramo';

export function climateFor(elevation: number): Climate {
  if (elevation < 1000) return 'cálido';
  if (elevation < 2000) return 'templado';
  if (elevation < 3000) return 'frío';
  return 'páramo';
}

export function terrainInputFromProject(project: Project): TerrainAnalysisInput {
  const { terrain } = project;
  const metrics = computeMetrics(project);
  return {
    width: terrain.width,
    length: terrain.length,
    area: metrics.lotArea,
    shape: terrain.shape,
    slope: terrain.slopePercent,
    elevation: terrain.elevation,
    orientation: terrain.orientation,
    access: terrain.accessSide,
    latitude: terrain.latitude,
    constructionArea: metrics.footprintArea,
    gardenArea: terrain.gardenArea,
    parkingArea: terrain.parkingArea,
    poolArea: terrain.poolArea,
    maxFloors: terrain.maxFloors,
  };
}

export function analyzeTerrainRules(input: TerrainAnalysisInput): TerrainAnalysisResult {
  const climate = climateFor(input.elevation);
  const drop = (input.slope / 100) * input.length;
  const tropical = Math.abs(input.latitude) < 15;
  const sunSide = input.latitude >= 0 ? 'sur' : 'norte';
  const free = input.area - input.constructionArea - input.parkingArea - input.poolArea;
  const occupation = input.constructionArea / input.area;

  const placement =
    input.slope < 5
      ? `La pendiente de ${fmt(input.slope, 1)} % permite una implantación relativamente sencilla, con una sola plataforma de cimentación.`
      : input.slope <= 15
        ? `Con ${fmt(input.slope, 1)} % de pendiente (desnivel de ${fmt(drop, 2)} m) conviene escalonar la placa o plantear un muro de contención en el lindero más alto.`
        : `La pendiente de ${fmt(input.slope, 1)} % es fuerte: implante la construcción en terrazas y evalúe muros de contención y un estudio geotécnico detallado.`;

  return {
    orientationRecommendation: tropical
      ? `El lote está a ${fmt(Math.abs(input.latitude), 2)}° de latitud: el sol pasa casi cenital. El frente mira al ${ORIENTATION_LABEL[input.orientation].toLowerCase()}; proteja las fachadas oriente y occidente con aleros o celosías y ubique las zonas sociales hacia la mejor vista.`
      : `Ubique las zonas de permanencia hacia el ${sunSide} para captar sol en invierno; el frente del lote mira al ${ORIENTATION_LABEL[input.orientation].toLowerCase()}.`,
    placementRecommendation: `${placement} Ocupación de la huella: ${fmt(occupation * 100)} % del lote (${SHAPE_LABEL[input.shape].toLowerCase()}); acceso por el ${SIDE_LABEL[input.access].toLowerCase()}.`,
    drainageRecommendation:
      input.slope > 2
        ? `Considere drenaje en las zonas de menor elevación y cunetas perimetrales: el agua escurre ${fmt(drop, 2)} m a lo largo del lote. Evite que la escorrentía llegue al acceso.`
        : 'Terreno casi plano: dé una pendiente mínima de 1–2 % a patios y zonas duras para evitar encharcamientos y prevea cajas de inspección.',
    lightingRecommendation:
      climate === 'cálido'
        ? 'Aproveche luz natural difusa: ventanas altas, aleros amplios y vidrio con control solar para evitar sobrecalentamiento.'
        : `Clima ${climate}: maximice la ganancia solar con ventanas amplias en las fachadas con más horas de sol y use iluminación cenital en escaleras y pasillos.`,
    ventilationRecommendation:
      climate === 'cálido' || climate === 'templado'
        ? 'Plantee ventilación cruzada entre fachadas opuestas y espacios de doble altura para evacuar el aire caliente.'
        : 'Ventilación controlada: ventanas batientes pequeñas en habitaciones y vidrio doble en fachadas expuestas al viento, evitando corrientes directas.',
    materialRecommendation:
      climate === 'frío' || climate === 'páramo'
        ? 'Materiales con inercia térmica (ladrillo, piedra) en muros, aislamiento bajo cubierta y pisos de madera en zonas de descanso.'
        : 'Materiales claros y ligeros en fachada, cubierta con aislamiento termoacústico y pisos cerámicos frescos.',
    generalNotes: [
      `Área libre estimada: ${fmt(Math.max(0, free))} m² (jardín previsto: ${fmt(input.gardenArea)} m²).`,
      input.poolArea > 0 ? `Piscina de ${fmt(input.poolArea)} m²: ubíquela en la zona más baja y soleada del lote, lejos de la cimentación.` : 'Sin piscina prevista.',
      input.parkingArea > 0 ? `Estacionamiento de ${fmt(input.parkingArea)} m² junto al acceso para reducir recorridos de vehículos.` : 'No se prevé estacionamiento descubierto.',
      `Altura máxima permitida: ${input.maxFloors} pisos.`,
    ],
  };
}

const PREFERENCES: Record<Climate, Record<FinishSlot, string[]>> = {
  cálido: { walls: ['stucco', 'brick'], roof: ['roofTile', 'clayTile'], floor: ['ceramic', 'tile'], frames: ['windows'] },
  templado: { walls: ['stucco', 'brick'], roof: ['clayTile', 'roofTile'], floor: ['tile', 'ceramic'], frames: ['windows'] },
  frío: { walls: ['brick', 'stone'], roof: ['roofTile', 'clayTile'], floor: ['woodFloor', 'tile'], frames: ['woodWindows', 'windows'] },
  páramo: { walls: ['stone', 'brick'], roof: ['roofTile'], floor: ['woodFloor'], frames: ['woodWindows'] },
};

const REASONS: Record<Climate, Record<FinishSlot, string>> = {
  cálido: {
    walls: 'Superficies claras reflejan la radiación y mantienen el interior fresco.',
    roof: 'El aislamiento de la cubierta reduce la ganancia de calor.',
    floor: 'Pisos cerámicos se mantienen frescos y resisten la humedad.',
    frames: 'Aluminio resiste la humedad y permite ventanas amplias para ventilar.',
  },
  templado: {
    walls: 'Buen equilibrio entre costo, mantenimiento y confort.',
    roof: 'Cubierta durable con buen desempeño ante la lluvia.',
    floor: 'Piso resistente y fácil de mantener.',
    frames: 'Carpintería durable con buena relación costo/beneficio.',
  },
  frío: {
    walls: 'Alta inercia térmica: acumula el calor del día y lo libera en la noche.',
    roof: 'Núcleo aislante que reduce pérdidas de calor y ruido de lluvia.',
    floor: 'La madera es más cálida al tacto en zonas de descanso.',
    frames: 'Vidrio doble y marcos de madera reducen puentes térmicos.',
  },
  páramo: {
    walls: 'Muros masivos que protegen del viento y el frío extremo.',
    roof: 'Máximo aislamiento en cubierta.',
    floor: 'Aislamiento y calidez en pisos.',
    frames: 'Carpintería hermética con vidrio doble.',
  },
};

export function recommendMaterialsRules(project: Project): MaterialRecommendationResult {
  const climate = climateFor(project.terrain.elevation);
  const { builtArea } = computeMetrics(project);
  const budgetPerM2 = builtArea > 0 ? project.budget / builtArea : Infinity;
  const tight = budgetPerM2 < 1_800_000;
  const byId = new Map(project.materials.map((m) => [m.id, m]));
  const cheapest = (slot: FinishSlot): Material | undefined =>
    project.materials.filter((m) => m.slot === slot).sort((a, b) => a.unitPrice - b.unitPrice)[0];

  const recommendations = (['walls', 'roof', 'floor', 'frames'] as const).flatMap((slot) => {
    const preferred = PREFERENCES[climate][slot].map((id) => byId.get(id)).find((m) => m !== undefined);
    const choice = tight ? cheapest(slot) ?? preferred : preferred ?? cheapest(slot);
    if (!choice) return [];
    const reason = tight && choice !== preferred
      ? `Presupuesto ajustado (${fmt(budgetPerM2 / 1_000_000, 2)} M COP/m²): opción más económica de su categoría.`
      : REASONS[climate][slot];
    return [{ slot, materialId: choice.id, reason }];
  });

  return {
    recommendations,
    notes: [
      `Clima ${climate} (${fmt(project.terrain.elevation)} m s. n. m.).`,
      `Presupuesto disponible: ${fmt(budgetPerM2 / 1_000_000, 2)} M COP por m² construido${tight ? ', por debajo de la media para vivienda nueva' : ''}.`,
    ],
  };
}

export type RecommendationTopic = 'Terreno' | 'Normativa' | 'Iluminación' | 'Ventilación' | 'Materiales' | 'Espacio';

export interface Recommendation {
  topic: RecommendationTopic;
  text: string;
  priority: 'alta' | 'media' | 'baja';
}

export function projectRecommendations(project: Project): Recommendation[] {
  const metrics = computeMetrics(project);
  const { terrain } = project;
  const analysis = analyzeTerrainRules(terrainInputFromProject(project));
  const steep = slopeDistribution(terrain)
    .filter((b) => b.label === '9–12 %' || b.label === '> 12 %')
    .reduce((sum, b) => sum + b.share, 0);
  const result: Recommendation[] = [];

  result.push({
    topic: 'Terreno',
    priority: terrain.slopePercent > 5 ? 'alta' : 'baja',
    text: `${analysis.placementRecommendation} ${fmt(steep * 100)} % del lote supera el 9 % de pendiente.`,
  });
  result.push({ topic: 'Terreno', priority: 'media', text: analysis.drainageRecommendation });
  result.push({
    topic: 'Normativa',
    priority: metrics.cosCompliant && metrics.cusCompliant ? 'baja' : 'alta',
    text: metrics.cosCompliant && metrics.cusCompliant
      ? `COS ${metrics.cos.toFixed(2)} y CUS ${metrics.cus.toFixed(2)} dentro de los límites (${terrain.maxCos} / ${terrain.maxCus}). Queda margen para ${fmt(terrain.maxCus * metrics.lotArea - metrics.builtArea)} m² adicionales.`
      : `El proyecto excede los índices permitidos (COS ${metrics.cos.toFixed(2)}, CUS ${metrics.cus.toFixed(2)}). Reduzca la huella o el área de los pisos superiores.`,
  });
  const sunniest = [...monthlyInsolation(terrain.latitude)].sort((a, b) => b.sunHours - a.sunHours)[0];
  result.push({ topic: 'Iluminación', priority: 'media', text: `${analysis.lightingRecommendation} Mayor insolación en ${sunniest?.month ?? '—'}.` });
  result.push({ topic: 'Ventilación', priority: 'media', text: analysis.ventilationRecommendation });
  result.push({ topic: 'Materiales', priority: 'baja', text: analysis.materialRecommendation });

  const ground = project.building.floors[0];
  if (ground) {
    const circulation = ground.rooms.filter((r) => r.name === 'Hall' || r.name === 'Escalera');
    const share = circulation.reduce((sum, r) => sum + r.width * r.depth, 0) / (ground.footprint.width * ground.footprint.depth);
    result.push({
      topic: 'Espacio',
      priority: share > 0.18 ? 'media' : 'baja',
      text: `La circulación ocupa ${fmt(share * 100)} % de la planta baja. ${share > 0.18 ? 'Integre el hall con el comedor para ganar área útil.' : 'Proporción de circulación eficiente.'}`,
    });
  }
  return result;
}

export function answerRules(project: Project, question: string): string {
  const q = question.toLowerCase();
  const metrics = computeMetrics(project);
  const match = (...words: string[]) => words.some((w) => q.includes(w));
  const pick = (topic: RecommendationTopic) =>
    projectRecommendations(project).filter((r) => r.topic === topic).map((r) => r.text).join(' ');

  if (match('cos', 'cus', 'norma', 'índice', 'indice'))
    return `COS actual ${metrics.cos.toFixed(2)} (máx. ${project.terrain.maxCos}) y CUS ${metrics.cus.toFixed(2)} (máx. ${project.terrain.maxCus}). Área construida ${fmt(metrics.builtArea)} m² sobre un lote de ${fmt(metrics.lotArea)} m².`;
  if (match('pendiente', 'terreno', 'suelo', 'drenaje')) return pick('Terreno');
  if (match('luz', 'sol', 'ilumin')) return pick('Iluminación');
  if (match('ventil', 'aire', 'viento')) return pick('Ventilación');
  if (match('material', 'ladrillo', 'costo', 'presupuesto')) return pick('Materiales');
  if (match('altura', 'piso'))
    return `Altura total estimada ${metrics.totalHeight.toFixed(2)} m con ${project.building.floors.length} pisos (máximo permitido: ${project.terrain.maxFloors}).`;
  if (match('espacio', 'distribu', 'habitaci')) {
    const byFloor = project.building.floors.map((f, i) =>
      `${f.name}: ${describeRooms(project.building).filter((r) => r.floor === i).map((r) => r.name).join(', ')}`);
    return `Distribución preliminar de la ${BUILDING_TYPE_LABEL[project.buildingType].toLowerCase()}. ${byFloor.join('. ')}. ${pick('Espacio')}`;
  }
  return 'Puedo ayudarle con normativa (COS/CUS), terreno, iluminación, ventilación, materiales, alturas y distribución. Formule la pregunta con alguno de esos temas.';
}
