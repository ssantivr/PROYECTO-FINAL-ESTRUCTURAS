import { z } from 'zod';
import type { Building, BuildingProgram, Finishes, Floor, Opening, Room, Terrain } from '../../../../shared/types/project';

const positive = z.number().finite().positive();
const nonNegative = z.number().finite().min(0);
const key = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, "-" o "_".');
const label = (max: number) => z.string().trim().min(1, 'Campo obligatorio.').max(max);

export const orientationSchema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
export const facadeSideSchema = z.enum(['front', 'back', 'left', 'right']);
export const buildingTypeSchema = z.enum(['house', 'residential', 'office', 'retail', 'warehouse', 'hotel', 'other']);
export const finishSlotSchema = z.enum(['walls', 'roof', 'floor', 'frames']);

export const terrainSchema = z.object({
  width: positive.max(500, 'El ancho máximo es 500 m.'),
  length: positive.max(500, 'El largo máximo es 500 m.'),
  shape: z.enum(['rectangular', 'corner', 'trapezoidal', 'irregular']),
  slopePercent: nonNegative.max(100, 'La pendiente máxima admitida es 100 %.'),
  elevation: z.number().finite().min(-500).max(9000),
  orientation: orientationSchema,
  accessSide: facadeSideSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  soilType: label(120),
  gardenArea: nonNegative.max(250_000),
  parkingArea: nonNegative.max(250_000),
  poolArea: nonNegative.max(250_000),
  maxCos: positive.max(1),
  maxCus: positive.max(20),
  maxFloors: z.number().int().min(1).max(100),
}) satisfies z.ZodType<Terrain>;

const rectSchema = z.object({ x: nonNegative, y: nonNegative, width: positive, depth: positive });

const roomSchema = rectSchema.extend({ id: key, name: label(80) }) satisfies z.ZodType<Room>;

const openingSchema = z.object({
  offset: nonNegative,
  width: positive,
  height: positive,
  sill: nonNegative,
  kind: z.enum(['window', 'door']),
}) satisfies z.ZodType<Opening>;

const floorSchema = z.object({
  id: key,
  name: label(80),
  level: nonNegative,
  height: positive.max(10),
  footprint: rectSchema,
  rooms: z.array(roomSchema).max(60),
  openings: z.object({
    front: z.array(openingSchema).max(40),
    back: z.array(openingSchema).max(40),
    left: z.array(openingSchema).max(40),
    right: z.array(openingSchema).max(40),
  }),
}) satisfies z.ZodType<Floor>;

export const programSchema = z.object({
  floors: z.number().int().min(1, 'Mínimo 1 piso.').max(10, 'Máximo 10 pisos en esta etapa.'),
  bedrooms: z.number().int().min(0).max(20, 'Máximo 20 habitaciones.'),
  bathrooms: z.number().int().min(1, 'Se requiere al menos un baño.').max(15, 'Máximo 15 baños.'),
  kitchen: z.boolean(),
  livingRoom: z.boolean(),
  diningRoom: z.boolean(),
  garage: z.boolean(),
  terrace: z.boolean(),
  balcony: z.boolean(),
  garden: z.boolean(),
  pool: z.boolean(),
  laundry: z.boolean(),
  office: z.boolean(),
}) satisfies z.ZodType<BuildingProgram>;

export const buildingSchema = z.object({
  setbackX: nonNegative,
  setbackY: nonNegative,
  program: programSchema,
  floors: z.array(floorSchema).min(1).max(100),
  roof: z.object({ kind: z.literal('gable'), pitchDeg: z.number().min(0).max(60), overhang: nonNegative.max(3) }),
}) satisfies z.ZodType<Building>;

export const finishesSchema = z.object({ walls: key, roof: key, floor: key, frames: key }) satisfies z.ZodType<Finishes>;

const projectFields = {
  name: label(120),
  description: z.string().trim().max(2000),
  buildingType: buildingTypeSchema,
  city: label(80),
  region: label(80),
  style: label(80),
  budget: nonNegative.max(1e13, 'Presupuesto fuera de rango.'),
};

export const projectInputSchema = z.object({
  ...projectFields,
  terrain: terrainSchema,
  building: buildingSchema,
  finishes: finishesSchema,
});

export const projectPatchSchema = z.object(projectFields).partial().refine((v) => Object.keys(v).length > 0, 'Envíe al menos un campo.');

export const idParamSchema = z.object({ id: z.string().min(1).max(40) });

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
