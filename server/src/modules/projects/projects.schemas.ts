import { z } from 'zod';
import type { Building, Floor, Opening, Room, Terrain } from '../../../../shared/types/project';

const positive = z.number().finite().positive();
const nonNegative = z.number().finite().min(0);
const key = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, "-" o "_".');
const label = (max: number) => z.string().trim().min(1, 'Campo obligatorio.').max(max);

export const orientationSchema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

export const terrainSchema = z.object({
  width: positive.max(500),
  length: positive.max(500),
  slopePercent: nonNegative.max(100),
  elevation: z.number().finite().min(-500).max(9000),
  orientation: orientationSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  soilType: label(120),
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
    front: z.array(openingSchema),
    back: z.array(openingSchema),
    left: z.array(openingSchema),
    right: z.array(openingSchema),
  }),
}) satisfies z.ZodType<Floor>;

export const buildingSchema = z.object({
  setbackX: nonNegative,
  setbackY: nonNegative,
  floors: z.array(floorSchema).min(1).max(100),
  roof: z.object({ kind: z.literal('gable'), pitchDeg: z.number().min(0).max(60), overhang: nonNegative.max(3) }),
}) satisfies z.ZodType<Building>;

const projectFields = {
  name: label(120),
  city: label(80),
  region: label(80),
  style: label(80),
};

/** Full project payload (create or replace). `id`, `updatedAt` and `materials` are server-owned. */
export const projectInputSchema = z.object({
  ...projectFields,
  terrain: terrainSchema,
  building: buildingSchema,
});

export const projectPatchSchema = z.object(projectFields).partial().refine((v) => Object.keys(v).length > 0, 'Envíe al menos un campo.');

export const idParamSchema = z.object({ id: z.string().min(1).max(40) });

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
