import type { Building, BuildingType, Finishes, Project, Terrain } from '../../../../shared/types/project';
import { FINISH_SLOTS } from '../../../../shared/types/project';
import { computeMetrics } from '../../../../shared/domain/metrics';
import { FINISH_SLOT_LABEL } from '../../../../shared/i18n/es';
import { HttpError, notFound } from '../../http/errors';
import { materialsService } from '../materials/materials.service';
import { toProjectDto, type ProjectRecord } from './projects.mapper';
import { projectsRepository } from './projects.repository';
import type { ProjectInput, ProjectPatch } from './projects.schemas';

export interface ProjectSummary {
  id: string;
  name: string;
  buildingType: BuildingType;
  city: string;
  region: string;
  style: string;
  floors: number;
  rooms: number;
  builtArea: number;
  lotArea: number;
  updatedAt: string;
}

const EPS = 1e-6;

export function assertGeometry(terrain: Terrain, building: Building): void {
  const problems: string[] = [];
  const keys = new Set<string>();

  building.floors.forEach((floor, index) => {
    if (keys.has(floor.id)) problems.push(`Planta "${floor.name}": identificador duplicado "${floor.id}".`);
    keys.add(floor.id);
    const { x, y, width, depth } = floor.footprint;
    if (building.setbackX + x + width > terrain.width + EPS || building.setbackY + y + depth > terrain.length + EPS) {
      problems.push(`Planta "${floor.name}": la huella excede los límites del lote.`);
    }
    const previous = building.floors[index - 1];
    if (previous && floor.level + EPS < previous.level + previous.height) {
      problems.push(`Planta "${floor.name}": el nivel ${floor.level} se superpone con la planta inferior.`);
    }
    const roomKeys = new Set<string>();
    for (const room of floor.rooms) {
      if (roomKeys.has(room.id)) problems.push(`Espacio "${room.name}": identificador duplicado.`);
      roomKeys.add(room.id);
      if (room.x + room.width > width + EPS || room.y + room.depth > depth + EPS) {
        problems.push(`Espacio "${room.name}" (${floor.name}): fuera de la huella de la planta.`);
      }
    }
    for (const [side, openings] of Object.entries(floor.openings)) {
      const wall = side === 'front' || side === 'back' ? width : depth;
      for (const o of openings) {
        if (o.offset + o.width > wall + EPS) problems.push(`Vano en fachada ${side} (${floor.name}): excede la longitud del muro.`);
        if (o.sill + o.height > floor.height + EPS) problems.push(`Vano en fachada ${side} (${floor.name}): excede la altura de la planta.`);
      }
    }
  });

  if (building.floors.length > terrain.maxFloors) {
    problems.push(`El proyecto tiene ${building.floors.length} pisos; la norma permite ${terrain.maxFloors}.`);
  }
  const ground = building.floors[0];
  const lotArea = terrain.width * terrain.length;
  const footprint = ground ? ground.footprint.width * ground.footprint.depth : 0;
  if (footprint + terrain.gardenArea + terrain.parkingArea + terrain.poolArea > lotArea + EPS) {
    problems.push(`Construcción, jardín, estacionamiento y piscina suman más que el área del lote (${Math.round(lotArea)} m²).`);
  }
  if (problems.length) throw new HttpError(422, 'El proyecto no es geométricamente válido.', problems);
}

async function assertFinishes(finishes: Finishes): Promise<void> {
  const catalog = new Map((await materialsService.list()).map((m) => [m.id, m]));
  const problems = FINISH_SLOTS.flatMap((slot) => {
    const material = catalog.get(finishes[slot]);
    if (!material) return [`${FINISH_SLOT_LABEL[slot]}: el material "${finishes[slot]}" no existe en el catálogo.`];
    if (material.slot !== slot) return [`${FINISH_SLOT_LABEL[slot]}: "${material.name}" no es un acabado para esta superficie.`];
    return [];
  });
  if (problems.length) throw new HttpError(422, 'Selección de materiales inválida.', problems);
}

async function withMaterials(record: ProjectRecord): Promise<Project> {
  return toProjectDto(record, await materialsService.list());
}

export const projectsService = {
  async list(ownerId: string): Promise<ProjectSummary[]> {
    const records = await projectsRepository.findAll(ownerId);
    return records.map((record) => {
      const dto = toProjectDto(record, []);
      const metrics = computeMetrics(dto);
      return {
        id: dto.id,
        name: dto.name,
        buildingType: dto.buildingType,
        city: dto.city,
        region: dto.region,
        style: dto.style,
        floors: dto.building.floors.length,
        rooms: dto.building.floors.reduce((sum, f) => sum + f.rooms.length, 0),
        builtArea: metrics.builtArea,
        lotArea: metrics.lotArea,
        updatedAt: dto.updatedAt,
      };
    });
  },

  async get(ownerId: string, id: string): Promise<Project> {
    const record = await projectsRepository.findById(ownerId, id);
    if (!record) throw notFound('Proyecto');
    return withMaterials(record);
  },

  async create(ownerId: string, input: ProjectInput): Promise<Project> {
    assertGeometry(input.terrain, input.building);
    await assertFinishes(input.finishes);
    return withMaterials(await projectsRepository.create(ownerId, input));
  },

  async replace(ownerId: string, id: string, input: ProjectInput): Promise<Project> {
    await this.get(ownerId, id);
    assertGeometry(input.terrain, input.building);
    await assertFinishes(input.finishes);
    return withMaterials(await projectsRepository.replace(id, input));
  },

  async patch(ownerId: string, id: string, patch: ProjectPatch): Promise<Project> {
    await this.get(ownerId, id);
    return withMaterials(await projectsRepository.patch(id, patch));
  },

  async updateTerrain(ownerId: string, id: string, terrain: Terrain): Promise<Project> {
    const current = await this.get(ownerId, id);
    assertGeometry(terrain, current.building);
    return withMaterials(await projectsRepository.updateTerrain(id, terrain));
  },

  async updateBuilding(ownerId: string, id: string, building: Building): Promise<Project> {
    const current = await this.get(ownerId, id);
    assertGeometry(current.terrain, building);
    return withMaterials(await projectsRepository.replaceBuilding(id, building));
  },

  async updateFinishes(ownerId: string, id: string, finishes: Finishes): Promise<Project> {
    await this.get(ownerId, id);
    await assertFinishes(finishes);
    return withMaterials(await projectsRepository.replaceFinishes(id, finishes));
  },

  async remove(ownerId: string, id: string): Promise<void> {
    await this.get(ownerId, id);
    await projectsRepository.remove(id);
  },
};
