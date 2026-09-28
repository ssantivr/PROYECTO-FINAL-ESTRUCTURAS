import { prisma } from '../../db/prisma';
import type { Building, Finishes, Terrain } from '../../../../shared/types/project';
import { buildingCreateData, finishesCreateData, projectInclude, type ProjectRecord } from './projects.mapper';
import type { ProjectInput, ProjectPatch } from './projects.schemas';

export const projectsRepository = {
  findAll(ownerId: string): Promise<ProjectRecord[]> {
    return prisma.project.findMany({ where: { ownerId }, include: projectInclude, orderBy: { updatedAt: 'desc' } });
  },

  findById(ownerId: string, id: string): Promise<ProjectRecord | null> {
    return prisma.project.findFirst({ where: { id, ownerId }, include: projectInclude });
  },

  create(ownerId: string, input: ProjectInput): Promise<ProjectRecord> {
    const { terrain, building, finishes, ...fields } = input;
    return prisma.project.create({
      data: {
        ...fields,
        owner: { connect: { id: ownerId } },
        terrain: { create: terrain },
        building: { create: buildingCreateData(building) },
        finishes: { create: finishesCreateData(finishes) },
      },
      include: projectInclude,
    });
  },

  replace(id: string, input: ProjectInput): Promise<ProjectRecord> {
    const { terrain, building, finishes, ...fields } = input;
    return prisma.$transaction(async (tx) => {
      await tx.building.deleteMany({ where: { projectId: id } });
      await tx.projectMaterial.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: {
          ...fields,
          terrain: { upsert: { create: terrain, update: terrain } },
          building: { create: buildingCreateData(building) },
          finishes: { create: finishesCreateData(finishes) },
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

  replaceBuilding(id: string, building: Building): Promise<ProjectRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.building.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: { building: { create: buildingCreateData(building) } },
        include: projectInclude,
      });
    });
  },

  replaceFinishes(id: string, finishes: Finishes): Promise<ProjectRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.projectMaterial.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: { finishes: { create: finishesCreateData(finishes) } },
        include: projectInclude,
      });
    });
  },

  async remove(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  },
};
