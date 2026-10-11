import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import type { PlaneSession, TrackingMode } from '@/hooks/useViewerTracking';
import type { MaterialPBR } from '@/types/materials';
import { groundGeometry, videoPoint } from '@/utils/tracking';
import modelAsset from '@/assets/hand-landmarker.asset.json';
import wasmAsset from '@/assets/hand-wasm.asset.json';

interface Props {
  geometry: THREE.BufferGeometry;
  pbr?: MaterialPBR;
  color: string;
  scale: number;
  mode: TrackingMode;
  video: React.RefObject<HTMLVideoElement>;
  plane: React.MutableRefObject<PlaneSession | null>;
  finger: number;
  axis: 'x' | 'y' | 'z';
  reset: number;
  onStatus: (status: string) => void;
  paused?: boolean;
  place?: number;
  calibration?: FingerCalibration;
  offset?: number;
  quiet?: boolean;
}

export interface FingerCalibration { size: number; slide: number; twist: number }
export const DEFAULT_CALIBRATION: FingerCalibration = { size: 1, slide: 0.28, twist: 0 };

export default function TrackedModel({ geometry, pbr, color, scale, mode, video, plane, finger, axis, reset, onStatus, paused = false, place = 0, calibration = DEFAULT_CALIBRATION, offset = 0, quiet = false }: Props) {
  const group = useRef<THREE.Group>(null);
  const detector = useRef<HandLandmarker | null>(null);
  const lastFrame = useRef(-1);
  const lastDetection = useRef(0);
  const lastStatus = useRef('');
  const locked = useRef(false);
  const hits = useRef(0);
  const forcePlace = useRef(false);
  const { camera, size } = useThree();
  const shape = useMemo(() => {
    if (mode === 'plane') return groundGeometry(geometry);
    const copy = geometry.clone(); copy.center(); copy.computeBoundingBox(); return copy;
  }, [geometry, mode]);
  const math = useMemo(() => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), scale: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), direction: new THREE.Vector3(), basis: new THREE.Vector3(), twist: new THREE.Quaternion(), side: new THREE.Vector3() }), []);
  const report = (text: string) => { if (quiet) return; if (lastStatus.current !== text) { lastStatus.current = text; onStatus(text); } };

  useEffect(() => () => shape.dispose(), [shape]);
  useEffect(() => { locked.current = false; hits.current = 0; }, [reset, mode]);
  useEffect(() => { if (place) { locked.current = false; hits.current = 0; forcePlace.current = true; } }, [place]);
  useEffect(() => { if (!quiet && mode !== 'off') onStatus(paused ? 'Tracking paused' : 'Tracking resumed'); lastStatus.current = ''; }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== 'hand' || quiet) return;
    let cancelled = false;
    void HandLandmarker.createFromOptions({
      wasmLoaderPath: '/tracking/vision_wasm_internal.js', wasmBinaryPath: wasmAsset.url,
    }, {
      baseOptions: { modelAssetPath: modelAsset.url, delegate: 'CPU' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.65, minTrackingConfidence: 0.65,
    }).then(value => {
      if (cancelled) value.close();
      else { detector.current = value; onStatus('Searching for a hand…'); }
    }).catch(() => { if (!cancelled) onStatus('Hand tracker could not load. Exit tracking and try again.'); });
    return () => { cancelled = true; detector.current?.close(); detector.current = null; };
  }, [mode, onStatus]);

  useFrame((_, delta, frame) => {
    const object = group.current;
    if (!object) return;
    if (mode === 'plane') {
      const tracking = plane.current;
      if (!tracking || !frame) { object.visible = false; return; }
      if (!locked.current) {
        const pose = frame.getHitTestResults(tracking.source)[0]?.getPose(tracking.space);
        if (!pose) { hits.current = 0; object.visible = false; report('Searching for a horizontal surface…'); return; }
        math.matrix.fromArray(pose.transform.matrix);
        math.matrix.decompose(math.position, math.rotation, math.scale);
        math.basis.set(0, 1, 0).applyQuaternion(math.rotation);
        if (math.basis.y < 0.95) { hits.current = 0; object.visible = false; report('Searching for a horizontal surface…'); return; }
        // Ignore transient hits; then hold a world-space pose instead of sliding with the camera ray.
        if (hits.current > 0 && object.position.distanceTo(math.position) > 0.03) hits.current = 0;
        object.position.copy(math.position); object.quaternion.copy(math.rotation);
        hits.current += 1;
        if (hits.current >= 12) { locked.current = true; report('Placed on surface'); }
      }
      object.visible = locked.current; object.scale.setScalar(scale);
      return;
    }
    const source = video.current;
    if (!detector.current || !source || source.readyState < 2 || !source.videoWidth) { object.visible = false; return; }
    const now = performance.now();
    if (now - lastDetection.current < 66 || source.currentTime === lastFrame.current) return;
    lastDetection.current = now; lastFrame.current = source.currentTime;
    try {
      const points = detector.current.detectForVideo(source, now).landmarks[0];
      const base = points?.[finger]; const joint = points?.[finger + 1];
      if (!base || !joint) { object.visible = false; report('Searching for a hand…'); return; }
      const a = videoPoint(base.x, base.y, source.videoWidth, source.videoHeight, size.width, size.height);
      const b = videoPoint(joint.x, joint.y, source.videoWidth, source.videoHeight, size.width, size.height);
      // Estimate depth from a proximal finger segment. This is a visual fit, never a body measurement.
      const distance = 1;
      const atDepth = (point: THREE.Vector2, output: THREE.Vector3) => {
        output.set(point.x, point.y, 0.5).unproject(camera).sub(camera.position).normalize();
        const forward = camera.getWorldDirection(math.direction);
        output.multiplyScalar(distance / Math.max(0.01, output.dot(forward))).add(camera.position);
      };
      atDepth(a, math.a); atDepth(b, math.b);
      const length = math.a.distanceTo(math.b);
      math.position.copy(math.a).lerp(math.b, 0.28);
      math.direction.subVectors(math.b, math.a).normalize();
      math.basis.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      math.rotation.setFromUnitVectors(math.basis, math.direction);
      const bounds = shape.boundingBox?.getSize(math.scale);
      const diameter = bounds ? Math.max(bounds.x, bounds.y, bounds.z) : 1;
      const fit = Math.max(0.00001, length * 0.7 / diameter) * scale;
      if (!object.visible) { object.position.copy(math.position); object.quaternion.copy(math.rotation); }
      const blend = 1 - Math.exp(-18 * Math.min(delta * 4, 0.1));
      object.position.lerp(math.position, blend); object.quaternion.slerp(math.rotation, blend);
      object.scale.setScalar(fit); object.visible = true;
      report('Finger tracked · approximate visual fit');
    } catch { object.visible = false; report('Hand tracking interrupted. Exit tracking and try again.'); }
  });

  const vertexColors = Boolean(shape.attributes.color) && (!pbr || pbr.metalness < 0.5);
  return <group ref={group} visible={false}>
    <mesh geometry={shape}>
      <meshStandardMaterial color={vertexColors ? 'white' : (pbr?.color ?? color)} vertexColors={vertexColors} metalness={pbr?.metalness ?? 0.12} roughness={pbr?.roughness ?? 0.42} envMapIntensity={pbr?.envIntensity ?? 1} side={THREE.DoubleSide} />
    </mesh>
  </group>;
}