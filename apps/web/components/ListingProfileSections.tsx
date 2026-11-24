import { MapPin, Quote } from "lucide-react";
// Deep import: pure helpers, avoids pulling the Prisma client into the browser bundle.
import { isValidYouTubeVideoId, youTubeEmbedUrl } from "@ultra/db/src/youtube";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "the owner",
  DEVELOPER: "the developer",
  AUTHORISED_REPRESENTATIVE: "an authorised representative",
};

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-stone-900 mb-2">{children}</h2>;
}

/** Designed by / built by / developed by / completed. Everything here is the realtor's own claim, and the page says so. */
export function ProjectInformation({ listing }: { listing: any }) {
  const rows: [string, string][] = [];
  if (listing.architect) rows.push(["Designed by", listing.architect]);
  if (listing.builder) rows.push(["Built by", listing.builder]);
  if (listing.developer) rows.push(["Developed by", listing.developer]);
  if (listing.completionYear) rows.push(["Completed", String(listing.completionYear)]);
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <Heading>Project information</Heading>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border border-stone-200 rounded-xl p-4 bg-white text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wide text-stone-500">{k}</dt>
            <dd className="text-stone-900 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-stone-500 mt-2">Credits are supplied by the realtor and aren't independently verified by ULTRA.</p>
    </section>
  );
}

/** A statement is always attributed. A realtor can't present their own words as the owner's. */
export function OwnerStatement({ listing }: { listing: any }) {
  if (!listing.ownerStatement || !listing.statementAuthorRole) return null;
  const role = ROLE_LABELS[listing.statementAuthorRole] ?? "the realtor";
  return (
    <section className="mt-8">
      <Heading>A statement from {role}</Heading>
      <figure className="bg-white border border-stone-200 rounded-xl p-5">
        <Quote size={18} className="text-emerald-800 mb-2" />
        <blockquote className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{listing.ownerStatement}</blockquote>
        <figcaption className="text-xs text-stone-500 mt-3">
          {listing.statementAuthorName ? `${listing.statementAuthorName}, ` : ""}
          {listing.statementAuthorRole === "OWNER" ? "Owner" : listing.statementAuthorRole === "DEVELOPER" ? "Developer" : "Authorised representative"}
        </figcaption>
        <p className="text-[11px] text-stone-500 mt-2">Submitted by the listing realtor. Not verified by ULTRA.</p>
      </figure>
    </section>
  );
}

/** Property film: privacy-enhanced YouTube embed of a validated 11-character ID only. */
export function PropertyFilm({ videoId, title }: { videoId?: string | null; title: string }) {
  if (!isValidYouTubeVideoId(videoId)) return null;
  return (
    <section className="mt-8">
      <Heading>Property film</Heading>
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-stone-200">
        <iframe
          src={youTubeEmbedUrl(videoId)}
          title={`${title} — property film`}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </section>
  );
}

/** Area-level map only. Listings don't store an exact address, so the map is approximate by design. */
export function LocationMap({ area, city }: { area: string; city: string }) {
  const q = encodeURIComponent(`${area}, ${city}, Nigeria`);
  return (
    <section className="mt-8">
      <Heading>
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-emerald-800" /> Location</span>
      </Heading>
      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
        <iframe
          src={`https://www.google.com/maps?q=${q}&output=embed`}
          title={`Map of ${area}`}
          className="w-full h-64 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="text-[11px] text-stone-500 mt-2">Approximate area. The exact address is shared after you make an inquiry.</p>
    </section>
  );
}
