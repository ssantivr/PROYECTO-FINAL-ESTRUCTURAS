import type { Project } from '../types/project';
import { computeMetrics } from './metrics';
import { monthlyInsolation, slopeDistribution } from './terrainAnalysis';
import { formatNumber } from '../core/dom';

export type RecommendationTopic = 'Terreno' | 'Normativa' | 'Iluminación' | 'Ventilación' | 'Materiales' | 'Espacio';

export interface Recommendation {
  topic: RecommendationTopic;
  text: string;
  priority: 'alta' | 'media' | 'baja';
}

/** Local rule engine; the interface is kept so a remote LLM provider can replace it later. */
export interface AssistantProvider {
  recommend(project: Project): Recommendation[];
  answer(project: Project, question: string): string;
}

export class RuleBasedAssistant implements AssistantProvider {
  recommend(project: Project): Recommendation[] {
    const metrics = computeMetrics(project);
    const { terrain } = project;
    const result: Recommendation[] = [];
    const steep = slopeDistribution(terrain)
      .filter((b) => b.label === '9–12 %' || b.label === '> 12 %')
      .reduce((sum, b) => sum + b.share, 0);

    if (terrain.slopePercent > 5) {
      result.push({
        topic: 'Terreno',
        priority: 'alta',
        text: `Pendiente media de ${terrain.slopePercent} %: plantee un muro de contención en el lindero posterior y drenaje perimetral tipo francés. ${formatNumber(steep * 100)} % del lote supera el 9 %.`,
      });
    }
    result.push({
      topic: 'Terreno',
      priority: 'media',
      text: `Suelo ${terrain.soilType.toLowerCase()} a ${formatNumber(terrain.elevation)} m s. n. m.: solicite estudio geotécnico y considere zapatas aisladas con viga de amarre (NSR-10, zona de amenaza sísmica alta).`,
    });
    result.push({
      topic: 'Normativa',
      priority: metrics.cosCompliant && metrics.cusCompliant ? 'baja' : 'alta',
      text:
        metrics.cosCompliant && metrics.cusCompliant
          ? `COS ${metrics.cos.toFixed(2)} y CUS ${metrics.cus.toFixed(2)} dentro de los límites (${terrain.maxCos} / ${terrain.maxCus}). Queda margen para ${formatNumber(terrain.maxCus * metrics.lotArea - metrics.builtArea)} m² adicionales.`
          : `El proyecto excede los índices permitidos (COS ${metrics.cos.toFixed(2)}, CUS ${metrics.cus.toFixed(2)}). Reduzca la huella o el área de la planta alta.`,
    });

    const sunniest = [...monthlyInsolation(terrain.latitude)].sort((a, b) => b.sunHours - a.sunHours)[0];
    result.push({
      topic: 'Iluminación',
      priority: 'media',
      text: `Latitud ${terrain.latitude.toFixed(2)}°: el sol pasa casi cenital; priorice iluminación cenital en escalera y aleros ≥ ${project.building.roof.overhang} m en fachadas oriente-occidente. Mayor insolación en ${sunniest?.month ?? '—'}.`,
    });
    result.push({
      topic: 'Ventilación',
      priority: 'media',
      text: 'Clima frío de montaña (≈13 °C): ventilación cruzada controlada con ventanas batientes, evitando corrientes directas en habitaciones; use vidrio doble en fachadas expuestas al viento.',
    });
    result.push({
      topic: 'Materiales',
      priority: 'baja',
      text: 'Ladrillo estructural a la vista y cubierta termoacústica mejoran la inercia térmica. Considere piso en madera laminada en la planta alta para confort térmico.',
    });
    const ground = project.building.floors[0];
    if (ground) {
      const circulation = ground.rooms.filter((r) => r.name === 'Hall' || r.name === 'Escalera');
      const share = circulation.reduce((sum, r) => sum + r.width * r.depth, 0) / (ground.footprint.width * ground.footprint.depth);
      result.push({
        topic: 'Espacio',
        priority: share > 0.18 ? 'media' : 'baja',
        text: `La circulación ocupa ${formatNumber(share * 100)} % de la planta baja. ${share > 0.18 ? 'Integre el hall con el comedor para ganar área útil.' : 'Proporción de circulación eficiente.'}`,
      });
    }
    return result;
  }

  answer(project: Project, question: string): string {
    const q = question.toLowerCase();
    const metrics = computeMetrics(project);
    const match = (...words: string[]) => words.some((w) => q.includes(w));

    if (match('cos', 'cus', 'norma', 'índice', 'indice'))
      return `COS actual ${metrics.cos.toFixed(2)} (máx. ${project.terrain.maxCos}) y CUS ${metrics.cus.toFixed(2)} (máx. ${project.terrain.maxCus}). Área construida ${formatNumber(metrics.builtArea)} m² sobre un lote de ${formatNumber(metrics.lotArea)} m².`;
    if (match('pendiente', 'terreno', 'suelo'))
      return this.pick(project, 'Terreno');
    if (match('luz', 'sol', 'ilumin'))
      return this.pick(project, 'Iluminación');
    if (match('ventil', 'aire', 'viento'))
      return this.pick(project, 'Ventilación');
    if (match('material', 'ladrillo', 'costo', 'presupuesto'))
      return this.pick(project, 'Materiales');
    if (match('altura', 'piso'))
      return `Altura total estimada ${metrics.totalHeight.toFixed(2)} m con ${project.building.floors.length} pisos (máximo permitido: ${project.terrain.maxFloors}).`;
    if (match('espacio', 'distribu', 'habitaci'))
      return this.pick(project, 'Espacio');
    return 'Puedo ayudarle con normativa (COS/CUS), terreno, iluminación, ventilación, materiales, alturas y distribución. Formule la pregunta con alguno de esos temas.';
  }

  private pick(project: Project, topic: RecommendationTopic): string {
    return this.recommend(project)
      .filter((r) => r.topic === topic)
      .map((r) => r.text)
      .join(' ');
  }
}
