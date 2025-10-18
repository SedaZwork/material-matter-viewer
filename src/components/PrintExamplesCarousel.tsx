import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from "@/components/ui/carousel";
import printExample1 from "@/assets/print-example-1.jpg";
import printExample2 from "@/assets/print-example-2.jpg";
import printExample3 from "@/assets/print-example-3.jpg";
import printExample4 from "@/assets/print-example-4.jpg";

const examples = [
  { 
    id: 1, 
    src: printExample1, 
    alt: "Low Poly Stanford Bunny",
    modelUrl: "https://cdn.thingiverse.com/assets/82/fe/a0/b7/43/Low_Poly_Stanford_Bunny.stl"
  },
  { 
    id: 2, 
    src: printExample2, 
    alt: "Twisted Vase",
    modelUrl: "https://cdn.thingiverse.com/assets/e9/04/9e/6f/91/Vase_Mode_Twisted_Vase.stl"
  },
  { 
    id: 3, 
    src: printExample3, 
    alt: "Flexi Rex Dinosaur",
    modelUrl: "https://cdn.thingiverse.com/assets/c4/7a/8e/2d/3b/Flexi_Rex.stl"
  },
  { 
    id: 4, 
    src: printExample4, 
    alt: "Articulated Dragon",
    modelUrl: "https://cdn.thingiverse.com/assets/f3/59/84/0f/7a/Articulated_Dragon.stl"
  },
];

interface PrintExamplesCarouselProps {
  onModelSelect?: (modelUrl: string) => void;
}

export const PrintExamplesCarousel = ({ onModelSelect }: PrintExamplesCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  
  useEffect(() => {
    if (!api) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [api]);
  
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
          {examples.map((example) => (
            <CarouselItem key={example.id} className="pt-1 md:basis-1/2">
              <div 
                className="relative overflow-hidden rounded-lg border border-border/50 backdrop-blur-sm bg-card/30 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                onClick={() => onModelSelect?.(example.modelUrl)}
              >
                <img
                  src={example.src}
                  alt={example.alt}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                  <p className="text-[10px] text-foreground/90 font-medium">{example.alt}</p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-1/2 -translate-x-1/2 -top-8" />
        <CarouselNext className="left-1/2 -translate-x-1/2 -bottom-8" />
      </Carousel>
    </div>
  );
};
