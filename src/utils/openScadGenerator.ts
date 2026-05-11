/**
 * Generate OpenSCAD source for a terrain heightmap.
 *
 * The output includes:
 *   - a heightmap data array (downscaled for editability)
 *   - module terrain_solid()       — full polyhedron with base
 *   - module terrain_stratoconception(layers, kerf) — sliced layers for laser-cut wood
 *   - module terrain_voxelized(voxel) — voxelized stepped-block style
 *
 * Users can then tweak parameters in OpenSCAD for different fabrication processes.
 */
export function generateTerrainOpenSCAD(opts: {
  heightData: Float32Array;
  width: number;
  height: number;
  minElev: number;
  maxElev: number;
  longSideMm: number;
  baseHeightMm: number;
  areaKm: number;
  zExaggeration: number;
  lat: number;
  lon: number;
  maxGrid?: number;
}): string {
  const { heightData, width, height, minElev, maxElev,
    longSideMm, baseHeightMm, areaKm, zExaggeration, lat, lon } = opts;
  const maxGrid = opts.maxGrid ?? 80;

  // Downsample
  const stepX = Math.max(1, Math.floor(width / maxGrid));
  const stepY = Math.max(1, Math.floor(height / maxGrid));
  const gw = Math.floor(width / stepX);
  const gh = Math.floor(height / stepY);

  const elevRange = maxElev - minElev || 1;
  // Physical Z scale (mm) consistent with TerrainGenerator.tsx mapping
  const heightScaleMm = (elevRange / (areaKm * 1000)) * longSideMm * zExaggeration;

  const rows: string[] = [];
  for (let iy = 0; iy < gh; iy++) {
    const cells: string[] = [];
    for (let ix = 0; ix < gw; ix++) {
      const sx = Math.min(width - 1, ix * stepX);
      const sy = Math.min(height - 1, iy * stepY);
      const h = heightData[sy * width + sx];
      const norm = (h - minElev) / elevRange;
      cells.push((norm * heightScaleMm).toFixed(3));
    }
    rows.push('  [' + cells.join(', ') + ']');
  }

  const cellMm = longSideMm / (gw - 1);

  return `// =============================================================
// 0K3D.print — Terrain Scale Model
// Generated for lat=${lat.toFixed(4)} lon=${lon.toFixed(4)}
// Area: ${areaKm} km   Size: ${longSideMm} x ${longSideMm} mm
// Elevation: ${minElev.toFixed(0)} m → ${maxElev.toFixed(0)} m
// Grid: ${gw} x ${gh}   Z-exaggeration: ${zExaggeration}x
// =============================================================
//
// Adjust the parameters below and uncomment a module call to
// switch between fabrication strategies:
//   - terrain_solid()           : continuous solid (FDM / SLA / CNC)
//   - terrain_stratoconception(): sliced horizontal layers (laser-cut plywood)
//   - terrain_voxelized()       : voxel/stepped-block style
//
// =============================================================

// ---------- Parameters ----------
size_mm        = ${longSideMm};       // long side in mm
base_mm        = ${baseHeightMm};     // base plate thickness
cell_mm        = ${cellMm.toFixed(4)};   // distance between grid samples
strato_layers  = 12;        // number of plywood plies
strato_kerf    = 0.2;       // laser kerf compensation per layer (mm)
voxel_mm       = 3.0;       // voxel edge length

// ---------- Heightmap (mm, relative to base top) ----------
heights = [
${rows.join(',\n')}
];

gw = len(heights[0]);
gh = len(heights);

// ---------- Module: solid terrain ----------
module terrain_solid() {
  // Base plate
  translate([0, 0, 0]) cube([size_mm, size_mm, base_mm]);
  // Top surface as polyhedron column grid
  for (y = [0 : gh - 2])
    for (x = [0 : gw - 2]) {
      h00 = heights[y][x];
      h10 = heights[y][x + 1];
      h01 = heights[y + 1][x];
      h11 = heights[y + 1][x + 1];
      hmax = max(h00, h10, h01, h11);
      translate([x * cell_mm, y * cell_mm, base_mm])
        polyhedron(
          points = [
            [0, 0, 0], [cell_mm, 0, 0], [cell_mm, cell_mm, 0], [0, cell_mm, 0],
            [0, 0, h00], [cell_mm, 0, h10], [cell_mm, cell_mm, h11], [0, cell_mm, h01]
          ],
          faces = [
            [0,1,2,3], [4,5,1,0], [5,6,2,1],
            [6,7,3,2], [7,4,0,3], [7,6,5,4]
          ]
        );
    }
}

// ---------- Module: stratoconception (laser-cut layers) ----------
// Each layer = a 2D contour at a discrete elevation, extruded by ply thickness.
// Stack them or laser-cut & glue physically. Use projection() in 2D view to export DXF/SVG per layer.
module terrain_stratoconception(layers = strato_layers, kerf = strato_kerf) {
  hmax = max([for (row = heights) max(row)]);
  ply  = (hmax + base_mm) / layers;
  for (i = [0 : layers - 1]) {
    z_threshold = i * ply;
    translate([0, 0, i * ply])
      linear_extrude(height = ply)
        offset(delta = -kerf)
          projection(cut = false)
            intersection() {
              terrain_solid();
              translate([-1, -1, z_threshold])
                cube([size_mm + 2, size_mm + 2, ply]);
            }
  }
}

// Helper: export a single ply contour (run with: openscad -o ply_3.svg -D 'render_ply=3' file.scad)
module strato_ply(index) {
  hmax = max([for (row = heights) max(row)]);
  ply  = (hmax + base_mm) / strato_layers;
  z_threshold = index * ply;
  offset(delta = -strato_kerf)
    projection(cut = false)
      intersection() {
        terrain_solid();
        translate([-1, -1, z_threshold])
          cube([size_mm + 2, size_mm + 2, ply]);
      }
}

// ---------- Module: voxelized terrain ----------
module terrain_voxelized(voxel = voxel_mm) {
  nx = floor(size_mm / voxel);
  ny = floor(size_mm / voxel);
  for (y = [0 : ny - 1])
    for (x = [0 : nx - 1]) {
      // Sample nearest grid cell
      gx = floor(x * voxel / cell_mm);
      gy = floor(y * voxel / cell_mm);
      h  = heights[min(gy, gh - 1)][min(gx, gw - 1)];
      // Quantize height to voxel steps
      hv = round((h + base_mm) / voxel) * voxel;
      if (hv > 0)
        translate([x * voxel, y * voxel, 0])
          cube([voxel, voxel, hv]);
    }
}

// ---------- Render ----------
// Pick one:
terrain_solid();
// terrain_stratoconception();
// terrain_voxelized();
// strato_ply(3);  // export single layer for laser cutting (use 2D projection)
`;
}
