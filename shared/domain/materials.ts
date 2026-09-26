import type { Material, Project } from '../types/project';
import { computeMetrics } from './metrics';

export interface MaterialEstimate {
  material: Material;
  quantity: number;
  cost: number;
}

export function estimateMaterials(project: Project): MaterialEstimate[] {
  const { builtArea } = computeMetrics(project);
  return project.materials.map((material) => {
    const quantity = material.ratePerM2 * builtArea;
    return { material, quantity, cost: quantity * material.unitPrice };
  });
}

export function totalCost(estimates: MaterialEstimate[]): number {
  return estimates.reduce((sum, item) => sum + item.cost, 0);
}

export interface ConstructionPhase {
  name: string;
  weeks: number;
  share: number;
}

/** Phase durations scale with built area (baseline: 200 m² ≈ 32 weeks). */
export function constructionSchedule(project: Project): ConstructionPhase[] {
  const { builtArea } = computeMetrics(project);
  const factor = builtArea / 200;
  const phases: Array<[string, number]> = [
    ['Preliminares y replanteo', 2],
    ['Cimentación', 4],
    ['Estructura', 8],
    ['Mampostería', 6],
    ['Cubierta', 3],
    ['Instalaciones', 4],
    ['Acabados', 5],
  ];
  const total = phases.reduce((sum, [, weeks]) => sum + weeks, 0);
  return phases.map(([name, weeks]) => ({
    name,
    weeks: Math.max(1, Math.round(weeks * factor)),
    share: weeks / total,
  }));
}
