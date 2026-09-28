export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return vec(v.x / len, v.y / len, v.z / len);
}

export function faceNormal(points: readonly Vec3[]): Vec3 {
  const [a, b, c] = points;
  if (!a || !b || !c) return vec(0, 1, 0);
  return normalize(cross(sub(b, a), sub(c, a)));
}

export function centroid(points: readonly Vec3[]): Vec3 {
  const sum = points.reduce((acc, p) => vec(acc.x + p.x, acc.y + p.y, acc.z + p.z), vec(0, 0, 0));
  return vec(sum.x / points.length, sum.y / points.length, sum.z / points.length);
}

export interface OrbitCamera {
  target: Vec3;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

export function cameraPosition(camera: OrbitCamera): Vec3 {
  const { target, yaw, pitch, distance } = camera;
  return vec(
    target.x + distance * Math.cos(pitch) * Math.sin(yaw),
    target.y + distance * Math.sin(pitch),
    target.z + distance * Math.cos(pitch) * Math.cos(yaw),
  );
}

export function createProjector(camera: OrbitCamera, width: number, height: number) {
  const eye = cameraPosition(camera);
  const forward = normalize(sub(camera.target, eye));
  const right = normalize(cross(forward, vec(0, 1, 0)));
  const up = cross(right, forward);
  const focal = Math.min(width, height) / 2 / Math.tan(camera.fov / 2);

  const NEAR = 0.1;
  const toScreen = (rel: Vec3, depth: number): ScreenPoint => ({
    x: width / 2 + (dot(rel, right) * focal) / depth,
    y: height / 2 - (dot(rel, up) * focal) / depth,
    depth,
  });

  return {
    eye,
    project(p: Vec3): ScreenPoint | null {
      const rel = sub(p, eye);
      const depth = dot(rel, forward);
      return depth < NEAR ? null : toScreen(rel, depth);
    },
    projectPolygon(points: readonly Vec3[]): ScreenPoint[] | null {
      const rels = points.map((p) => sub(p, eye));
      const depths = rels.map((r) => dot(r, forward));
      const out: ScreenPoint[] = [];
      for (let i = 0; i < rels.length; i++) {
        const a = rels[i] as Vec3;
        const b = rels[(i + 1) % rels.length] as Vec3;
        const da = depths[i] as number;
        const db = depths[(i + 1) % rels.length] as number;
        if (da >= NEAR) out.push(toScreen(a, da));
        if ((da >= NEAR) !== (db >= NEAR)) {
          const t = (NEAR - da) / (db - da);
          const cut = vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
          out.push(toScreen(cut, NEAR));
        }
      }
      return out.length >= 3 ? out : null;
    },
  };
}
