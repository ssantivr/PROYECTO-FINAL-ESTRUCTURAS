import { PrismaClient } from '@prisma/client';
import { sampleProject } from '../../shared/data/sampleProject';
import { buildingCreateData } from '../src/modules/projects/projects.mapper';

const prisma = new PrismaClient();

const CATEGORY = {
  Estructura: 'Estructura',
  'Mampostería': 'Mamposteria',
  Acabados: 'Acabados',
  Cubierta: 'Cubierta',
  'Carpintería': 'Carpinteria',
} as const;

async function main(): Promise<void> {
  for (const { id, category, ...material } of sampleProject.materials) {
    const data = { ...material, category: CATEGORY[category] };
    await prisma.material.upsert({ where: { key: id }, create: { ...data, key: id }, update: data });
  }

  const { terrain, building, name, city, region, style } = sampleProject;
  const existing = await prisma.project.findFirst({ where: { name } });
  if (existing) {
    console.log(`Proyecto de ejemplo ya existe (${existing.id}).`);
    return;
  }
  const project = await prisma.project.create({
    data: { id: sampleProject.id, name, city, region, style, terrain: { create: terrain }, building: { create: buildingCreateData(building) } },
  });
  console.log(`Proyecto de ejemplo creado: ${project.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
