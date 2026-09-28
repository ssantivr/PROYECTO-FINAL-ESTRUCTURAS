import type { FacadeSide, Floor, Material, Opening, Project, Room } from '../types/project';
import { elevationAt } from '../services/terrainAnalysis';
import { roofRise } from '../services/metrics';
import { selectedFinish } from '../services/materials';
import { siteZones } from './sitePlan';
import { faceNormal, vec, type Vec3 } from './math3d';

export type LayerId = 'terrain' | 'site' | 'walls' | 'roof' | 'doors' | 'windows' | 'furniture' | 'vegetation';

export type RGB = readonly [number, number, number];

export interface Face {
  points: Vec3[];
  color: RGB;
  layer: LayerId;
  normal: Vec3;
  shine: number;
  center: Vec3;
  overlay?: boolean;
}

export interface Scene {
  faces: Face[];
  center: Vec3;
  radius: number;
  baseLevel: number;
  interior: Vec3;
  interiorTop: number;
}

export function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [180, 180, 180];
}

const shineOf = (m: Material | undefined) => (m ? (1 - m.roughness) * (0.35 + 0.65 * m.metalness) + (1 - m.roughness) * 0.25 : 0.1);

const COLORS = {
  grassLow: [58, 92, 74],
  grassHigh: [78, 112, 86],
  slab: [150, 150, 146],
  door: [96, 66, 44],
  parking: [120, 124, 128],
  pool: [52, 150, 196],
  trunk: [92, 70, 52],
  crown: [52, 110, 70],
  furniture: [168, 150, 128],
  fabric: [70, 96, 128],
} as const satisfies Record<string, RGB>;

interface Paint {
  color: RGB;
  shine: number;
}

function face(points: Vec3[], paint: Paint, layer: LayerId, center: Vec3, overlay = false): Face {
  const base: Face = { points, color: paint.color, shine: paint.shine, layer, normal: faceNormal(points), center };
  return overlay ? { ...base, overlay } : base;
}

const matte = (color: RGB): Paint => ({ color, shine: 0.05 });

function terrainFaces(project: Project, step = 1): Face[] {
  const { terrain } = project;
  const faces: Face[] = [];
  const maxY = elevationAt(terrain, 0, terrain.length);
  const below = vec(terrain.width / 2, -100, terrain.length / 2);
  for (let x = 0; x < terrain.width; x += step) {
    for (let z = 0; z < terrain.length; z += step) {
      const x2 = Math.min(x + step, terrain.width);
      const z2 = Math.min(z + step, terrain.length);
      const p = (px: number, pz: number) => vec(px, elevationAt(terrain, px, pz), pz);
      const t = Math.max(0, Math.min(1, elevationAt(terrain, x, z) / (maxY || 1)));
      const color = COLORS.grassLow.map((c, i) => Math.round(c + ((COLORS.grassHigh[i] ?? c) - c) * t)) as unknown as RGB;
      faces.push(face([p(x, z), p(x, z2), p(x2, z2), p(x2, z)], matte(color), 'terrain', below));
    }
  }
  return faces;
}

function box(x: number, y: number, z: number, w: number, h: number, d: number, sides: Paint, top: Paint, layer: LayerId): Face[] {
  const [x2, y2, z2] = [x + w, y + h, z + d];
  const c = vec(x + w / 2, y + h / 2, z + d / 2);
  return [
    face([vec(x, y, z), vec(x, y2, z), vec(x2, y2, z), vec(x2, y, z)], sides, layer, c),
    face([vec(x2, y, z2), vec(x2, y2, z2), vec(x, y2, z2), vec(x, y, z2)], sides, layer, c),
    face([vec(x, y, z2), vec(x, y2, z2), vec(x, y2, z), vec(x, y, z)], sides, layer, c),
    face([vec(x2, y, z), vec(x2, y2, z), vec(x2, y2, z2), vec(x2, y, z2)], sides, layer, c),
    face([vec(x, y2, z), vec(x, y2, z2), vec(x2, y2, z2), vec(x2, y2, z)], top, layer, c),
  ];
}

function openingFaces(floor: Floor, origin: Vec3, glass: Paint, center: Vec3): Face[] {
  const { x, z, width, depth } = { x: origin.x + floor.footprint.x, z: origin.z + floor.footprint.y, width: floor.footprint.width, depth: floor.footprint.depth };
  const y0 = origin.y + floor.level;
  const e = 0.03;
  const quad = (side: FacadeSide, o: Opening): Vec3[] => {
    const yb = y0 + o.sill;
    const yt = yb + o.height;
    switch (side) {
      case 'front': {
        const a = x + o.offset;
        return [vec(a, yb, z - e), vec(a, yt, z - e), vec(a + o.width, yt, z - e), vec(a + o.width, yb, z - e)];
      }
      case 'back': {
        const a = x + width - o.offset;
        return [vec(a, yb, z + depth + e), vec(a, yt, z + depth + e), vec(a - o.width, yt, z + depth + e), vec(a - o.width, yb, z + depth + e)];
      }
      case 'left': {
        const a = z + depth - o.offset;
        return [vec(x - e, yb, a), vec(x - e, yt, a), vec(x - e, yt, a - o.width), vec(x - e, yb, a - o.width)];
      }
      case 'right': {
        const a = z + o.offset;
        return [vec(x + width + e, yb, a), vec(x + width + e, yt, a), vec(x + width + e, yt, a + o.width), vec(x + width + e, yb, a + o.width)];
      }
    }
  };
  return (Object.entries(floor.openings) as Array<[FacadeSide, Opening[]]>).flatMap(([side, list]) =>
    list.map((o) => o.kind === 'door'
      ? face(quad(side, o), matte(COLORS.door), 'doors', center, true)
      : face(quad(side, o), glass, 'windows', center, true)),
  );
}

function partitionFaces(floor: Floor, origin: Vec3, paint: Paint): Face[] {
  const t = 0.1;
  const y = origin.y + floor.level;
  const ox = origin.x + floor.footprint.x;
  const oz = origin.z + floor.footprint.y;
  const faces: Face[] = [];
  for (const r of floor.rooms) {
    if (r.x + r.width < floor.footprint.width - 0.01) faces.push(...box(ox + r.x + r.width - t / 2, y, oz + r.y, t, floor.height, r.depth, paint, paint, 'walls'));
    if (r.y + r.depth < floor.footprint.depth - 0.01) faces.push(...box(ox + r.x, y, oz + r.y + r.depth - t / 2, r.width, floor.height, t, paint, paint, 'walls'));
  }
  return faces;
}

function furnitureFaces(room: Room, floor: Floor, origin: Vec3): Face[] {
  const x = origin.x + floor.footprint.x + room.x;
  const z = origin.z + floor.footprint.y + room.y;
  const y = origin.y + floor.level;
  const name = room.name.toLowerCase();
  const wood = matte(COLORS.furniture);
  const fabric = matte(COLORS.fabric);
  const fits = (w: number, d: number) => room.width > w + 0.4 && room.depth > d + 0.4;
  if (/hab/.test(name) && fits(1.6, 2.1)) return box(x + room.width / 2 - 0.75, y, z + 0.3, 1.5, 0.5, 2, fabric, matte([220, 220, 214]), 'furniture');
  if (/sala|estar/.test(name) && fits(2.2, 0.9)) return box(x + 0.3, y, z + room.depth - 1.2, 2.1, 0.8, 0.85, fabric, fabric, 'furniture');
  if (/comedor/.test(name) && fits(1.6, 0.9)) return box(x + room.width / 2 - 0.8, y, z + room.depth / 2 - 0.45, 1.6, 0.75, 0.9, wood, wood, 'furniture');
  if (/cocina/.test(name) && fits(1.2, 0.6)) return box(x + 0.1, y, z + 0.1, room.width - 0.2, 0.9, 0.6, wood, matte([210, 210, 205]), 'furniture');
  if (/garaje|parqueadero/.test(name) && fits(1.8, 4.3)) return box(x + room.width / 2 - 0.9, y, z + room.depth / 2 - 2.1, 1.8, 1.4, 4.2, { color: [60, 90, 130], shine: 0.6 }, { color: [60, 90, 130], shine: 0.6 }, 'furniture');
  return [];
}

function roofFaces(project: Project, origin: Vec3, roof: Paint, gable: Paint): Face[] {
  const top = project.building.floors.at(-1);
  if (!top) return [];
  const { overhang } = project.building.roof;
  const x = origin.x + top.footprint.x - overhang;
  const x2 = origin.x + top.footprint.x + top.footprint.width + overhang;
  const z = origin.z + top.footprint.y - overhang;
  const z2 = origin.z + top.footprint.y + top.footprint.depth + overhang;
  const y = origin.y + top.level + top.height;
  const zm = (z + z2) / 2;
  const ridge = y + roofRise(project);
  const wx = origin.x + top.footprint.x;
  const wx2 = wx + top.footprint.width;
  const gableRise = (ridge - y) * (top.footprint.depth / (z2 - z));
  const wz = origin.z + top.footprint.y;
  const wz2 = wz + top.footprint.depth;
  const c = vec((wx + wx2) / 2, y, zm);
  return [
    face([vec(x, y, z), vec(x, ridge, zm), vec(x2, ridge, zm), vec(x2, y, z)], roof, 'roof', c),
    face([vec(x2, y, z2), vec(x2, ridge, zm), vec(x, ridge, zm), vec(x, y, z2)], roof, 'roof', c),
    face([vec(wx, y, wz2), vec(wx, y + gableRise, zm), vec(wx, y, wz)], gable, 'roof', c),
    face([vec(wx2, y, wz), vec(wx2, y + gableRise, zm), vec(wx2, y, wz2)], gable, 'roof', c),
  ];
}

function vegetationFaces(project: Project, yard: { x: number; y: number; width: number; depth: number }): Face[] {
  const { terrain } = project;
  if (yard.depth < 2.5 || terrain.gardenArea <= 0) return [];
  const count = Math.max(1, Math.min(8, Math.round(terrain.gardenArea / 30)));
  const faces: Face[] = [];
  for (let i = 0; i < count; i++) {
    const tx = 1 + ((i * 0.618 * terrain.width) % Math.max(1, terrain.width - 2));
    const tz = Math.min(terrain.length - 1, yard.y + 1.2 + ((i * 1.7) % Math.max(0.5, yard.depth - 2)));
    const ground = elevationAt(terrain, tx, tz);
    const height = 3 + (i % 3) * 0.7;
    faces.push(...box(tx - 0.12, ground, tz - 0.12, 0.24, height * 0.45, 0.24, matte(COLORS.trunk), matte(COLORS.trunk), 'vegetation'));
    const r = 0.9 + (i % 2) * 0.3;
    faces.push(...box(tx - r, ground + height * 0.45, tz - r, r * 2, height * 0.55, r * 2, matte(COLORS.crown), matte(COLORS.crown), 'vegetation'));
  }
  return faces;
}

function flatQuad(project: Project, zone: { x: number; y: number; width: number; depth: number }, paint: Paint): Face {
  const { terrain } = project;
  const p = (x: number, z: number) => vec(x, elevationAt(terrain, x, z) + 0.04, z);
  const { x, y: z, width: w, depth: d } = zone;
  return face([p(x, z), p(x, z + d), p(x + w, z + d), p(x + w, z)], paint, 'site', vec(x + w / 2, -100, z + d / 2), true);
}

function interiorEye(project: Project, origin: Vec3): Vec3 {
  const ground = project.building.floors[0];
  const room = ground?.rooms.reduce((a, b) => (b.width * b.depth > a.width * a.depth ? b : a));
  if (!ground || !room) return vec(origin.x, origin.y + 1.6, origin.z);
  return vec(origin.x + ground.footprint.x + room.x + room.width / 2, origin.y + 1.6, origin.z + ground.footprint.y + room.y + room.depth * 0.8);
}

export function buildScene(project: Project): Scene {
  const { terrain, building } = project;
  const ground = building.floors[0];
  const cx = building.setbackX + (ground?.footprint.width ?? 0) / 2;
  const cz = building.setbackY + (ground?.footprint.depth ?? 0) / 2;
  const baseLevel = elevationAt(terrain, cx, cz);
  const origin = vec(building.setbackX, baseLevel, building.setbackY);
  const buildingCenter = vec(cx, baseLevel + 2.5, cz);

  const wallMaterial = selectedFinish(project, 'walls');
  const walls: Paint = { color: hexToRgb(wallMaterial?.color ?? '#d6d0c4'), shine: shineOf(wallMaterial) };
  const floorMaterial = selectedFinish(project, 'floor');
  const slab: Paint = { color: hexToRgb(floorMaterial?.color ?? '#969692'), shine: shineOf(floorMaterial) };
  const roofMaterial = selectedFinish(project, 'roof');
  const roof: Paint = { color: hexToRgb(roofMaterial?.color ?? '#783f34'), shine: shineOf(roofMaterial) };
  const frameMaterial = selectedFinish(project, 'frames');
  const glass: Paint = { color: hexToRgb(frameMaterial?.color ?? '#285c82'), shine: Math.max(0.6, shineOf(frameMaterial)) };
  const partition: Paint = matte([226, 222, 214]);

  const zones = siteZones(project);
  const faces: Face[] = terrainFaces(project);
  if (zones.parking) faces.push(flatQuad(project, zones.parking, matte(COLORS.parking)));
  if (zones.pool) faces.push(flatQuad(project, zones.pool, { color: COLORS.pool, shine: 0.8 }));
  faces.push(...vegetationFaces(project, zones.backYard));

  if (ground) {
    const low = Math.min(elevationAt(terrain, origin.x, origin.z), elevationAt(terrain, origin.x + ground.footprint.width, origin.z));
    faces.push(...box(origin.x - 0.1, low - 0.3, origin.z - 0.1, ground.footprint.width + 0.2, baseLevel - low + 0.3, ground.footprint.depth + 0.2, matte(COLORS.slab), slab, 'walls'));
  }
  building.floors.forEach((floor) => {
    const fx = origin.x + floor.footprint.x;
    const fz = origin.z + floor.footprint.y;
    const y = baseLevel + floor.level;
    const { width: w, depth: d } = floor.footprint;
    const c = buildingCenter;
    faces.push(
      face([vec(fx, y, fz), vec(fx, y + floor.height, fz), vec(fx + w, y + floor.height, fz), vec(fx + w, y, fz)], walls, 'walls', c),
      face([vec(fx + w, y, fz + d), vec(fx + w, y + floor.height, fz + d), vec(fx, y + floor.height, fz + d), vec(fx, y, fz + d)], walls, 'walls', c),
      face([vec(fx, y, fz + d), vec(fx, y + floor.height, fz + d), vec(fx, y + floor.height, fz), vec(fx, y, fz)], walls, 'walls', c),
      face([vec(fx + w, y, fz), vec(fx + w, y + floor.height, fz), vec(fx + w, y + floor.height, fz + d), vec(fx + w, y, fz + d)], walls, 'walls', c),
      face([vec(fx, y + 0.02, fz), vec(fx, y + 0.02, fz + d), vec(fx + w, y + 0.02, fz + d), vec(fx + w, y + 0.02, fz)], slab, 'walls', vec(fx + w / 2, y - 10, fz + d / 2)),
    );
    faces.push(...partitionFaces(floor, origin, partition));
    faces.push(...floor.rooms.flatMap((room) => furnitureFaces(room, floor, origin)));
    faces.push(...openingFaces(floor, origin, glass, c));
  });
  const top = building.floors.at(-1);
  if (top) {
    const y = baseLevel + top.level + top.height;
    const { width: w, depth: d } = top.footprint;
    const fx = origin.x + top.footprint.x;
    const fz = origin.z + top.footprint.y;
    faces.push(face([vec(fx, y, fz), vec(fx, y, fz + d), vec(fx + w, y, fz + d), vec(fx + w, y, fz)], matte(COLORS.slab), 'roof', vec(fx + w / 2, y - 10, fz + d / 2)));
  }
  faces.push(...roofFaces(project, origin, roof, walls));

  return {
    faces,
    center: vec(terrain.width / 2, baseLevel + 2.5, terrain.length / 2),
    radius: Math.hypot(terrain.width, terrain.length) / 2,
    baseLevel,
    interior: interiorEye(project, origin),
    interiorTop: baseLevel + (ground?.height ?? 2.8),
  };
}
