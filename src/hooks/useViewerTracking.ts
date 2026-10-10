import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useCamera } from '@/hooks/useCamera';

export type TrackingMode = 'off' | 'hand' | 'plane';
export interface PlaneSession { session: XRSession; source: XRHitTestSource; space: XRReferenceSpace }

export function useViewerTracking() {
  const camera = useCamera();
  const [mode, setMode] = useState<TrackingMode>('off');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const plane = useRef<PlaneSession | null>(null);
  const session = useRef<XRSession | null>(null);
  const mounted = useRef(true);
  const resumeCamera = useRef(false);

  const stop = useCallback(async () => {
    if (session.current) await session.current.end().catch(() => undefined);
    if (mounted.current) { setMode('off'); setStatus(''); }
  }, []);

  const start = useCallback(async (target: 'hand' | 'plane', overlay: HTMLElement | null) => {
    if (busy) return;
    setBusy(true);
    try {
      if (target === 'hand') {
        if (await camera.start()) { setMode('hand'); setStatus('Loading hand tracker…'); }
        else setStatus('Camera access is needed for finger tracking.');
        return;
      }
      const xr = navigator.xr;
      const gl = renderer.current;
      if (!xr || !gl || !await xr.isSessionSupported('immersive-ar')) {
        setStatus('Surface tracking is unavailable in this browser. Try an AR-capable Android device.');
        return;
      }
      resumeCamera.current = camera.isActive;
      camera.stop();
      const current = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'],
        ...(overlay ? { domOverlay: { root: overlay } } : {}),
      });
      session.current = current;
      current.addEventListener('end', () => {
        plane.current?.source.cancel(); plane.current = null; session.current = null;
        gl.xr.enabled = false;
        if (mounted.current) {
          setMode('off'); setStatus('');
          if (resumeCamera.current) void camera.start();
        }
      }, { once: true });
      const viewerSpace = await current.requestReferenceSpace('viewer');
      const space = await current.requestReferenceSpace('local');
      const source = await current.requestHitTestSource?.({ space: viewerSpace });
      if (!source) throw new Error('No hit-test source');
      gl.xr.enabled = true;
      gl.xr.setReferenceSpaceType('local');
      await gl.xr.setSession(current);
      gl.xr.setReferenceSpace(space);
      plane.current = { session: current, source, space };
      setMode('plane'); setStatus('Searching for a horizontal surface…');
    } catch {
      await session.current?.end().catch(() => undefined);
      if (resumeCamera.current && mounted.current) void camera.start();
      setMode('off'); setStatus('Tracking could not start. Check camera permission and AR support.');
    } finally { if (mounted.current) setBusy(false); }
  }, [busy, camera]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      plane.current?.source.cancel(); plane.current = null;
      void session.current?.end().catch(() => undefined);
    };
  }, []);
  return { mode, status, busy, start, stop, setStatus, renderer, plane };
}