import type { Metadata } from "next";
import { db } from "@ultra/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const listing = await db.listing.findFirst({ where: { id: params.id, status: "LIVE" }, select: { title: true, description: true, area: true, city: true, photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } });
  if (!listing) return { title: "Property not available | ULTRA" };
  const description = `${listing.description.slice(0, 140)} · ${listing.area}, ${listing.city}`;
  const images = listing.photos[0]?.url ? [{ url: listing.photos[0].url, alt: listing.title }] : [];
  return { title: `${listing.title} | ULTRA`, description, openGraph: { title: listing.title, description, type: "website", images }, twitter: { card: "summary_large_image", title: listing.title, description, images: images.map(i => i.url) } };
}
export default function ListingLayout({ children }: { children: React.ReactNode }) { return children; }
