"use client";

import Script from "next/script";
import { Box } from "lucide-react";

// Pinned, >2-week-old release of Google's <model-viewer>; loaded only on a
// listing page that actually has a 3D model, never site-wide.
const MODEL_VIEWER_SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

// Defence in depth. The API already refuses any model URL that isn't this
// realtor's own ULTRA upload; here we also refuse anything that isn't https +
// .glb, and (when configured) anything off ULTRA's media host.
const MEDIA_HOST = process.env.NEXT_PUBLIC_MEDIA_HOST; // e.g. media.ultraapp.ng (optional)

function isRenderable(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.pathname.toLowerCase().endsWith(".glb")) return false;
    if (MEDIA_HOST && u.hostname.toLowerCase() !== MEDIA_HOST.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

export function ModelViewer({ url, title }: { url: string; title: string }) {
  if (!isRenderable(url)) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-stone-900 mb-1 flex items-center gap-2">
        <Box size={15} className="text-emerald-800" /> Explore in 3D
      </h2>
      <p className="text-xs text-stone-500 mb-3">Drag to rotate, pinch or scroll to zoom. Model supplied by the realtor.</p>
      <Script src={MODEL_VIEWER_SRC} type="module" strategy="lazyOnload" />
      <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
        <model-viewer
          src={url}
          alt={`3D model of ${title}`}
          camera-controls=""
          auto-rotate=""
          shadow-intensity="1"
          interaction-prompt="none"
          style={{ width: "100%", height: 340 }}
        />
      </div>
    </section>
  );
}
