import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type CameraPermission = 'prompt' | 'active' | 'denied' | 'dismissed' | 'unavailable';

interface CameraContextValue {
  isActive: boolean;
  error: string | null;
  permission: CameraPermission;
  videoRef: (element: HTMLVideoElement | null) => void;
  start: () => Promise<boolean>;
  stop: () => void;
  dismiss: () => void;
}

const CameraContext = createContext<CameraContextValue | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const streamRef = useRef<MediaStream | null>(null);
  const videosRef = useRef(new Set<HTMLVideoElement>());
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<CameraPermission>('prompt');

  const attachStream = useCallback((video: HTMLVideoElement) => {
    video.srcObject = streamRef.current;
    if (streamRef.current) void video.play().catch(() => undefined);
  }, []);

  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    if (!element) return;
    videosRef.current.add(element);
    attachStream(element);
  }, [attachStream]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    videosRef.current.forEach(video => { video.srcObject = null; });
    setIsActive(false);
    setPermission(previous => previous === 'denied' || previous === 'unavailable' ? previous : 'dismissed');
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current?.active) {
      setIsActive(true);
      setPermission('active');
      videosRef.current.forEach(attachStream);
      return true;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError('Camera is unavailable on this device or connection.');
      setPermission('unavailable');
      return false;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', stop, { once: true });
      videosRef.current.forEach(attachStream);
      setIsActive(true);
      setPermission('active');
      return true;
    } catch {
      setError('Camera access was denied or is unavailable.');
      setIsActive(false);
      setPermission('denied');
      return false;
    }
  }, [attachStream, stop]);

  const dismiss = useCallback(() => setPermission('dismissed'), []);

  useEffect(() => {
    const handlePageHide = () => stop();
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [stop]);

  const value = useMemo(() => ({ isActive, error, permission, videoRef, start, stop, dismiss }), [isActive, error, permission, videoRef, start, stop, dismiss]);
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) throw new Error('useCamera must be used within CameraProvider');
  return context;
}