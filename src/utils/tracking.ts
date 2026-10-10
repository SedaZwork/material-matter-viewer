import * as THREE from 'three';

/** Map object-cover video landmarks to the exact visible camera crop. */
export function videoPoint(x: number, y: number, videoWidth: number, videoHeight: number, width: number, height: number) {
  const ratio = Math.max(width / videoWidth, height / videoHeight);
  return new THREE.Vector2(
    ((x * videoWidth * ratio - (videoWidth * ratio - width) / 2) / width) * 2 - 1,
    1 - ((y * videoHeight * ratio - (videoHeight * ratio - height) / 2) / height) * 2,
  );
}

export function groundGeometry(geometry: THREE.BufferGeometry) {
  const result = geometry.clone();
  result.computeBoundingBox();
  const box = result.boundingBox;
  if (box) {
    const center = box.getCenter(new THREE.Vector3());
    result.translate(-center.x, -box.min.y, -center.z);
  }
  // Fabrication coordinates are millimetres; WebXR uses metres.
  result.scale(0.001, 0.001, 0.001);
  return result;
}