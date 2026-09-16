// 3D scan loading + automatic measurement extraction.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ScanKind = 'finger' | 'foot' | 'wrist' | 'head' | 'body';
export type ScanUnit = 'mm' | 'cm' | 'm' | 'in';

export const SCAN_KIND_LABEL: Record<ScanKind, string> = {
  finger: 'Finger (ring size)',
  foot: 'Foot (shoe size)',
  wrist: 'Wrist / hand',
  head: 'Head',
  body: 'Full body',
};

const UNIT_TO_MM: Record<ScanUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };

export const SUPPORTED_SCAN_EXTENSIONS = ['.stl', '.ply', '.obj', '.glb', '.gltf'];

/** Parse a scan file into a single merged (non-indexed) geometry in file units. */
export async function loadScanGeometry(file: File): Promise<THREE.BufferGeometry> {
  const name = file.name.toLowerCase();
  const ext = SUPPORTED_SCAN_EXTENSIONS.find((e) => name.endsWith(e));
  if (!ext) throw new Error(`Unsupported file type. Use ${SUPPORTED_SCAN_EXTENSIONS.join(', ')}`);

  const buffer = await file.arrayBuffer();

  if (ext === '.stl') return normalize(new STLLoader().parse(buffer));
  if (ext === '.ply') return normalize(new PLYLoader().parse(buffer));
  if (ext === '.obj') {
    const obj = new OBJLoader().parse(new TextDecoder().decode(buffer));
    return normalize(collectGeometry(obj));
  }
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  return normalize(collectGeometry(gltf.scene));
}

function collectGeometry(root: THREE.Object3D): THREE.BufferGeometry {
  const positions: number[] = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  });
  if (positions.length === 0) throw new Error('No mesh geometry found in this file');
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return out;
}

function normalize(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.computeBoundingBox();
  const pos = g.getAttribute('position');
  if (!pos || pos.count < 3) throw new Error('Scan contains no usable geometry');
  return g;
}

/** Suggest the file's unit by comparing its size to a plausible real-world size. */
export function guessUnit(geom: THREE.BufferGeometry, kind: ScanKind): ScanUnit {
  const box = geom.boundingBox ?? new THREE.Box3().setFromBufferAttribute(geom.getAttribute('position') as THREE.BufferAttribute);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const expectedMm: Record<ScanKind, number> = { finger: 60, foot: 260, wrist: 180, head: 220, body: 1700 };
  const target = expectedMm[kind];
  let best: ScanUnit = 'mm';
  let bestErr = Infinity;
  (Object.keys(UNIT_TO_MM) as ScanUnit[]).forEach((u) => {
    const err = Math.abs(Math.log((longest * UNIT_TO_MM[u]) / target));
    if (err < bestErr) { bestErr = err; best = u; }
  });
  return best;
}

/** Cross-section outline perimeter (convex hull) at `coord` along `axis`, in geometry units. */
function slicePerimeter(geom: THREE.BufferGeometry, axis: 0 | 1 | 2, coord: number): number | null {
  const pos = geom.getAttribute('position');
  const pts: [number, number][] = [];
  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  const get = (i: number, c: number) => (c === 0 ? pos.getX(i) : c === 1 ? pos.getY(i) : pos.getZ(i));

  for (let t = 0; t + 2 < pos.count; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = t + e;
      const j = t + ((e + 1) % 3);
      const vi = get(i, axis);
      const vj = get(j, axis);
      if ((vi - coord) * (vj - coord) > 0 || vi === vj) continue;
      const f = (coord - vi) / (vj - vi);
      pts.push([
        get(i, a) + f * (get(j, a) - get(i, a)),
        get(i, b) + f * (get(j, b) - get(i, b)),
      ]);
    }
  }
  if (pts.length < 3) return null;
  return hullPerimeter(pts);
}

function hullPerimeter(points: [number, number][]): number {
  const p = [...points].sort((u, v) => (u[0] - v[0]) || (u[1] - v[1]));
  const cross = (o: [number, number], u: [number, number], v: [number, number]) =>
    (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const build = (src: [number, number][]) => {
    const st: [number, number][] = [];
    for (const pt of src) {
      while (st.length >= 2 && cross(st[st.length - 2], st[st.length - 1], pt) <= 0) st.pop();
      st.push(pt);
    }
    return st;
  };
  const lower = build(p);
  const upper = build([...p].reverse());
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return 0;
  let per = 0;
  for (let i = 0; i < hull.length; i++) {
    const q = hull[(i + 1) % hull.length];
    per += Math.hypot(hull[i][0] - q[0], hull[i][1] - q[1]);
  }
  return per;
}

/** Median perimeter over a few nearby slices — resilient to noisy scan surfaces. */
function robustPerimeter(geom: THREE.BufferGeometry, axis: 0 | 1 | 2, min: number, max: number, at: number): number | null {
  const span = max - min;
  const samples: number[] = [];
  for (const off of [-0.04, -0.02, 0, 0.02, 0.04]) {
    const frac = Math.min(0.98, Math.max(0.02, at + off));
    const v = slicePerimeter(geom, axis, min + span * frac);
    if (v && v > 0) samples.push(v);
  }
  if (samples.length === 0) return null;
  samples.sort((x, y) => x - y);
  return samples[Math.floor(samples.length / 2)];
}

export type ScanMeasurements = Partial<{
  ring_diameter_mm: number;
  foot_length_mm: number;
  foot_width_mm: number;
  shoe_size_eu: number;
  height_cm: number;
  chest_cm: number;
  waist_cm: number;
  hip_cm: number;
  wrist_cm: number;
  head_cm: number;
}>;

export type ScanResult = {
  measurements: ScanMeasurements;
  triangles: number;
  bboxMm: { x: number; y: number; z: number };
  warnings: string[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Derive measurements from a loaded scan. `unit` states what one geometry unit means. */
export function measureScan(geom: THREE.BufferGeometry, kind: ScanKind, unit: ScanUnit): ScanResult {
  const scale = UNIT_TO_MM[unit];
  const pos = geom.getAttribute('position');
  const box = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute);
  const size = box.getSize(new THREE.Vector3());
  const dims: { axis: 0 | 1 | 2; len: number }[] = [
    { axis: 0, len: size.x }, { axis: 1, len: size.y }, { axis: 2, len: size.z },
  ].sort((a, b) => b.len - a.len) as any;

  const warnings: string[] = [];
  const measurements: ScanMeasurements = {};
  const mm = (v: number) => v * scale;
  const cm = (v: number) => (v * scale) / 10;
  const minOf = (axis: 0 | 1 | 2) => (axis === 0 ? box.min.x : axis === 1 ? box.min.y : box.min.z);
  const maxOf = (axis: 0 | 1 | 2) => (axis === 0 ? box.max.x : axis === 1 ? box.max.y : box.max.z);

  const circ = (axis: 0 | 1 | 2, at: number) => robustPerimeter(geom, axis, minOf(axis), maxOf(axis), at);

  if (kind === 'finger') {
    const axis = dims[0].axis; // finger runs along its longest axis
    const per = circ(axis, 0.5);
    if (per) measurements.ring_diameter_mm = r2(mm(per) / Math.PI);
    else warnings.push('Could not read a finger cross-section — check the scan is a closed surface.');
  }

  if (kind === 'foot') {
    const length = dims[0].len;
    const width = dims[1].len;
    measurements.foot_length_mm = r2(mm(length));
    measurements.foot_width_mm = r2(mm(width));
    measurements.shoe_size_eu = r2(1.5 * (mm(length) / 10 + 1.5));
  }

  if (kind === 'wrist') {
    const axis = dims[0].axis;
    const per = circ(axis, 0.15); // narrowest part sits near the wrist end
    if (per) measurements.wrist_cm = r2(cm(per));
    else warnings.push('Could not read a wrist cross-section.');
  }

  if (kind === 'head') {
    const axis = dims[0].axis;
    const per = circ(axis, 0.55);
    if (per) measurements.head_cm = r2(cm(per));
    else warnings.push('Could not read a head cross-section.');
  }

  if (kind === 'body') {
    const axis = dims[0].axis; // height axis
    measurements.height_cm = r2(cm(dims[0].len));
    const chest = circ(axis, 0.72);
    const waist = circ(axis, 0.62);
    const hip = circ(axis, 0.52);
    if (chest) measurements.chest_cm = r2(cm(chest));
    if (waist) measurements.waist_cm = r2(cm(waist));
    if (hip) measurements.hip_cm = r2(cm(hip));
    if (!chest || !waist || !hip) warnings.push('Some body cross-sections could not be read.');
    warnings.push('Body circumferences are estimated from standard proportions — review before saving.');
  }

  if (Object.keys(measurements).length === 0) {
    warnings.push('No measurements could be extracted from this scan.');
  }

  return {
    measurements,
    triangles: Math.floor(pos.count / 3),
    bboxMm: { x: r2(mm(size.x)), y: r2(mm(size.y)), z: r2(mm(size.z)) },
    warnings,
  };
}
