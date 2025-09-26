import * as THREE from 'three';

export class VolumeCalculator {
  /**
   * Calculate volume of a THREE.js geometry using the tetrahedron method
   * This method calculates the signed volume of tetrahedrons formed by each face and origin
   */
  static calculateGeometryVolume(geometry: THREE.BufferGeometry): number {
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    
    if (!positions) {
      console.error('Geometry has no position attribute');
      return 0;
    }

    let volume = 0;
    
    if (indices) {
      // Indexed geometry
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i);
        const b = indices.getX(i + 1);
        const c = indices.getX(i + 2);
        
        const vA = new THREE.Vector3(
          positions.getX(a),
          positions.getY(a),
          positions.getZ(a)
        );
        const vB = new THREE.Vector3(
          positions.getX(b),
          positions.getY(b),
          positions.getZ(b)
        );
        const vC = new THREE.Vector3(
          positions.getX(c),
          positions.getY(c),
          positions.getZ(c)
        );
        
        volume += this.calculateTetrahedronVolume(vA, vB, vC);
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < positions.count; i += 3) {
        const vA = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );
        const vB = new THREE.Vector3(
          positions.getX(i + 1),
          positions.getY(i + 1),
          positions.getZ(i + 1)
        );
        const vC = new THREE.Vector3(
          positions.getX(i + 2),
          positions.getY(i + 2),
          positions.getZ(i + 2)
        );
        
        volume += this.calculateTetrahedronVolume(vA, vB, vC);
      }
    }
    
    return Math.abs(volume);
  }

  /**
   * Calculate signed volume of tetrahedron formed by triangle (vA, vB, vC) and origin
   */
  private static calculateTetrahedronVolume(
    vA: THREE.Vector3,
    vB: THREE.Vector3,
    vC: THREE.Vector3
  ): number {
    const x1 = vA.x, y1 = vA.y, z1 = vA.z;
    const x2 = vB.x, y2 = vB.y, z2 = vB.z;
    const x3 = vC.x, y3 = vC.y, z3 = vC.z;
    
    // Calculate signed volume using determinant formula
    const volume = (-x3 * y2 * z1 + x2 * y3 * z1 + x3 * y1 * z2 - x1 * y3 * z2 - x2 * y1 * z3 + x1 * y2 * z3) / 6;
    
    return volume;
  }

  /**
   * Calculate volume of mesh in cubic centimeters
   * Assumes the mesh is in millimeters and converts to cm³
   */
  static calculateMeshVolume(mesh: THREE.Mesh): number {
    if (!mesh.geometry) {
      console.error('Mesh has no geometry');
      return 0;
    }

    // Clone geometry to avoid modifying original
    const geometry = mesh.geometry.clone();
    
    // Apply mesh transformations to geometry
    geometry.applyMatrix4(mesh.matrixWorld);
    
    // Calculate volume in cubic units (assuming mm)
    const volumeMm3 = this.calculateGeometryVolume(geometry);
    
    // Convert mm³ to cm³ (divide by 1000)
    const volumeCm3 = volumeMm3 / 1000;
    
    // Clean up
    geometry.dispose();
    
    return Math.abs(volumeCm3);
  }

  /**
   * Calculate surface area of geometry
   */
  static calculateSurfaceArea(geometry: THREE.BufferGeometry): number {
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    
    if (!positions) {
      console.error('Geometry has no position attribute');
      return 0;
    }

    let area = 0;
    
    if (indices) {
      // Indexed geometry
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i);
        const b = indices.getX(i + 1);
        const c = indices.getX(i + 2);
        
        const vA = new THREE.Vector3(
          positions.getX(a),
          positions.getY(a),
          positions.getZ(a)
        );
        const vB = new THREE.Vector3(
          positions.getX(b),
          positions.getY(b),
          positions.getZ(b)
        );
        const vC = new THREE.Vector3(
          positions.getX(c),
          positions.getY(c),
          positions.getZ(c)
        );
        
        area += this.calculateTriangleArea(vA, vB, vC);
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < positions.count; i += 3) {
        const vA = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );
        const vB = new THREE.Vector3(
          positions.getX(i + 1),
          positions.getY(i + 1),
          positions.getZ(i + 1)
        );
        const vC = new THREE.Vector3(
          positions.getX(i + 2),
          positions.getY(i + 2),
          positions.getZ(i + 2)
        );
        
        area += this.calculateTriangleArea(vA, vB, vC);
      }
    }
    
    return area;
  }

  /**
   * Calculate area of triangle using cross product
   */
  private static calculateTriangleArea(
    vA: THREE.Vector3,
    vB: THREE.Vector3,
    vC: THREE.Vector3
  ): number {
    const ab = new THREE.Vector3().subVectors(vB, vA);
    const ac = new THREE.Vector3().subVectors(vC, vA);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    
    return cross.length() / 2;
  }
}