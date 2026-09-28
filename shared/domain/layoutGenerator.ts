import type { Building, BuildingProgram, BuildingType, FacadeSide, Floor, Opening, Room, Terrain } from '../types/project';

export type RoomZone = 'social' | 'private' | 'service' | 'circulation';

export interface RoomSpec {
  key: string;
  name: string;
  floor: number;
  area: number;
  zone: RoomZone;
}

export interface LayoutResult {
  building: Building;
  rooms: RoomSpec[];
  warnings: string[];
}

export const STAIRS_NAME = 'Escalera';
const STAIRS_WIDTH = 2.6;
const GROUND_HEIGHT = 2.8;
const UPPER_HEIGHT = 2.7;
const MIN_DEPTH = 6;

const round = (value: number, step = 0.05) => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const COMMERCIAL: readonly BuildingType[] = ['office', 'retail', 'warehouse'];

export function planRoomProgram(program: BuildingProgram, buildingType: BuildingType, maxFloors = 10): RoomSpec[] {
  const floors = clamp(Math.round(program.floors), 1, maxFloors);
  const load = Array.from({ length: floors }, () => 0);
  const upper = (area: number): number => {
    if (floors === 1) return 0;
    let best = 1;
    for (let f = 2; f < floors; f++) if ((load[f] ?? 0) < (load[best] ?? 0)) best = f;
    load[best] = (load[best] ?? 0) + area;
    return best;
  };
  const rooms: RoomSpec[] = [];
  const add = (key: string, name: string, floor: number, area: number, zone: RoomZone) => rooms.push({ key, name, floor, area, zone });

  if (COMMERCIAL.includes(buildingType)) {
    const main = { office: 'Oficina abierta', retail: 'Área de ventas', warehouse: 'Área de almacenamiento' }[buildingType as 'office' | 'retail' | 'warehouse'];
    add('reception', 'Recepción', 0, 12, 'social');
    add('main', main, 0, buildingType === 'warehouse' ? 60 : 36, 'social');
    for (let i = 0; i < Math.max(0, program.bedrooms); i++) add(`office-${i + 1}`, `Oficina ${i + 1}`, upper(12), 12, 'private');
    if (program.office) add('meeting', 'Sala de juntas', upper(16), 16, 'private');
    if (program.kitchen) add('kitchenette', 'Cocineta', 0, 7, 'service');
    for (let i = 0; i < Math.max(1, program.bathrooms); i++) add(`bath-${i + 1}`, `Baño ${i + 1}`, i === 0 ? 0 : upper(4.5), 4.5, 'service');
    if (program.garage) add('garage', 'Parqueadero', 0, 18, 'service');
    if (program.laundry) add('storage', 'Depósito', 0, 6, 'service');
    if (program.terrace) add('terrace', 'Terraza', floors > 1 ? floors - 1 : 0, 12, 'social');
  } else {
    if (program.livingRoom) add('living', 'Sala', 0, 20, 'social');
    if (program.diningRoom) add('dining', 'Comedor', 0, 12, 'social');
    if (program.kitchen) add('kitchen', 'Cocina', 0, 11, 'service');
    if (program.garage) add('garage', 'Garaje', 0, 18, 'service');
    if (program.office) add('study', 'Estudio', 0, 9, 'private');
    if (program.laundry) add('laundry', 'Lavandería', 0, 5, 'service');
    if (program.terrace) add('terrace', 'Terraza', 0, 12, 'social');
    add('hall', 'Hall', 0, 5, 'circulation');

    const bedrooms = Math.max(0, Math.round(program.bedrooms));
    for (let i = 0; i < bedrooms; i++) {
      add(i === 0 ? 'master' : `bed-${i + 1}`, i === 0 ? 'Hab. principal' : `Habitación ${i + 1}`, upper(i === 0 ? 14 : 10.5), i === 0 ? 14 : 10.5, 'private');
    }
    const bathrooms = Math.max(1, Math.round(program.bathrooms));
    add('wc', floors > 1 ? 'Baño social' : 'Baño', 0, 4, 'service');
    for (let i = 1; i < bathrooms; i++) add(i === 1 && bedrooms > 0 ? 'master-bath' : `bath-${i + 1}`, i === 1 && bedrooms > 0 ? 'Baño ppal.' : `Baño ${i + 1}`, upper(i === 1 ? 5.5 : 4.5), i === 1 ? 5.5 : 4.5, 'service');
    if (floors > 1 && bedrooms >= 3) add('family', 'Estar íntimo', 1, 10, 'social');
    if (program.balcony) add('balcony', 'Balcón', floors > 1 ? 1 : 0, 5, 'social');
  }

  if (floors > 1) {
    for (let f = 0; f < floors; f++) add(f === 0 ? 'stairs' : `stairs-${f}`, STAIRS_NAME, f, STAIRS_WIDTH * 3.5, 'circulation');
  }
  return rooms;
}

const ZONE_ORDER: Record<RoomZone, number> = { social: 0, private: 1, service: 2, circulation: 3 };

interface Band {
  rooms: RoomSpec[];
  area: number;
}

function splitBands(specs: RoomSpec[]): [Band, Band] {
  const stairs = specs.filter((r) => r.name === STAIRS_NAME);
  const others = specs.filter((r) => r.name !== STAIRS_NAME).sort((a, b) => ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone]);
  const total = specs.reduce((sum, r) => sum + r.area, 0);
  const front: RoomSpec[] = [];
  let frontArea = 0;
  for (const room of others) {
    if (front.length > 0 && frontArea + room.area / 2 > total / 2) break;
    front.push(room);
    frontArea += room.area;
  }
  const back = [...stairs, ...others.slice(front.length)];
  return [
    { rooms: front, area: frontArea },
    { rooms: back, area: back.reduce((sum, r) => sum + r.area, 0) },
  ];
}

function layBand(band: Band, width: number, y: number, depth: number): Room[] {
  const stairs = band.rooms.find((r) => r.name === STAIRS_NAME);
  const flexible = band.rooms.filter((r) => r !== stairs);
  const flexArea = flexible.reduce((sum, r) => sum + r.area, 0);
  const flexWidth = width - (stairs ? STAIRS_WIDTH : 0);
  const rooms: Room[] = [];
  let x = 0;
  if (stairs) {
    rooms.push({ id: stairs.key, name: stairs.name, x: 0, y, width: flexible.length ? STAIRS_WIDTH : width, depth });
    x = STAIRS_WIDTH;
  }
  flexible.forEach((spec, index) => {
    const last = index === flexible.length - 1;
    const w = last ? width - x : round((flexWidth * spec.area) / flexArea);
    rooms.push({ id: spec.key, name: spec.name, x, y, width: w, depth });
    x += w;
  });
  return rooms;
}

const WET = /baño|lavander|cocineta|depósito/i;

function windowFor(room: Room, along: number, floorHeight: number): Opening | null {
  if (along < 1.2) return null;
  const small = WET.test(room.name) || room.name === STAIRS_NAME;
  const width = small ? Math.min(0.9, round(along * 0.6, 0.1)) : clamp(round(along * 0.45, 0.1), 0.8, 2.4);
  const sill = small ? 1.5 : 0.9;
  const height = Math.min(small ? 0.7 : 1.3, floorHeight - sill - 0.2);
  return { kind: 'window', width, height, sill, offset: 0 };
}

function centered(opening: Opening | null, start: number, span: number): Opening[] {
  return opening ? [{ ...opening, offset: round(start + (span - opening.width) / 2, 0.01) }] : [];
}

function openingsFor(front: Room[], back: Room[], width: number, depth: number, height: number, ground: boolean): Record<FacadeSide, Opening[]> {
  const openings: Record<FacadeSide, Opening[]> = { front: [], back: [], left: [], right: [] };
  let mainDoor = false;

  for (const room of front) {
    if (ground && /garaje|parqueadero/i.test(room.name) && room.width >= 2.4) {
      openings.front.push(...centered({ kind: 'door', width: Math.min(2.8, room.width - 0.4), height: 2.2, sill: 0, offset: 0 }, room.x, room.width));
    } else if (ground && !mainDoor && /sala|recepción|hall|ventas/i.test(room.name) && room.width >= 2.6) {
      openings.front.push({ kind: 'door', width: 1, height: 2.2, sill: 0, offset: round(room.x + 0.4, 0.01) });
      openings.front.push(...centered(windowFor(room, room.width - 1.8, height), room.x + 1.6, room.width - 1.6));
      mainDoor = true;
    } else {
      openings.front.push(...centered(windowFor(room, room.width, height), room.x, room.width));
    }
  }
  const first = front[0];
  if (ground && !mainDoor && first && first.width >= 1.4) {
    const door: Opening = { kind: 'door', width: 1, height: 2.2, sill: 0, offset: round(first.x + 0.2, 0.01) };
    openings.front = [door, ...openings.front.filter((o) => o.offset >= door.offset + door.width + 0.1 || o.offset + o.width <= door.offset - 0.1)];
  }

  let serviceDoor = !ground;
  for (const room of back) {
    const start = width - room.x - room.width;
    if (!serviceDoor && /cocina|lavander|hall/i.test(room.name) && room.width >= 1.4) {
      openings.back.push(...centered({ kind: 'door', width: 0.9, height: 2.1, sill: 0, offset: 0 }, start, room.width));
      serviceDoor = true;
    } else {
      openings.back.push(...centered(windowFor(room, room.width, height), start, room.width));
    }
  }

  for (const band of [front, back]) {
    const left = band.find((r) => r.x < 1e-6 && r.name !== STAIRS_NAME);
    const right = band.at(-1);
    if (left) openings.left.push(...centered(windowFor(left, left.depth, height), depth - left.y - left.depth, left.depth));
    if (right && right !== left && right.name !== STAIRS_NAME) openings.right.push(...centered(windowFor(right, right.depth, height), right.y, right.depth));
  }
  return openings;
}

function floorName(index: number, count: number): string {
  if (index === 0) return 'Planta Baja';
  if (count === 2) return 'Planta Alta';
  return `Piso ${index + 1}`;
}

export function packLayout(terrain: Terrain, program: BuildingProgram, specs: RoomSpec[]): LayoutResult {
  const warnings: string[] = [];
  const requested = Math.max(1, program.floors, ...specs.map((r) => r.floor + 1));
  const floorCount = Math.min(requested, terrain.maxFloors, Math.max(1, ...specs.map((r) => r.floor + 1)));
  if (requested > terrain.maxFloors) warnings.push(`Se solicitaron ${requested} pisos; la norma del lote permite ${terrain.maxFloors}. La distribución se ajustó a ${floorCount}.`);
  const usable = specs.filter((r) => r.floor < floorCount);

  const lotArea = terrain.width * terrain.length;
  const side = terrain.width >= 12 ? 1 : 0.5;
  const frontSetback = clamp(round(terrain.length * 0.2, 0.5), 2, 5);
  const backSetback = clamp(round(terrain.length * 0.15, 0.5), 2, 6);
  const maxWidth = terrain.width - side * 2;
  const maxDepth = terrain.length - frontSetback - backSetback;

  const areaByFloor = Array.from({ length: floorCount }, (_, f) => usable.filter((r) => r.floor === f).reduce((sum, r) => sum + r.area, 0));
  let footprint = Math.max(...areaByFloor, 30);
  const cosLimit = terrain.maxCos * lotArea;
  const cusLimit = (terrain.maxCus * lotArea) / floorCount;
  const limit = Math.min(cosLimit, cusLimit, maxWidth * maxDepth);
  if (footprint > limit) {
    warnings.push(`El programa requiere ${Math.round(footprint)} m² por piso, pero el lote admite ${Math.round(limit)} m² (retiros, COS y CUS). Los espacios se redujeron proporcionalmente.`);
    footprint = limit;
  }

  let width = Math.min(maxWidth, Math.max(Math.sqrt(footprint * 1.6), MIN_DEPTH));
  let depth = footprint / width;
  if (depth > maxDepth) {
    depth = maxDepth;
    width = Math.min(maxWidth, footprint / depth);
  }
  width = round(width, 0.1);
  depth = round(Math.max(Math.min(depth, maxDepth), Math.min(MIN_DEPTH, maxDepth)), 0.1);

  let level = 0;
  const floors: Floor[] = [];
  for (let f = 0; f < floorCount; f++) {
    const specsOnFloor = usable.filter((r) => r.floor === f);
    const deficit = footprint - (areaByFloor[f] ?? 0);
    if (specsOnFloor.length && deficit > 6) {
      specsOnFloor.push({ key: `flex-${f}`, name: f === 0 ? 'Estar' : 'Espacio flexible', floor: f, area: deficit, zone: 'social' });
    }
    const height = f === 0 ? GROUND_HEIGHT : UPPER_HEIGHT;
    const [front, back] = splitBands(specsOnFloor.length ? specsOnFloor : [{ key: `open-${f}`, name: 'Espacio libre', floor: f, area: 20, zone: 'social' }]);
    const total = front.area + back.area;
    const frontDepth = back.rooms.length ? round(clamp((depth * front.area) / total, 2.5, depth - 2.5)) : depth;
    const frontRooms = layBand(front, width, 0, frontDepth);
    const backRooms = back.rooms.length ? layBand(back, width, frontDepth, depth - frontDepth) : [];
    floors.push({
      id: f === 0 ? 'ground' : floorCount === 2 ? 'upper' : `level-${f}`,
      name: floorName(f, floorCount),
      level: round(level, 0.01),
      height,
      footprint: { x: 0, y: 0, width, depth },
      rooms: [...frontRooms, ...backRooms],
      openings: openingsFor(frontRooms, backRooms, width, depth, height, f === 0),
    });
    level += height;
  }

  return {
    building: {
      setbackX: round((terrain.width - width) / 2, 0.05),
      setbackY: frontSetback,
      program: { ...program, floors: floorCount },
      floors,
      roof: { kind: 'gable', pitchDeg: 22, overhang: 0.6 },
    },
    rooms: usable,
    warnings,
  };
}

export function generateLayout(terrain: Terrain, program: BuildingProgram, buildingType: BuildingType): LayoutResult {
  return packLayout(terrain, program, planRoomProgram(program, buildingType, terrain.maxFloors));
}

export function describeRooms(building: Building): RoomSpec[] {
  return building.floors.flatMap((floor, index) =>
    floor.rooms.map((room) => ({
      key: room.id,
      name: room.name,
      floor: index,
      area: Math.round(room.width * room.depth * 10) / 10,
      zone: room.name === STAIRS_NAME || room.name === 'Hall' ? 'circulation' : WET.test(room.name) || /cocina|garaje/i.test(room.name) ? 'service' : /hab|estudio|oficina/i.test(room.name) ? 'private' : 'social',
    })));
}
