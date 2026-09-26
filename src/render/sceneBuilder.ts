import type { FacadeSide, Floor, Opening, Project } from '../types/project';
import { elevationAt } from '../services/terrainAnalysis';
import { roofRise } from '../services/metrics';
import { faceNormal, vec, type Vec3 } from './math3d';

export type FaceLayer = 'terrain' | 'building';

export interface Face {
  points: Vec3[];
  color: readonly [number, number, number];
  layer: FaceLayer;
  normal: Vec3;
  /** Draw on top of the face it lies on (windows, doors). */
  overlay?: boolean;
}

export interface Scene {
  faces: Face[];
  center: Vec3;
  /** Used to orient building normals outward. */
  buildingCenter: Vec3;
  radius: number;
  baseLevel: number;
}

const COLORS = {
  grassLow: [58, 92, 74],
  grassHigh: [78, 112, 86],
  wall: [214, 208, 196],
  wallUpper: [196, 178, 156],
  slab: [150, 150, 146],
  roof: [120, 64, 52],
  glass: [40, 92, 130],
  door: [92, 64, 44],
} as const;

function face(points: Vec3[], color: Face['color'], layer: FaceLayer, overlay = false): Face {
  return overlay
    ? { points, color, layer, normal: faceNormal(points), overlay }
    : { points, color, layer, normal: faceNormal(points) };
}

function terrainFaces(project: Project, step = 1): Face[] {
  const { terrain } = project;
  const faces: Face[] = [];
  const maxY = elevationAt(terrain, 0, terrain.length);
  for (let x = 0; x < terrain.width; x += step) {
    for (let z = 0; z < terrain.length; z += step) {
      const x2 = Math.min(x + step, terrain.width);
      const z2 = Math.min(z + step, terrain.length);
      const p = (px: number, pz: number) => vec(px, elevationAt(terrain, px, pz), pz);
      const t = Math.max(0, Math.min(1, elevationAt(terrain, x, z) / (maxY || 1)));
      const color = COLORS.grassLow.map((c, i) => Math.round(c + ((COLORS.grassHigh[i] ?? c) - c) * t)) as [number, number, number];
      faces.push(face([p(x, z), p(x, z2), p(x2, z2), p(x2, z)], color, 'terrain'));
    }
  }
  return faces;
}

/** Axis-aligned box as 5 visible faces (no bottom), CCW seen from outside. */
function box(x: number, y: number, z: number, w: number, h: number, d: number, color: Face['color']): Face[] {
  const [x2, y2, z2] = [x + w, y + h, z + d];
  return [
    face([vec(x, y, z), vec(x, y2, z), vec(x2, y2, z), vec(x2, y, z)], color, 'building'), // front (z-)
    face([vec(x2, y, z2), vec(x2, y2, z2), vec(x, y2, z2), vec(x, y, z2)], color, 'building'), // back
    face([vec(x, y, z2), vec(x, y2, z2), vec(x, y2, z), vec(x, y, z)], color, 'building'), // left
    face([vec(x2, y, z), vec(x2, y2, z), vec(x2, y2, z2), vec(x2, y, z2)], color, 'building'), // right
    face([vec(x, y2, z), vec(x, y2, z2), vec(x2, y2, z2), vec(x2, y2, z)], COLORS.slab, 'building'), // top
  ];
}

function openingFaces(floor: Floor, origin: Vec3): Face[] {
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
    list.map((o) => face(quad(side, o), o.kind === 'door' ? COLORS.door : COLORS.glass, 'building', true)),
  );
}

function roofFaces(project: Project, origin: Vec3): Face[] {
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
  return [
    face([vec(x, y, z), vec(x, ridge, zm), vec(x2, ridge, zm), vec(x2, y, z)], COLORS.roof, 'building'),
    face([vec(x2, y, z2), vec(x2, ridge, zm), vec(x, ridge, zm), vec(x, y, z2)], COLORS.roof, 'building'),
    face([vec(wx, y, wz2), vec(wx, y + gableRise, zm), vec(wx, y, wz)], COLORS.wallUpper, 'building'),
    face([vec(wx2, y, wz), vec(wx2, y + gableRise, zm), vec(wx2, y, wz2)], COLORS.wallUpper, 'building'),
  ];
}

export function buildScene(project: Project, options: { showTerrain: boolean }): Scene {
  const { terrain, building } = project;
  const ground = building.floors[0];
  const cx = building.setbackX + (ground?.footprint.width ?? 0) / 2;
  const cz = building.setbackY + (ground?.footprint.depth ?? 0) / 2;
  const baseLevel = elevationAt(terrain, cx, cz);
  const origin = vec(building.setbackX, baseLevel, building.setbackY);

  const faces: Face[] = options.showTerrain ? terrainFaces(project) : [];
  if (ground) {
    // Foundation plinth reaching the lowest terrain point below the footprint.
    const low = Math.min(
      elevationAt(terrain, origin.x, origin.z),
      elevationAt(terrain, origin.x + ground.footprint.width, origin.z),
    );
    faces.push(...box(origin.x - 0.1, low - 0.3, origin.z - 0.1, ground.footprint.width + 0.2, baseLevel - low + 0.3, ground.footprint.depth + 0.2, COLORS.slab));
  }
  building.floors.forEach((floor, index) => {
    const color = index === 0 ? COLORS.wall : COLORS.wallUpper;
    faces.push(...box(origin.x + floor.footprint.x, baseLevel + floor.level, origin.z + floor.footprint.y, floor.footprint.width, floor.height, floor.footprint.depth, color));
    faces.push(...openingFaces(floor, origin));
  });
  faces.push(...roofFaces(project, origin));

  return {
    faces,
    center: vec(terrain.width / 2, baseLevel + 2.5, terrain.length / 2),
    buildingCenter: vec(cx, baseLevel + 2.5, cz),
    radius: Math.hypot(terrain.width, terrain.length) / 2,
    baseLevel,
  };
}
