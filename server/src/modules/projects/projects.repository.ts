import { prisma } from '../../db/prisma';
import type { Terrain } from '../../../../shared/types/project';
import { buildingCreateData, projectInclude, type ProjectRecord } from './projects.mapper';
import type { ProjectInput, ProjectPatch } from './projects.schemas';

/** Data access for the project aggregate (Repository pattern). */
export const projectsRepository = {
  findAll(): Promise<ProjectRecord[]> {
    return prisma.project.findMany({ include: projectInclude, orderBy: { updatedAt: 'desc' } });
  },

  findById(id: string): Promise<ProjectRecord | null> {
    return prisma.project.findUnique({ where: { id }, include: projectInclude });
  },

  create(input: ProjectInput): Promise<ProjectRecord> {
    const { terrain, building, ...fields } = input;
    return prisma.project.create({
      data: { ...fields, terrain: { create: terrain }, building: { create: buildingCreateData(building) } },
      include: projectInclude,
    });
  },

  /** Replaces the whole aggregate atomically: the building tree is rebuilt from the payload. */
  replace(id: string, input: ProjectInput): Promise<ProjectRecord> {
    const { terrain, building, ...fields } = input;
    return prisma.$transaction(async (tx) => {
      await tx.building.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: {
          ...fields,
          terrain: { upsert: { create: terrain, update: terrain } },
          building: { create: buildingCreateData(building) },
        },
        include: projectInclude,
      });
    });
  },

  patch(id: string, patch: ProjectPatch): Promise<ProjectRecord> {
    return prisma.project.update({ where: { id }, data: patch, include: projectInclude });
  },

  updateTerrain(id: string, terrain: Terrain): Promise<ProjectRecord> {
    return prisma.project.update({
      where: { id },
      data: { terrain: { upsert: { create: terrain, update: terrain } } },
      include: projectInclude,
    });
  },

  async remove(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  },
};
