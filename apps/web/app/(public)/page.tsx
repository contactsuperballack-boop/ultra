import { ShieldCheck } from "lucide-react";
import { HomeSearch } from "@/components/HomeSearch";
import { CategoryTiles } from "@/components/CategoryTiles";
import { ExploreByLocation } from "@/components/ExploreByLocation";
import { LatestVerified } from "@/components/LatestVerified";
import { HomeDevelopments } from "@/components/HomeDevelopments";

export default function Home() {
  return (
    <main>
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-900 to-brand-ink text-white">
        <div className="max-w-6xl mx-auto px-5 py-14 sm:py-20">
          <div className="text-[11px] tracking-[0.2em] font-mono text-white/60 mb-4">THE TRUSTED PROPERTY MARKETPLACE FOR ABUJA</div>
          <h1 className="text-3xl sm:text-5xl font-semibold leading-tight mb-4">
            Everything your home needs,<br />
            <span className="text-emerald-300">in one place.</span>
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-xl mb-8">
            Find homes, land and rentals from identity-verified realtors across Abuja.
          </p>
          <HomeSearch />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col gap-12">
        <CategoryTiles />
        <ExploreByLocation />

        <section className="rounded-2xl bg-emerald-900 text-white p-6 flex items-center gap-5">
          <ShieldCheck size={40} className="shrink-0 text-emerald-300" />
          <div>
            <div className="font-semibold">Verified. Trusted. Real.</div>
            <p className="text-sm text-white/70">
              Every realtor on ULTRA is identity-checked, and every listing is reviewed before it goes live.
            </p>
          </div>
        </section>

        <HomeDevelopments />
        <LatestVerified />
      </div>
    </main>
  );
}
