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
    <div className="relative min-h-screen overflow-hidden bg-secondary">
      <CameraBackdrop blurred />
      <div className={cn('absolute inset-0 transition-colors duration-500', cameraActive ? 'bg-background/30' : 'bg-background/70')} />

      {/* Header */}
      <header className="relative z-20 flex items-start justify-between gap-3 px-5 py-5 md:px-10 md:py-8">
        <div>
          <div className="text-xs uppercase text-foreground/60">
            0K3D · Generative Manufacturing
          </div>
          <h1 className="mt-2 max-w-[280px] text-2xl font-light leading-none text-foreground sm:max-w-3xl md:text-4xl lg:text-5xl">
            Design anything. Manufacture everywhere.
          </h1>
        </div>
        <div className="flex items-center gap-2">
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

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-116px)] max-w-[1500px] grid-cols-1 items-center gap-5 px-5 pb-10 lg:grid-cols-[minmax(280px,0.8fr)_minmax(480px,1.4fr)] lg:gap-8 lg:px-10">
        <section className="order-2 z-20 rounded-lg border border-border/60 bg-background/90 p-6 shadow-elevated backdrop-blur-2xl lg:order-1 lg:max-w-md lg:bg-background/60">
          <div className="text-xs uppercase text-muted-foreground">Recipe {String(activeIndex + 1).padStart(2, '0')} / {String(recipes.length).padStart(2, '0')}</div>
          <h2 className="mt-4 text-3xl font-light text-foreground md:text-5xl">{recipes[activeIndex].title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{recipes[activeIndex].subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {recipes[activeIndex].tags.map(tag => <span key={tag} className="rounded-md border border-border/70 bg-background/50 px-2.5 py-1 text-xs text-foreground/70">{tag}</span>)}
          </div>
          <Button className="mt-7 w-full" disabled={!recipes[activeIndex].available} onClick={() => handleRecipeClick(recipes[activeIndex])}>
            {recipes[activeIndex].available ? 'Start creating' : 'Coming soon'}
            {recipes[activeIndex].available && <ArrowRight />}
          </Button>
          {cameraError && <p role="status" className="mt-3 text-xs text-muted-foreground">{cameraError} Using the standard background.</p>}
        </section>

        <section className="order-1 flex min-h-[390px] items-center justify-center overflow-hidden lg:order-2 lg:min-h-[650px] lg:overflow-visible" aria-label="Product recipes">
          <div
            className="relative h-[390px] w-full max-w-[760px] touch-none select-none md:h-[620px]"
            style={{ perspective: '1400px' }}
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
            <div className="orbital-ring absolute inset-[12%_16%] md:inset-[8%_8%]" style={{ transformStyle: 'preserve-3d', transform: `rotateX(${angle}deg)` }}>
          {recipes.map((recipe, index) => (
            <article
              key={recipe.id}
              onClick={(event) => { event.stopPropagation(); index === activeIndex ? handleRecipeClick(recipe) : selectIndex(index); }}
              className={cn(
                'group absolute inset-0 cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card shadow-elevated transition-opacity duration-300',
                index === activeIndex ? 'opacity-100' : 'opacity-70',
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
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-viewport/90 via-transparent to-viewport/10" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-viewport-foreground">
                <div className="text-xs uppercase text-viewport-muted">{recipe.available ? 'Available' : 'Coming soon'}</div>
                <div className="mt-1 text-2xl font-medium">{recipe.title}</div>
              </div>
            </article>
          ))}
            </div>
            <div className="absolute inset-y-0 right-0 z-20 flex flex-col items-center justify-center gap-2" onPointerDown={event => event.stopPropagation()}>
              {recipes.map((recipe, index) => <button key={recipe.id} aria-label={`Show ${recipe.title}`} onPointerDown={event => { event.stopPropagation(); selectIndex(index); }} className={cn('h-2 w-2 rounded-full border border-foreground/40 transition-all', index === activeIndex ? 'h-7 bg-foreground' : 'bg-background/40')} />)}
            </div>
            <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 gap-2" onPointerDown={event => event.stopPropagation()}>
              <Button variant="outline" size="icon" aria-label="Previous recipe" onPointerDown={event => { event.stopPropagation(); selectIndex(activeIndex - 1); }} className="bg-background/60 backdrop-blur-xl"><ChevronLeft /></Button>
              <Button variant="outline" size="icon" aria-label="Next recipe" onPointerDown={event => { event.stopPropagation(); selectIndex(activeIndex + 1); }} className="bg-background/60 backdrop-blur-xl"><ChevronRight /></Button>
            </div>
          </div>
        </section>
      </main>

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
