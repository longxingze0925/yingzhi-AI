import { AuroraBackground } from "@/components/brand/backgrounds";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { ShowcaseWall } from "@/components/marketing/showcase-wall";
import { Workflow } from "@/components/marketing/workflow";
import { Pricing } from "@/components/marketing/pricing";
import { CtaSection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <ShowcaseWall />
        <Workflow />
        <Pricing />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
