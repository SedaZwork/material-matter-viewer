import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Upload, ArrowRight } from 'lucide-react';

import recipeCeramic from '@/assets/recipe-ceramic.jpg';
import recipeSneakers from '@/assets/recipe-sneakers.jpg';
import recipeRing from '@/assets/recipe-ring.jpg';
import recipeAcoustic from '@/assets/recipe-acoustic.jpg';
import recipeCase from '@/assets/recipe-case.jpg';
import recipeMap from '@/assets/recipe-map.jpg';

interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tags: string[];
  available: boolean;
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
    id: 'ring',
    title: 'Structural Ring',
    subtitle: 'Text/image → metal powder 3D printed architectural jewelry',
    image: recipeRing,
    tags: ['Metal Print', 'AI Generated', 'Xometry'],
    available: false,
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
    available: false,
  },
];

interface RecipeGalleryProps {
  onEnterCustomizer: () => void;
}

const RecipeGallery: React.FC<RecipeGalleryProps> = ({ onEnterCustomizer }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleRecipeClick = (recipe: Recipe) => {
    if (recipe.available) {
      onEnterCustomizer();
    }
  };

  return (
    <div className="min-h-screen overflow-hidden relative" style={{ background: '#c9d0d6' }}>
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_55%)]" />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70" />
      <div className="absolute top-[120px] right-0 w-[220px] h-[1px] bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-yellow-300 opacity-70 blur-[1px] rotate-[-12deg]" />
      <div className="absolute bottom-[180px] left-[10%] w-[320px] h-[2px] bg-gradient-to-r from-violet-400 via-pink-300 to-cyan-300 opacity-60 blur-[2px] rotate-[8deg]" />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between px-6 md:px-10 py-6 md:py-8">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] text-black/55">
            0K3D · Generative Manufacturing
          </div>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-light mt-2 tracking-tight max-w-3xl leading-none text-[#111]">
            Design anything. Manufacture everywhere.
          </h1>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={onEnterCustomizer}
            className="px-5 py-2.5 rounded-full bg-[#1f2328] text-white text-sm hover:scale-105 transition-transform"
          >
            <Upload className="w-3.5 h-3.5 inline mr-2" />
            Upload STL
          </button>
        </div>
      </header>

      {/* Recipe gallery section */}
      <section className="relative z-10 px-6 md:px-10 mt-4 md:mt-8">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-black/55">
              Product Recipes
            </div>
            <h2 className="text-xl md:text-2xl font-light mt-1 text-[#111]">
              Choose your creation path
            </h2>
          </div>
          <div className="hidden md:block text-sm text-black/55 max-w-md text-right leading-relaxed">
            Hover to explore. Click to start creating.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 pb-16 md:pb-24">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onMouseEnter={() => setHoveredId(recipe.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleRecipeClick(recipe)}
              className={cn(
                "group relative rounded-[28px] overflow-hidden border border-white/40 backdrop-blur-2xl h-[380px] md:h-[440px] transition-all duration-500 shadow-[0_20px_80px_rgba(0,0,0,0.12)]",
                "before:absolute before:inset-0 before:border before:border-cyan-200/20 before:rounded-[28px] before:pointer-events-none",
                recipe.available
                  ? "cursor-pointer hover:scale-[1.03] hover:-translate-y-1 bg-white/35"
                  : "cursor-default opacity-80 bg-white/25"
              )}
            >
              {/* Shimmer line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-fuchsia-300 opacity-70 blur-[1px]" />

              {/* Image */}
              <img
                src={recipe.image}
                alt={recipe.title}
                loading="lazy"
                width={640}
                height={800}
                className="absolute inset-0 w-full h-full object-cover opacity-90 saturate-[1.3] contrast-[1.1] brightness-[1.05] group-hover:scale-110 transition duration-700"
              />

              {/* Glass overlay */}
              <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/80 drop-shadow">
                    Recipe
                  </div>
                  {recipe.available ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-white/60 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-2xl md:text-3xl font-light leading-tight text-white drop-shadow-lg max-w-[260px]">
                    {recipe.title}
                  </div>
                  <div className="mt-2 text-sm text-white/80 leading-relaxed drop-shadow">
                    {recipe.subtitle}
                  </div>

                  {/* Tags on hover */}
                  <div className="mt-4 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition duration-500">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 rounded-full bg-white/30 backdrop-blur-sm text-xs text-white/90">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {recipe.available && (
                    <div className="mt-4 opacity-0 group-hover:opacity-100 transition duration-500">
                      <span className="inline-flex items-center gap-1.5 text-sm text-white font-medium">
                        Start creating <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom info section */}
      <section className="relative z-10 px-6 md:px-10 pb-16">
        <div className="rounded-[30px] border border-white/40 bg-white/30 backdrop-blur-2xl p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'AI-Powered Design', text: 'Generate concepts from text or images using state-of-the-art generative AI.' },
              { title: 'Local Fabrication', text: 'Distributed network of fabricators for sustainable, fast manufacturing.' },
              { title: 'Zero Knowledge', text: 'No CAD skills needed. From idea to physical object in minutes.' },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-xs uppercase tracking-[0.3em] text-black/55">
                  Platform
                </div>
                <div className="mt-3 text-xl font-light text-[#111]">{item.title}</div>
                <div className="mt-2 text-sm text-black/65 leading-relaxed">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-10 pb-8 text-center">
        <p className="text-xs text-black/40 tracking-wide">
          0K3D.print — Democratizing Physical-Digital Creation
        </p>
      </footer>
    </div>
  );
};

export default RecipeGallery;
