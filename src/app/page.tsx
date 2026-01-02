import {
  Navbar,
  Hero,
  BeforeAfter,
  WhoItsFor,
  Features,
  HowItWorks,
  Testimonials,
  Pricing,
  CTA,
  Footer,
} from '@/components/marketing';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <BeforeAfter />
        <WhoItsFor />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
