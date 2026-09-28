import type { FloorPlanKind, Prisma } from '@prisma/client';
import type { FacadeSide, Project } from '../../../../shared/types/project';
import { computeMetrics, floorArea, roofRise } from '../../../../shared/domain/metrics';
import { PRELIMINARY_DISCLAIMER, SIDE_LABEL } from '../../../../shared/i18n/es';
import { prisma } from '../../db/prisma';
import { projectsService } from '../projects/projects.service';

export interface FloorPlanDto {
  id: string;
  kind: FloorPlanKind;
  floorKey: string | null;
  name: string;
  data: unknown;
  createdAt: string;
}

interface PlanDraft {
  kind: FloorPlanKind;
  floorKey: string | null;
  name: string;
  data: object;
}

const SIDES: readonly FacadeSide[] = ['front', 'back', 'left', 'right'];

export function draftPlans(project: Project): PlanDraft[] {
  const { building, terrain } = project;
  const metrics = computeMetrics(project);
  const generatedFrom = {
    floorCount: building.floors.length,
    roomCount: building.floors.reduce((sum, f) => sum + f.rooms.length, 0),
    buildingWidth: building.floors[0]?.footprint.width ?? 0,
    buildingLength: building.floors[0]?.footprint.depth ?? 0,
  };

  const floors: PlanDraft[] = building.floors.map((floor) => ({
    kind: 'floor',
    floorKey: floor.id,
    name: floor.name,
    data: { floor, area: floorArea(floor), generatedFrom, disclaimer: PRELIMINARY_DISCLAIMER },
  }));

  const site: PlanDraft = {
    kind: 'site',
    floorKey: null,
    name: 'Plano de implantación',
    data: {
      lot: { width: terrain.width, length: terrain.length, area: metrics.lotArea, shape: terrain.shape, orientation: terrain.orientation, accessSide: terrain.accessSide },
      building: { x: building.setbackX, y: building.setbackY, width: generatedFrom.buildingWidth, depth: generatedFrom.buildingLength },
      zones: { garden: terrain.gardenArea, parking: terrain.parkingArea, pool: terrain.poolArea, free: metrics.freeArea },
      indices: { cos: metrics.cos, cus: metrics.cus },
    },
  };

  const elevations: PlanDraft[] = SIDES.map((side) => ({
    kind: 'elevation',
    floorKey: null,
    name: `Fachada ${SIDE_LABEL[side].toLowerCase()}`,
    data: {
      side,
      totalHeight: metrics.totalHeight,
      roofRise: roofRise(project),
      floors: building.floors.map((f) => ({ id: f.id, level: f.level, height: f.height, openings: f.openings[side] })),
    },
  }));

  const section: PlanDraft = {
    kind: 'section',
    floorKey: null,
    name: 'Corte esquemático A-A',
    data: {
      terrainSlope: terrain.slopePercent,
      roofRise: roofRise(project),
      floors: building.floors.map((f) => ({ id: f.id, name: f.name, level: f.level, height: f.height, rooms: f.rooms.map((r) => r.name) })),
    },
  };

  return [...floors, site, ...elevations, section];
}

const toDto = (row: { id: string; kind: FloorPlanKind; floorKey: string | null; name: string; data: Prisma.JsonValue; createdAt: Date }): FloorPlanDto => ({
  id: row.id,
  kind: row.kind,
  floorKey: row.floorKey,
  name: row.name,
  data: row.data,
  createdAt: row.createdAt.toISOString(),
});

export const floorPlansService = {
  async list(ownerId: string, projectId: string): Promise<FloorPlanDto[]> {
    await projectsService.get(ownerId, projectId);
    const rows = await prisma.floorPlan.findMany({ where: { projectId }, orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] });
    return rows.map(toDto);
  },

  async generate(ownerId: string, projectId: string): Promise<FloorPlanDto[]> {
    const project = await projectsService.get(ownerId, projectId);
    const drafts = draftPlans(project);
    await prisma.$transaction([
      prisma.floorPlan.deleteMany({ where: { projectId } }),
      prisma.floorPlan.createMany({ data: drafts.map((d) => ({ ...d, data: d.data as Prisma.InputJsonValue, projectId })) }),
    ]);
    return this.list(ownerId, projectId);
  },
};
