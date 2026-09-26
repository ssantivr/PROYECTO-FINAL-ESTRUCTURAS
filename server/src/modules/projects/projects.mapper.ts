import type { Prisma } from '@prisma/client';
import type { FacadeSide, Floor, Material, Opening, Project } from '../../../../shared/types/project';
import type { ProjectInput } from './projects.schemas';

export const projectInclude = {
  terrain: true,
  building: {
    include: {
      floors: {
        orderBy: { position: 'asc' },
        include: {
          rooms: { orderBy: { position: 'asc' } },
          openings: { orderBy: [{ side: 'asc' }, { position: 'asc' }] },
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

const SIDES: readonly FacadeSide[] = ['front', 'back', 'left', 'right'];

function toFloor(floor: NonNullable<ProjectRecord['building']>['floors'][number]): Floor {
  const openings = Object.fromEntries(SIDES.map((side) => [side, [] as Opening[]])) as Record<FacadeSide, Opening[]>;
  for (const o of floor.openings) {
    openings[o.side].push({ offset: o.offset, width: o.width, height: o.height, sill: o.sill, kind: o.kind });
  }
  return {
    id: floor.key,
    name: floor.name,
    level: floor.level,
    height: floor.height,
    footprint: { x: floor.footprintX, y: floor.footprintY, width: floor.footprintWidth, depth: floor.footprintDepth },
    rooms: floor.rooms.map((r) => ({ id: r.key, name: r.name, x: r.x, y: r.y, width: r.width, depth: r.depth })),
    openings,
  };
}

/** Database aggregate → API/domain DTO shared with the frontend. */
export function toProjectDto(record: ProjectRecord, materials: Material[]): Project {
  const { terrain, building } = record;
  if (!terrain || !building) throw new Error(`Proyecto ${record.id} incompleto en base de datos.`);
  return {
    id: record.id,
    name: record.name,
    city: record.city,
    region: record.region,
    style: record.style,
    updatedAt: record.updatedAt.toISOString(),
    terrain: {
      width: terrain.width,
      length: terrain.length,
      slopePercent: terrain.slopePercent,
      elevation: terrain.elevation,
      orientation: terrain.orientation,
      latitude: terrain.latitude,
      longitude: terrain.longitude,
      soilType: terrain.soilType,
      maxCos: terrain.maxCos,
      maxCus: terrain.maxCus,
      maxFloors: terrain.maxFloors,
    },
    building: {
      setbackX: building.setbackX,
      setbackY: building.setbackY,
      roof: { kind: 'gable', pitchDeg: building.roofPitchDeg, overhang: building.roofOverhang },
      floors: building.floors.map(toFloor),
    },
    materials,
  };
}

/** Nested create payload for a building and all of its floors, rooms and openings. */
export function buildingCreateData(building: ProjectInput['building']): Prisma.BuildingCreateWithoutProjectInput {
  return {
    setbackX: building.setbackX,
    setbackY: building.setbackY,
    roofKind: building.roof.kind,
    roofPitchDeg: building.roof.pitchDeg,
    roofOverhang: building.roof.overhang,
    floors: {
      create: building.floors.map((floor, position) => ({
        key: floor.id,
        name: floor.name,
        position,
        level: floor.level,
        height: floor.height,
        footprintX: floor.footprint.x,
        footprintY: floor.footprint.y,
        footprintWidth: floor.footprint.width,
        footprintDepth: floor.footprint.depth,
        rooms: {
          create: floor.rooms.map((room, index) => ({
            key: room.id, name: room.name, position: index, x: room.x, y: room.y, width: room.width, depth: room.depth,
          })),
        },
        openings: {
          create: SIDES.flatMap((side) =>
            floor.openings[side].map((o, index) => ({ side, position: index, ...o }))),
        },
      })),
    },
  };
}
