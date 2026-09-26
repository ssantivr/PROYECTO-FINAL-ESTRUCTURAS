import type { Project } from '../../../../shared/types/project';
import { computeMetrics } from '../../../../shared/domain/metrics';
import { HttpError, notFound } from '../../http/errors';
import { materialsService } from '../materials/materials.service';
import { toProjectDto } from './projects.mapper';
import { projectsRepository } from './projects.repository';
import type { ProjectInput, ProjectPatch } from './projects.schemas';

export interface ProjectSummary {
  id: string;
  name: string;
  city: string;
  region: string;
  style: string;
  floors: number;
  builtArea: number;
  lotArea: number;
  updatedAt: string;
}

const EPS = 1e-6;

/** Geometric consistency rules that a schema alone cannot express. */
function assertGeometry(input: ProjectInput): void {
  const { terrain, building } = input;
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
  if (problems.length) throw new HttpError(422, 'El proyecto no es geométricamente válido.', problems);
}

async function withMaterials(record: Parameters<typeof toProjectDto>[0]): Promise<Project> {
  return toProjectDto(record, await materialsService.list());
}

export const projectsService = {
  async list(): Promise<ProjectSummary[]> {
    const records = await projectsRepository.findAll();
    return records.map((record) => {
      const dto = toProjectDto(record, []);
      const metrics = computeMetrics(dto);
      return {
        id: dto.id,
        name: dto.name,
        city: dto.city,
        region: dto.region,
        style: dto.style,
        floors: dto.building.floors.length,
        builtArea: metrics.builtArea,
        lotArea: metrics.lotArea,
        updatedAt: dto.updatedAt,
      };
    });
  },

  async get(id: string): Promise<Project> {
    const record = await projectsRepository.findById(id);
    if (!record) throw notFound('Proyecto');
    return withMaterials(record);
  },

  async create(input: ProjectInput): Promise<Project> {
    assertGeometry(input);
    return withMaterials(await projectsRepository.create(input));
  },

  async replace(id: string, input: ProjectInput): Promise<Project> {
    assertGeometry(input);
    if (!(await projectsRepository.findById(id))) throw notFound('Proyecto');
    return withMaterials(await projectsRepository.replace(id, input));
  },

  async patch(id: string, patch: ProjectPatch): Promise<Project> {
    return withMaterials(await projectsRepository.patch(id, patch));
  },

  async updateTerrain(id: string, terrain: ProjectInput['terrain']): Promise<Project> {
    const current = await this.get(id);
    assertGeometry({ ...current, terrain });
    return withMaterials(await projectsRepository.updateTerrain(id, terrain));
  },

  remove(id: string): Promise<void> {
    return projectsRepository.remove(id);
  },
};
