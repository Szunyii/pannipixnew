import { About } from "@/components/about";
import { Booking } from "@/components/booking";
import { Faq } from "@/components/faq";
import { FlashCollection } from "@/components/flash-collection";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Paths } from "@/components/paths";
import { Process } from "@/components/process";
import { Spotlight } from "@/components/spotlight";
import { StoreProvider } from "@/components/store";

export default function Home() {
  return (
    <StoreProvider>
      <a
        href="#main"
        className="label sr-only z-60 rounded-[5px] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ugrás a tartalomra
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Paths />
        <FlashCollection />
        <Spotlight />
        <Process />
        <Faq />
        <About />
        <Booking />
      </main>
      <Footer />
    </StoreProvider>
  );
}
