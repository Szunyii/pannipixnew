import { connection } from "next/server";
import { About } from "@/components/about";
import { Booking } from "@/components/booking";
import { priceRange, ruleSummary } from "@/components/data";
import { Faq } from "@/components/faq";
import { FlashCollection } from "@/components/flash-collection";
import { Hero } from "@/components/hero";
import { Paths } from "@/components/paths";
import { Process } from "@/components/process";
import { getFlashCatalog } from "@/lib/flash";

export default async function Home() {
  // Rendered per request so availability is always current, and the build never touches the database.
  await connection();
  const designs = await getFlashCatalog();

  return (
    <>
      <Hero />
      <FlashCollection designs={designs} />
      <Paths flashPrice={priceRange(designs)} flashRule={ruleSummary(designs)} />
      <Process />
      <Faq />
      <About />
      <Booking />
    </>
  );
}
