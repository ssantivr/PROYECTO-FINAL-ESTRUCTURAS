import type { Prisma } from '@prisma/client';
import type { Building, FacadeSide, Finishes, Floor, Material, Opening, Project } from '../../../../shared/types/project';
import { FINISH_SLOTS } from '../../../../shared/types/project';
import { defaultFinishes } from '../../../../shared/data/materialCatalog';

export const projectInclude = {
  terrain: true,
  finishes: { include: { material: { select: { key: true } } } },
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
type BuildingRecord = NonNullable<ProjectRecord['building']>;

const SIDES: readonly FacadeSide[] = ['front', 'back', 'left', 'right'];

function toFloor(floor: BuildingRecord['floors'][number]): Floor {
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

export function toBuildingDto(building: BuildingRecord): Building {
  return {
    setbackX: building.setbackX,
    setbackY: building.setbackY,
    program: {
      floors: building.programFloors,
      bedrooms: building.bedrooms,
      bathrooms: building.bathrooms,
      kitchen: building.kitchen,
      livingRoom: building.livingRoom,
      diningRoom: building.diningRoom,
      garage: building.garage,
      terrace: building.terrace,
      balcony: building.balcony,
      garden: building.garden,
      pool: building.pool,
      laundry: building.laundry,
      office: building.office,
    },
    roof: { kind: 'gable', pitchDeg: building.roofPitchDeg, overhang: building.roofOverhang },
    floors: building.floors.map(toFloor),
  };
}

function toFinishes(rows: ProjectRecord['finishes']): Finishes {
  const finishes: Finishes = { ...defaultFinishes };
  for (const row of rows) finishes[row.slot] = row.material.key;
  return finishes;
}

export function toProjectDto(record: ProjectRecord, materials: Material[]): Project {
  const { terrain, building } = record;
  if (!terrain || !building) throw new Error(`Proyecto ${record.id} incompleto en base de datos.`);
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    buildingType: record.buildingType,
    city: record.city,
    region: record.region,
    style: record.style,
    budget: record.budget,
    updatedAt: record.updatedAt.toISOString(),
    terrain: {
      width: terrain.width,
      length: terrain.length,
      shape: terrain.shape,
      slopePercent: terrain.slopePercent,
      elevation: terrain.elevation,
      orientation: terrain.orientation,
      accessSide: terrain.accessSide,
      latitude: terrain.latitude,
      longitude: terrain.longitude,
      soilType: terrain.soilType,
      gardenArea: terrain.gardenArea,
      parkingArea: terrain.parkingArea,
      poolArea: terrain.poolArea,
      maxCos: terrain.maxCos,
      maxCus: terrain.maxCus,
      maxFloors: terrain.maxFloors,
    },
    building: toBuildingDto(building),
    finishes: toFinishes(record.finishes),
    materials,
  };
}

export function buildingCreateData(building: Building): Prisma.BuildingCreateWithoutProjectInput {
  const { program } = building;
  return {
    setbackX: building.setbackX,
    setbackY: building.setbackY,
    roofKind: building.roof.kind,
    roofPitchDeg: building.roof.pitchDeg,
    roofOverhang: building.roof.overhang,
    programFloors: program.floors,
    bedrooms: program.bedrooms,
    bathrooms: program.bathrooms,
    kitchen: program.kitchen,
    livingRoom: program.livingRoom,
    diningRoom: program.diningRoom,
    garage: program.garage,
    terrace: program.terrace,
    balcony: program.balcony,
    garden: program.garden,
    pool: program.pool,
    laundry: program.laundry,
    office: program.office,
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

export function finishesCreateData(finishes: Finishes): Prisma.ProjectMaterialCreateWithoutProjectInput[] {
  return FINISH_SLOTS.map((slot) => ({ slot, material: { connect: { key: finishes[slot] } } }));
}
