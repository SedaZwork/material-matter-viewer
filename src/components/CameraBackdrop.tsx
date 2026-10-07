import { cn } from '@/lib/utils';
import { useCamera } from '@/hooks/useCamera';

interface CameraBackdropProps {
  blurred?: boolean;
  className?: string;
}

const CameraBackdrop = ({ blurred = false, className }: CameraBackdropProps) => {
  const { videoRef, isActive } = useCamera();

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      aria-hidden="true"
      className={cn(
        'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
        isActive ? 'opacity-100' : 'pointer-events-none opacity-0',
        blurred && isActive && 'scale-105 blur-md',
        className,
      )}
    />
  );
};

export default CameraBackdrop;