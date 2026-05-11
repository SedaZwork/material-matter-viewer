import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';

/**
 * Export a THREE.Mesh as a 3MF file with per-triangle color data
 * (using the 3MF Materials Extension: m:colorgroup).
 *
 * Compatible with PrusaSlicer, Bambu Studio, Cura (color extension support varies).
 */
export function exportMeshAs3MF(mesh: THREE.Mesh): Blob {
  const geom = mesh.geometry.clone();
  // Apply mesh world transform so the export is correctly oriented & scaled
  mesh.updateMatrixWorld(true);
  geom.applyMatrix4(mesh.matrixWorld);

  const posAttr = geom.attributes.position as THREE.BufferAttribute;
  const colorAttr = geom.attributes.color as THREE.BufferAttribute | undefined;
  const index = geom.index;

  const vertexCount = posAttr.count;
  const triCount = index ? index.count / 3 : vertexCount / 3;

  // Build unique color palette (quantized to 8-bit) and per-triangle index
  const palette: string[] = [];
  const paletteMap = new Map<string, number>();
  const triColorIdx: number[] = [];

  const getColorHex = (vi: number): string => {
    if (!colorAttr) return 'FF888888';
    const r = Math.round(Math.max(0, Math.min(1, colorAttr.getX(vi))) * 255);
    const g = Math.round(Math.max(0, Math.min(1, colorAttr.getY(vi))) * 255);
    const b = Math.round(Math.max(0, Math.min(1, colorAttr.getZ(vi))) * 255);
    return (
      'FF' +
      r.toString(16).padStart(2, '0').toUpperCase() +
      g.toString(16).padStart(2, '0').toUpperCase() +
      b.toString(16).padStart(2, '0').toUpperCase()
    );
  };

  // Vertices XML
  let verticesXML = '';
  for (let i = 0; i < vertexCount; i++) {
    verticesXML += `<vertex x="${posAttr.getX(i).toFixed(6)}" y="${posAttr.getY(i).toFixed(6)}" z="${posAttr.getZ(i).toFixed(6)}"/>`;
  }

  // Triangles XML — average the 3 vertex colors per triangle
  let trianglesXML = '';
  for (let t = 0; t < triCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    // Average color of triangle
    let avgHex = 'FF888888';
    if (colorAttr) {
      const r = (colorAttr.getX(a) + colorAttr.getX(b) + colorAttr.getX(c)) / 3;
      const g = (colorAttr.getY(a) + colorAttr.getY(b) + colorAttr.getY(c)) / 3;
      const bl = (colorAttr.getZ(a) + colorAttr.getZ(b) + colorAttr.getZ(c)) / 3;
      const rh = Math.round(Math.max(0, Math.min(1, r)) * 255);
      const gh = Math.round(Math.max(0, Math.min(1, g)) * 255);
      const bh = Math.round(Math.max(0, Math.min(1, bl)) * 255);
      avgHex =
        'FF' +
        rh.toString(16).padStart(2, '0').toUpperCase() +
        gh.toString(16).padStart(2, '0').toUpperCase() +
        bh.toString(16).padStart(2, '0').toUpperCase();
    }

    let pIdx = paletteMap.get(avgHex);
    if (pIdx === undefined) {
      pIdx = palette.length;
      palette.push(avgHex);
      paletteMap.set(avgHex, pIdx);
    }
    triColorIdx.push(pIdx);

    trianglesXML += `<triangle v1="${a}" v2="${b}" v3="${c}" p1="${pIdx}"/>`;
  }

  // Color group resource (id=1)
  const colorGroupXML =
    `<m:colorgroup id="1">` +
    palette.map((c) => `<m:color color="#${c}"/>`).join('') +
    `</m:colorgroup>`;

  const objectXML =
    `<object id="2" type="model" pid="1" pindex="0">` +
    `<mesh>` +
    `<vertices>${verticesXML}</vertices>` +
    `<triangles>${trianglesXML}</triangles>` +
    `</mesh>` +
    `</object>`;

  const modelXML =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US"` +
    ` xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"` +
    ` xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">` +
    `<resources>${colorGroupXML}${objectXML}</resources>` +
    `<build><item objectid="2"/></build>` +
    `</model>`;

  const contentTypesXML =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`;

  const relsXML =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypesXML),
    '_rels/.rels': strToU8(relsXML),
    '3D/3dmodel.model': strToU8(modelXML),
  });

  return new Blob([zipped.buffer as ArrayBuffer], { type: 'model/3mf' });
}
