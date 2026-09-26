import type { Floor, Project, Rect } from '../types/project';

export interface ProjectMetrics {
  lotArea: number;
  footprintArea: number;
  builtArea: number;
  cos: number;
  cus: number;
  cosCompliant: boolean;
  cusCompliant: boolean;
  floorsCompliant: boolean;
  totalHeight: number;
  freeArea: number;
}

export const rectArea = (rect: Rect): number => rect.width * rect.depth;

export function floorArea(floor: Floor): number {
  return rectArea(floor.footprint);
}

export function roofRise(project: Project): number {
  const top = project.building.floors.at(-1);
  if (!top) return 0;
  const { pitchDeg, overhang } = project.building.roof;
  return ((top.footprint.depth + overhang * 2) / 2) * Math.tan((pitchDeg * Math.PI) / 180);
}

export function computeMetrics(project: Project): ProjectMetrics {
  const { terrain, building } = project;
  const lotArea = terrain.width * terrain.length;
  const ground = building.floors[0];
  const footprintArea = ground ? floorArea(ground) : 0;
  const builtArea = building.floors.reduce((sum, floor) => sum + floorArea(floor), 0);
  const cos = footprintArea / lotArea;
  const cus = builtArea / lotArea;
  const top = building.floors.at(-1);
  const totalHeight = top ? top.level + top.height + roofRise(project) : 0;

  return {
    lotArea,
    footprintArea,
    builtArea,
    cos,
    cus,
    cosCompliant: cos <= terrain.maxCos,
    cusCompliant: cus <= terrain.maxCus,
    floorsCompliant: building.floors.length <= terrain.maxFloors,
    totalHeight,
    freeArea: lotArea - footprintArea,
  };
}
