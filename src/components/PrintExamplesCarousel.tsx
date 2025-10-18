import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import printExample1 from "@/assets/print-example-1.jpg";
import printExample2 from "@/assets/print-example-2.jpg";
import printExample3 from "@/assets/print-example-3.jpg";
import printExample4 from "@/assets/print-example-4.jpg";

const examples = [
  { id: 1, src: printExample1, alt: "3D printed geometric vase" },
  { id: 2, src: printExample2, alt: "3D printed mechanical part" },
  { id: 3, src: printExample3, alt: "3D printed jewelry" },
  { id: 4, src: printExample4, alt: "3D printed architecture" },
];

export const PrintExamplesCarousel = () => {
  return (
    <div className="h-full flex items-center">
      <Carousel
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
              <div className="relative overflow-hidden rounded-lg border border-border/50 backdrop-blur-sm bg-card/30 hover:border-primary/50 transition-all duration-300">
                <img
                  src={example.src}
                  alt={example.alt}
                  className="w-full h-[280px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
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
