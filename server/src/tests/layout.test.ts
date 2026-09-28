import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleProject } from '../../../shared/data/sampleProject';
import { generateLayout, planRoomProgram, STAIRS_NAME } from '../../../shared/domain/layoutGenerator';
import type { BuildingProgram, BuildingType, Terrain } from '../../../shared/types/project';
import { assertGeometry } from '../modules/projects/projects.service';
import { toRoomSpecs } from '../modules/ai/BuildingSuggestionService';

const baseProgram: BuildingProgram = sampleProject.building.program;
const terrain = (overrides: Partial<Terrain> = {}): Terrain => ({ ...sampleProject.terrain, gardenArea: 0, parkingArea: 0, poolArea: 0, ...overrides });

test('the generated layout passes the server geometry rules for many programs and lots', () => {
  const lots = [terrain(), terrain({ width: 10, length: 20, maxFloors: 3 }), terrain({ width: 30, length: 45, maxCos: 0.4 }), terrain({ width: 8, length: 15 })];
  const types: BuildingType[] = ['house', 'office', 'warehouse'];
  for (const lot of lots) {
    for (const buildingType of types) {
      for (const floors of [1, 2, 3]) {
        for (const bedrooms of [0, 2, 5]) {
          const program = { ...baseProgram, floors, bedrooms, garage: bedrooms > 1, terrace: floors === 1 };
          const { building } = generateLayout(lot, program, buildingType);
          assert.doesNotThrow(() => assertGeometry(lot, building), `lote ${lot.width}×${lot.length}, ${buildingType}, ${floors} pisos, ${bedrooms} hab.`);
        }
      }
    }
  }
});

test('rooms tile each floor footprint exactly', () => {
  const { building } = generateLayout(terrain(), { ...baseProgram, floors: 2, bedrooms: 4 }, 'house');
  for (const floor of building.floors) {
    const roomArea = floor.rooms.reduce((sum, r) => sum + r.width * r.depth, 0);
    assert.ok(Math.abs(roomArea - floor.footprint.width * floor.footprint.depth) < 1e-6, floor.name);
  }
});

test('multi-storey layouts align the stairs on every floor', () => {
  const { building } = generateLayout(terrain(), { ...baseProgram, floors: 3, bedrooms: 4 }, 'house');
  const stairs = building.floors.map((f) => f.rooms.find((r) => r.name === STAIRS_NAME));
  assert.equal(stairs.length, 3);
  for (const s of stairs) assert.deepEqual([s?.x, s?.width], [0, 2.6]);
});

test('the program follows the requested bedroom and bathroom counts', () => {
  const rooms = planRoomProgram({ ...baseProgram, bedrooms: 4, bathrooms: 3, floors: 2 }, 'house');
  assert.equal(rooms.filter((r) => /hab/i.test(r.name)).length, 4);
  assert.equal(rooms.filter((r) => /baño/i.test(r.name)).length, 3);
  assert.ok(rooms.every((r) => r.floor < 2));
});

test('floors above the lot limit are dropped with a warning', () => {
  const result = generateLayout(terrain({ maxFloors: 1 }), { ...baseProgram, floors: 3 }, 'house');
  assert.equal(result.building.floors.length, 1);
  assert.ok(result.warnings.some((w) => w.includes('pisos')));
});

test('AI room lists get unique keys, 0-based floors and generated stairs', () => {
  const specs = toRoomSpecs([
    { name: 'Habitación', floor: 2, area: 10, zone: 'private' },
    { name: 'Habitación', floor: 2, area: 10, zone: 'private' },
    { name: 'Escalera', floor: 1, area: 8, zone: 'circulation' },
    { name: 'Sala', floor: 1, area: 20, zone: 'social' },
  ], 2);
  const upper = specs.filter((s) => s.floor === 1 && s.name !== STAIRS_NAME);
  assert.deepEqual(upper.map((s) => s.key), ['habitacion', 'habitacion-2']);
  assert.equal(specs.filter((s) => s.name === STAIRS_NAME).length, 2);
});
