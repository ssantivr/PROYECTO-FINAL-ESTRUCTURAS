import { z } from 'zod';
import type { Material as MaterialRecord, MaterialCategory as DbCategory } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { notFound } from '../../http/errors';
import type { Material } from '../../../../shared/types/project';

type Category = Material['category'];

const TO_DB: Record<Category, DbCategory> = {
  Estructura: 'Estructura',
  'Mampostería': 'Mamposteria',
  Acabados: 'Acabados',
  Cubierta: 'Cubierta',
  'Carpintería': 'Carpinteria',
};
const FROM_DB = Object.fromEntries(Object.entries(TO_DB).map(([k, v]) => [v, k])) as Record<DbCategory, Category>;

export const materialInputSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.enum(['Estructura', 'Mampostería', 'Acabados', 'Cubierta', 'Carpintería']),
  unit: z.string().trim().min(1).max(12),
  ratePerM2: z.number().finite().min(0),
  unitPrice: z.number().finite().min(0),
}) satisfies z.ZodType<Material>;

export const materialPatchSchema = materialInputSchema.omit({ id: true }).partial();

const toDto = (m: MaterialRecord): Material => ({
  id: m.key,
  name: m.name,
  category: FROM_DB[m.category],
  unit: m.unit,
  ratePerM2: m.ratePerM2,
  unitPrice: m.unitPrice,
});

export const materialsService = {
  async list(): Promise<Material[]> {
    const rows = await prisma.material.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return rows.map(toDto);
  },

  async get(key: string): Promise<Material> {
    const row = await prisma.material.findUnique({ where: { key } });
    if (!row) throw notFound('Material');
    return toDto(row);
  },

  async create(input: z.infer<typeof materialInputSchema>): Promise<Material> {
    const { id, category, ...rest } = input;
    return toDto(await prisma.material.create({ data: { ...rest, key: id, category: TO_DB[category] } }));
  },

  async update(key: string, patch: z.infer<typeof materialPatchSchema>): Promise<Material> {
    const { category, ...rest } = patch;
    return toDto(await prisma.material.update({
      where: { key },
      data: { ...rest, ...(category ? { category: TO_DB[category] } : {}) },
    }));
  },

  async remove(key: string): Promise<void> {
    await prisma.material.delete({ where: { key } });
  },
};
