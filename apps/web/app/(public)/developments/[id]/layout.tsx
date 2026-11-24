import type { Metadata } from "next";
import { db } from "@ultra/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const development = await db.development.findFirst({ where: { id: params.id, status: "APPROVED", listings: { some: { status: "LIVE" } } }, select: { name: true, description: true, area: true, city: true, listings: { where: { status: "LIVE" }, orderBy: { createdAt: "desc" }, take: 1, select: { photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } } });
  if (!development) return { title: "Development not available | ULTRA" };
  const description = `${development.description.slice(0, 140)} · ${development.area}, ${development.city}`;
  const image = development.listings[0]?.photos[0]?.url;
  const images = image ? [{ url: image, alt: development.name }] : [];
  return { title: `${development.name} | ULTRA`, description, openGraph: { title: development.name, description, type: "website", images }, twitter: { card: "summary_large_image", title: development.name, description, images: images.map(i => i.url) } };
}
export default function DevelopmentLayout({ children }: { children: React.ReactNode }) { return children; }
