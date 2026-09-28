import { PrismaClient } from '@prisma/client';
import { sampleProject } from '../../shared/data/sampleProject';
import { materialCatalog } from '../../shared/data/materialCatalog';
import { buildingCreateData, finishesCreateData } from '../src/modules/projects/projects.mapper';
import { toDbCategory } from '../src/modules/materials/materials.service';
import { hashPassword } from '../src/modules/auth/password';

const prisma = new PrismaClient();

export const DEMO_USER = { email: 'demo@arquila.co', name: 'Usuario Demo', password: 'arquila2026' };

async function main(): Promise<void> {
  for (const { id, category, ...material } of materialCatalog) {
    const data = { ...material, category: toDbCategory(category) };
    await prisma.material.upsert({ where: { key: id }, create: { ...data, key: id }, update: data });
  }
  console.log(`Catálogo: ${materialCatalog.length} materiales.`);

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash: await hashPassword(DEMO_USER.password) },
    update: {},
  });
  console.log(`Usuario demo: ${DEMO_USER.email} / ${DEMO_USER.password}`);

  const adopted = await prisma.project.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } });
  if (adopted.count) console.log(`${adopted.count} proyecto(s) sin dueño asignados al usuario demo.`);

  const { terrain, building, finishes, name, description, buildingType, city, region, style, budget } = sampleProject;
  const existing = await prisma.project.findFirst({ where: { name, ownerId: user.id }, include: { finishes: true } });
  if (existing) {
    await prisma.project.update({
      where: { id: existing.id },
      data: {
        description, buildingType, budget,
        terrain: { update: terrain },
        building: { update: { programFloors: building.program.floors, ...withoutFloors(building.program) } },
        ...(existing.finishes.length ? {} : { finishes: { create: finishesCreateData(finishes) } }),
      },
    });
    console.log(`Proyecto demo actualizado (${existing.id}).`);
    return;
  }
  const project = await prisma.project.create({
    data: {
      id: sampleProject.id,
      name, description, buildingType, city, region, style, budget,
      owner: { connect: { id: user.id } },
      terrain: { create: terrain },
      building: { create: buildingCreateData(building) },
      finishes: { create: finishesCreateData(finishes) },
    },
  });
  console.log(`Proyecto demo creado: ${project.name} (${project.id}).`);
}

function withoutFloors({ floors: _floors, ...rest }: typeof sampleProject.building.program) {
  return rest;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
