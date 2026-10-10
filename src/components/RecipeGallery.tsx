import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Upload, ArrowRight, Camera, CameraOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CameraBackdrop from '@/components/CameraBackdrop';
import { useCamera } from '@/hooks/useCamera';

import recipeCeramic from '@/assets/recipe-ceramic.jpg';
import recipeSneakers from '@/assets/recipe-sneakers.jpg';
import recipeRing from '@/assets/recipe-ring.jpg';
import recipeAcoustic from '@/assets/recipe-acoustic.jpg';
import recipeCase from '@/assets/recipe-case.jpg';
import recipeMap from '@/assets/recipe-map.jpg';
import recipeVessel from '@/assets/recipe-vessel.jpg';

interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tags: string[];
  available: boolean;
  generatorRoute?: string;
}

const recipes: Recipe[] = [
  {
    id: 'custom-3d',
    title: 'Custom 3D Print',
    subtitle: 'Upload your STL → choose material → get it printed locally',
    image: recipeCeramic,
    tags: ['FDM', 'SLA', 'Upload STL'],
    available: true,
  },
  {
    id: 'ceramic-vessel',
    title: 'Ceramic Vessel',
    subtitle: 'Procedural lathe design with texture patterns — porcelain & stoneware',
    image: recipeVessel,
    tags: ['Ceramic', 'Procedural', 'Lathe'],
    available: true,
    generatorRoute: '/vessel-generator',
  },
  {
    id: 'ring',
    title: 'Structural Ring',
    subtitle: 'Text/image → AI concept → Tripo 3D → metal powder 3D printed jewelry',
    image: recipeRing,
    tags: ['AI Generated', 'Muse Image', 'Tripo 3D', 'Metal Print'],
    available: true,
    generatorRoute: '/ring-generator',
  },
  {
    id: 'sneakers',
    title: '3D Printed Sneakers',
    subtitle: 'Fullcolor multimaterial MultiJet Fusion custom footwear',
    image: recipeSneakers,
    tags: ['MJF', 'Fullcolor', 'Wearable'],
    available: false,
  },
  {
    id: 'acoustic',
    title: 'Acoustic Walls',
    subtitle: 'Mycelium + wood parametric patterned decorative panels',
    image: recipeAcoustic,
    tags: ['Laser Cut', 'Parametric', 'Sustainable'],
    available: false,
  },
  {
    id: 'case',
    title: 'Custom Phone Case',
    subtitle: 'Text/image to phone case — flexible resin & MJF',
    image: recipeCase,
    tags: ['MJF', 'Flexible', 'AI Generated'],
    available: false,
  },
  {
    id: 'map',
    title: 'Terrain Scale Model',
    subtitle: 'Custom map by coordinates — CNC machined or 3D printed',
    image: recipeMap,
    tags: ['CNC', 'Wood', 'Multicolor FDM'],
    available: true,
    generatorRoute: '/terrain-generator',
  },
];

interface RecipeGalleryProps {
  onEnterCustomizer: () => void;
}

const RecipeGallery: React.FC<RecipeGalleryProps> = ({ onEnterCustomizer }) => {
  const { isActive: cameraActive, permission, error: cameraError, start: startCamera, stop: stopCamera, dismiss } = useCamera();
  const [welcomeOpen, setWelcomeOpen] = useState(permission === 'prompt');
  const [activeIndex, setActiveIndex] = useState(0);
  const [angle, setAngle] = useState(0);
  const targetAngle = useRef(0);
  const dragging = useRef(false);
  const lastY = useRef(0);
  const frameRef = useRef<number>();
  const navigate = useNavigate();

  const step = 360 / recipes.length;
  const selectIndex = useCallback((index: number) => {
    const next = (index + recipes.length) % recipes.length;
    const currentTurns = Math.round((-targetAngle.current / 360));
    const candidates = [next, next + recipes.length, next - recipes.length].map(value => -value * step + currentTurns * 360);
    targetAngle.current = candidates.reduce((best, value) => Math.abs(value - targetAngle.current) < Math.abs(best - targetAngle.current) ? value : best);
    setActiveIndex(next);
  }, [step]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = () => {
      setAngle(previous => reduceMotion ? targetAngle.current : previous + (targetAngle.current - previous) * 0.12);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    lastY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = event.clientY - lastY.current;
    lastY.current = event.clientY;
    targetAngle.current += delta * 0.34;
  };

  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    selectIndex(Math.round(-targetAngle.current / step));
  };

  const enableCamera = async () => {
    await startCamera();
    setWelcomeOpen(false);
  };

  const continueWithoutCamera = () => {
    dismiss();
    setWelcomeOpen(false);
  };

  const handleRecipeClick = (recipe: Recipe) => {
    if (!recipe.available) return;
    if (recipe.generatorRoute) {
      navigate(recipe.generatorRoute);
    } else {
      onEnterCustomizer();
    }
  };

  return (
    <div className="recipe-home relative h-dvh overflow-hidden bg-secondary">
      <CameraBackdrop blurred />
      <div className={cn('absolute inset-0 transition-colors duration-500', cameraActive ? 'bg-background/30' : 'bg-background/70')} />

      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-5 py-5 md:px-10 md:py-8">
        <div>
          <h1 className="text-3xl font-medium leading-none text-foreground">0K3D.print</h1>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={cameraActive ? 'Turn camera off' : 'Turn camera on'}
            onClick={() => cameraActive ? stopCamera() : void startCamera()}
            className="border-border/60 bg-background/55 backdrop-blur-xl"
          >
            {cameraActive ? <CameraOff /> : <Camera />}
          </Button>
          <Button
            onClick={onEnterCustomizer}
            className="hidden sm:inline-flex"
          >
            <Upload />
            Upload STL
          </Button>
        </div>
      </header>

      <main className="absolute inset-0 z-10">
        <section className="absolute inset-0 overflow-hidden" aria-label="Product recipes">
          <div
            className="recipe-orbit-stage absolute inset-0 touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onWheel={(event) => { event.preventDefault(); selectIndex(activeIndex + (event.deltaY > 0 ? 1 : -1)); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') selectIndex(activeIndex + 1);
              if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') selectIndex(activeIndex - 1);
              if (event.key === 'Enter') handleRecipeClick(recipes[activeIndex]);
            }}
            tabIndex={0}
          >
            <div className="orbital-ring" style={{ transform: `translate(-50%, -50%) rotateX(${angle}deg)` }}>
          {recipes.map((recipe, index) => (
            <article
              key={recipe.id}
              onClick={(event) => { event.stopPropagation(); index === activeIndex ? handleRecipeClick(recipe) : selectIndex(index); }}
              className={cn(
                'recipe-glass-card group absolute inset-0 cursor-pointer overflow-hidden transition-opacity duration-300',
                index === activeIndex ? 'opacity-100' : 'opacity-80',
                !recipe.available && 'saturate-50'
              )}
              style={{ transform: `rotateX(${index * step}deg) translateZ(var(--orbital-radius))`, backfaceVisibility: 'hidden' }}
            >
              <img
                src={recipe.image}
                alt={recipe.title}
                loading="lazy"
                width={640}
                height={800}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="recipe-card-wash absolute inset-0" />
              <h2 className="absolute inset-x-0 top-0 p-4 text-xl font-medium leading-tight text-foreground">{recipe.title}</h2>
              <div className="absolute inset-x-0 bottom-0 p-4 text-foreground">
                <p className="mb-3 text-xs leading-snug">{recipe.subtitle}</p>
                <Button
                  variant="outline"
                  className="recipe-glass-action h-8 w-full rounded-full"
                  tabIndex={index === activeIndex ? 0 : -1}
                  disabled={!recipe.available}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); handleRecipeClick(recipe); }}
                >
                  {recipe.available ? 'Start creating' : 'Coming soon'}
                  {recipe.available && <ArrowRight />}
                </Button>
              </div>
            </article>
          ))}
            </div>
            <div className="absolute inset-y-0 right-3 z-20 flex flex-col items-center justify-center gap-1 sm:right-8" onPointerDown={event => event.stopPropagation()}>
              {recipes.map((recipe, index) => <Button variant="ghost" size="icon" key={recipe.id} aria-label={`Show ${recipe.title}`} aria-pressed={index === activeIndex} onClick={() => selectIndex(index)} className="h-6 w-6 rounded-full"><span className={cn('w-1.5 rounded-full border border-foreground/40 transition-all', index === activeIndex ? 'h-5 bg-foreground' : 'h-1.5 bg-background/40')} /></Button>)}
            </div>
            <div className="recipe-orbit-controls absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border/60 bg-background/70 px-4 py-2 backdrop-blur-xl" onPointerDown={event => event.stopPropagation()}>
              <Button variant="outline" size="icon" aria-label="Previous recipe" onPointerDown={event => { event.stopPropagation(); selectIndex(activeIndex - 1); }} className="bg-background/60 backdrop-blur-xl"><ChevronLeft /></Button>
              <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">{String(activeIndex + 1).padStart(2, '0')} / {String(recipes.length).padStart(2, '0')}</span>
              <Button variant="outline" size="icon" aria-label="Next recipe" onPointerDown={event => { event.stopPropagation(); selectIndex(activeIndex + 1); }} className="bg-background/60 backdrop-blur-xl"><ChevronRight /></Button>
            </div>
          </div>
        </section>
      </main>
      {cameraError && <p role="status" className="pointer-events-none absolute bottom-24 inset-x-5 z-30 mx-auto max-w-sm rounded-md bg-background/90 p-2 text-center text-xs text-muted-foreground">{cameraError} Using the standard background.</p>}

      {welcomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-5 backdrop-blur-md">
          <section role="dialog" aria-modal="true" aria-labelledby="camera-welcome-title" className="w-full max-w-md rounded-lg border border-border bg-background p-7 shadow-elevated">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary"><Camera className="h-5 w-5" /></div>
            <h2 id="camera-welcome-title" className="mt-5 text-2xl font-medium">Create in your space</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Use your camera as the live background while you explore recipes and preview your model. Camera images stay on this device.</p>
            <Button onClick={() => void enableCamera()} className="mt-6 w-full"><Camera /> Enable camera</Button>
            <Button variant="ghost" onClick={continueWithoutCamera} className="mt-2 w-full">Continue without camera</Button>
          </section>
        </div>
      )}
    </div>
  );
};

export default RecipeGallery;
