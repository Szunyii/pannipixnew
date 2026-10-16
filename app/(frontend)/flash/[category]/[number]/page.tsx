import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { rowOrder } from "@/components/data";
import { DesignDetail } from "@/components/design-detail";
import { designName } from "@/lib/design-name";
import { getFlashCatalog } from "@/lib/flash";

type Props = PageProps<"/flash/[category]/[number]">;

/** The design at this address with its neighbours in its collection's row, or null when the site doesn't show it. */
async function load(params: Props["params"]) {
  const { category, number } = await params;
  const row = rowOrder((await getFlashCatalog()).filter((d) => d.category === category));
  const index = row.findIndex((d) => d.number === number);
  if (index === -1) return null;
  return { design: row[index], prev: row[index - 1] ?? null, next: row[index + 1] ?? null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return {};
  return { title: designName(found.design), description: found.design.description || undefined };
}

export default async function FlashDesignPage({ params }: Props) {
  // Rendered per request so availability is always current, and the build never touches the database.
  await connection();
  const found = await load(params);
  if (!found) notFound();
  // Keyed, so stepping to a neighbour starts its views from the first image.
  return <DesignDetail key={found.design.id} {...found} />;
}
