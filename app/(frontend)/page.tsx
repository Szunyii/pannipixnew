import { connection } from "next/server";
import { About } from "@/components/about";
import { Booking } from "@/components/booking";
import { BookingDialog } from "@/components/booking-dialog";
import { priceRange, ruleSummary } from "@/components/data";
import { Faq } from "@/components/faq";
import { FlashCollection } from "@/components/flash-collection";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Paths } from "@/components/paths";
import { Process } from "@/components/process";
import { Spotlight } from "@/components/spotlight";
import { StoreProvider } from "@/components/store";
import { getFlashCatalog } from "@/lib/flash";

export default async function Home() {
  // Rendered per request so availability is always current, and the build never touches the database.
  await connection();
  const { categories, designs } = await getFlashCatalog();
  // Designs come newest first: the spotlight opens on the newest one that can still be booked, else the newest.
  const featured = designs.find((d) => !d.availability.soldOut) ?? designs[0];

  return (
    <StoreProvider initialFeatured={featured?.id ?? null}>
      <a
        href="#main"
        className="label sr-only z-60 rounded-[5px] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ugrás a tartalomra
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Paths flashPrice={priceRange(designs)} flashRule={ruleSummary(categories)} />
        <FlashCollection designs={designs} categories={categories} />
        <Spotlight designs={designs} />
        <Process />
        <Faq />
        <About />
        <Booking />
      </main>
      <Footer />
      <BookingDialog />
    </StoreProvider>
  );
}
