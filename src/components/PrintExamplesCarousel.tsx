import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from "@/components/ui/carousel";
import { supabase } from "@/integrations/supabase/client";

interface ThingiverseModel {
  id: string;
  name: string;
  thumbnail: string;
  creator: string;
  downloads: number;
  downloadUrl: string;
}

interface PrintExamplesCarouselProps {
  onModelSelect?: (modelName: string, downloadUrl: string) => void;
}

export const PrintExamplesCarousel = ({ onModelSelect }: PrintExamplesCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [models, setModels] = useState<ThingiverseModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchPopularModels();
  }, []);

  const fetchPopularModels = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('thingiverse-proxy', {
        body: { action: 'popular' },
      });

      if (error) throw error;
      
      if (data?.models) {
        setModels(data.models);
      }
    } catch (error) {
      console.error('Failed to fetch Thingiverse models:', error);
      // Fallback to placeholder data
      setModels([
        {
          id: "1",
          name: "Sample Model 1",
          thumbnail: "https://placehold.co/400x400/3b82f6/ffffff?text=3D+Model",
          creator: "Demo",
          downloads: 100,
          downloadUrl: ""
        }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (!api || loading) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 4000);

    return () => clearInterval(interval);
  }, [api, loading]);
  
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center">
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          loop: true,
        }}
        orientation="vertical"
        className="w-full max-w-[120px]"
      >
        <CarouselContent className="-mt-1 h-[600px]">
          {models.map((model) => (
            <CarouselItem key={model.id} className="pt-1 md:basis-1/2">
              <div 
                className="relative overflow-hidden rounded-lg border border-border/50 backdrop-blur-sm bg-card/30 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                onClick={() => onModelSelect?.(model.name, model.downloadUrl)}
              >
                <img
                  src={model.thumbnail}
                  alt={model.name}
                  className="w-full aspect-square object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/400x400/3b82f6/ffffff?text=3D+Print";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2">
                  <p className="text-[9px] text-foreground font-medium line-clamp-2">{model.name}</p>
                  <p className="text-[8px] text-muted-foreground">by {model.creator}</p>
                  <p className="text-[8px] text-muted-foreground">{(model.downloads / 1000).toFixed(1)}k downloads</p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-1/2 -translate-x-1/2 -top-8 h-6 w-6" />
        <CarouselNext className="left-1/2 -translate-x-1/2 -bottom-8 h-6 w-6" />
      </Carousel>
    </div>
  );
};
