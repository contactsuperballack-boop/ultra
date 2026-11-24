"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { uploadFile } from "@/lib/upload";
import { calculateImageDHash } from "@/lib/imageHash";
import { X, Upload, Film, Loader2, Eye, EyeOff } from "lucide-react";
// Deep import: pure list, avoids pulling the Prisma client into the browser bundle.
import { featuresForKind, sanitizeFeatures } from "@ultra/db/src/listingFeatures";
import { extractYouTubeVideoId, youTubeThumbnailUrl } from "@ultra/db/src/youtube";
import { normalizeUnitNumber } from "@ultra/db/src/development";

type ListingType = "SALE" | "RENT" | "LAND";
const ROOM_TYPES = [
  { value: "FLOOR_PLAN", label: "Floor plan" },
  { value: "LIVING_ROOM", label: "Living Room" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "BEDROOM", label: "Bedroom" },
  { value: "BATHROOM", label: "Bathroom" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "OTHER", label: "Other" },
] as const;

interface PhotoItem {
  file: File;
  previewUrl: string;
  roomType?: (typeof ROOM_TYPES)[number]["value"];
}

export default function NewListingPage() {
  const router = useRouter();
  const [type, setType] = useState<ListingType>("SALE");
  const [category, setCategory] = useState<"RESIDENTIAL" | "COMMERCIAL">("RESIDENTIAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [priceFrequency, setPriceFrequency] = useState<"PER_YEAR" | "PER_MONTH">("PER_YEAR");
  const [serviceChargeNaira, setServiceChargeNaira] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [architect, setArchitect] = useState("");
  const [builder, setBuilder] = useState("");
  const [developer, setDeveloper] = useState("");
  const [completionYear, setCompletionYear] = useState("");
  const [ownerStatement, setOwnerStatement] = useState("");
  const [statementRole, setStatementRole] = useState<"" | "OWNER" | "DEVELOPER" | "AUTHORISED_REPRESENTATIVE">("");
  const [statementName, setStatementName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [developmentId, setDevelopmentId] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const { data: myDevelopments } = trpc.developments.mine.useQuery(undefined, { retry: false });
  const [furnishing, setFurnishing] = useState<"FURNISHED" | "UNFURNISHED" | "PARTLY_FURNISHED">("UNFURNISHED");
  const [landSizeUnit, setLandSizeUnit] = useState<"SQM" | "PLOTS" | "ACRES" | "HECTARES">("SQM");
  const [locationPrecision, setLocationPrecision] = useState<"EXACT" | "APPROXIMATE">("APPROXIMATE");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [sizeSqm, setSizeSqm] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ autoFlagged: boolean } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isLand = type === "LAND";

  // Readiness §4E — a completeness score and missing-field summary shown
  // BEFORE submission, so a realtor fixes gaps before they cost an admin
  // round-trip rather than after. Each check maps to something that
  // genuinely affects listing quality or moderation speed, not an
  // arbitrary point count.
  const checks = [
    { label: "Title", done: title.trim().length >= 5 },
    { label: "Description (at least 20 characters)", done: description.trim().length >= 20 },
    { label: "A detailed description (100+ characters helps buyers decide faster)", done: description.trim().length >= 100 },
    { label: "Price", done: !!priceNaira },
    { label: "Area", done: area.trim().length >= 2 },
    { label: "Size", done: !!sizeSqm },
    { label: "At least 1 photo", done: photos.length >= 1 },
    { label: "3+ photos (listings with more photos get more inquiries)", done: photos.length >= 3 },
    ...(isLand ? [] : [{ label: "Bedrooms and bathrooms specified", done: !!bedrooms && !!bathrooms }]),
  ];
  const completeness = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  const { data: limits } = trpc.uploads.limits.useQuery();
  const presignPhoto = trpc.uploads.presignListingMedia.useMutation();
  const presignVideo = trpc.uploads.presignListingMedia.useMutation();
  const presignModel = trpc.uploads.presignListingMedia.useMutation();
  const youtubeId = extractYouTubeVideoId(youtubeUrl);
  const createListing = trpc.listings.create.useMutation({ onSuccess: (data) => setSubmitted({ autoFlagged: data.autoFlagged }) });

  const maxImages = limits?.MAX_IMAGES_PER_LISTING ?? 10;

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const remaining = maxImages - photos.length;
    const next = Array.from(files)
      .slice(0, remaining)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...next]);
  }

  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setUploadError(null);
    if (photos.length === 0) {
      setUploadError("At least one photo is required.");
      return;
    }
    if (developmentId && !normalizeUnitNumber(unitNumber)) {
      setUploadError("Add a unit number (letters, numbers, spaces, - or /, up to 20 characters).");
      return;
    }
    if (ownerStatement.trim() && !statementRole) {
      setUploadError("Say whether the statement is from the owner, the developer or an authorised representative.");
      return;
    }
    if (youtubeUrl.trim() && !youtubeId) {
      setUploadError("That isn't a YouTube link. Paste a watch, youtu.be or Shorts link, or clear the field.");
      return;
    }
    if (modelFile && (!modelFile.name.toLowerCase().endsWith(".glb") || modelFile.size > (limits?.MAX_MODEL_BYTES ?? 25 * 1024 * 1024))) {
      setUploadError("The 3D model must be a .glb file under 25MB.");
      return;
    }
    setUploading(true);
    try {
      const uploadedPhotos: { url: string; roomType?: string; contentHash?: string }[] = [];
      for (const p of photos) {
        // Hash the original image before optimisation/upload. The server uses
        // this only as a human-review signal; a match never auto-rejects.
        const contentHash = await calculateImageDHash(p.file);
        const { publicUrl } = await uploadFile(p.file, (input) => presignPhoto.mutateAsync({ purpose: "listing-photo", ...input }));
        uploadedPhotos.push({ url: publicUrl!, roomType: p.roomType, contentHash }); // never null for this purpose — see lib/upload.ts
      }

      let videoUrl: string | undefined;
      if (video && !isLand) {
        const { publicUrl } = await uploadFile(video, (input) => presignVideo.mutateAsync({ purpose: "listing-video", ...input }));
        videoUrl = publicUrl!;
      }

      // Browsers often report an empty type for .glb; the presign signature needs the real one.
      let model3dUrl: string | undefined;
      if (modelFile && !isLand) {
        const glb = new File([modelFile], modelFile.name, { type: "model/gltf-binary" });
        const { publicUrl } = await uploadFile(glb, (input) => presignModel.mutateAsync({ purpose: "listing-model", ...input }));
        model3dUrl = publicUrl!;
      }

      await createListing.mutateAsync({
        title,
        description,
        type,
        category: isLand ? undefined : category,
        priceNaira: Number(priceNaira),
        priceFrequency: type === "RENT" ? priceFrequency : "ONE_TIME",
        serviceChargeNaira: type === "RENT" && serviceChargeNaira ? Number(serviceChargeNaira) : undefined,
        negotiable,
        features: sanitizeFeatures(features, type) as any,
        furnishing: isLand ? "NOT_APPLICABLE" : furnishing,
        landSizeUnit: isLand ? landSizeUnit : undefined,
        locationPrecision,
        area,
        bedrooms: isLand ? undefined : bedrooms ? Number(bedrooms) : undefined,
        bathrooms: isLand ? undefined : bathrooms ? Number(bathrooms) : undefined,
        sizeSqm: Number(sizeSqm),
        photos: uploadedPhotos,
        videoUrl,
        architect: !isLand && architect.trim() ? architect.trim() : undefined,
        builder: !isLand && builder.trim() ? builder.trim() : undefined,
        developer: !isLand && developer.trim() ? developer.trim() : undefined,
        completionYear: !isLand && completionYear ? Number(completionYear) : undefined,
        ownerStatement: ownerStatement.trim() || undefined,
        statementAuthorRole: ownerStatement.trim() && statementRole ? statementRole : undefined,
        statementAuthorName: ownerStatement.trim() && statementName.trim() ? statementName.trim() : undefined,
        youtubeUrl: youtubeUrl.trim() || undefined,
        model3dUrl,
        developmentId: developmentId || undefined,
        unitNumber: developmentId ? unitNumber.trim() : undefined,
      });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (submitted) {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <Upload size={24} className="text-emerald-800" />
        </div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Listing submitted</h1>
        <p className="text-sm text-stone-600 mb-6">
          {submitted.autoFlagged
            ? "Your listing's price is outside the typical range for this area, so it's been flagged for a closer admin review before it can go live."
            : "Your listing is being checked against our standard verification steps. Most listings go live within a few hours."}
        </p>
        <button onClick={() => router.push("/dashboard/listings")} className="bg-emerald-800 text-white rounded-xl px-6 py-2.5 text-sm font-semibold">
          View my listings
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">New listing</h1>
      <p className="text-sm text-stone-500 mb-8">Every listing is checked before it goes live.</p>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Property type</label>
          <div className="flex gap-2">
            {(["SALE", "RENT", "LAND"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); if (t === "LAND") setVideo(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${type === t ? "bg-emerald-800 text-white border-emerald-800" : "border-stone-300 text-stone-700"}`}
              >
                {t === "SALE" ? "For Sale" : t === "RENT" ? "To Let" : "Land"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="4-Bed Detached Duplex" className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the property — at least 20 characters." className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Price (\u20a6)</label>
            <input type="number" value={priceNaira} onChange={(e) => setPriceNaira(e.target.value)} placeholder="185000000" className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Area (e.g. Maitama)</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Maitama" className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {!isLand && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Bedrooms</label>
                <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Bathrooms</label>
                <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
              </div>
            </>
          )}
          <div className={isLand ? "col-span-3" : ""}>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Size (m\u00b2)</label>
            <input type="number" value={sizeSqm} onChange={(e) => setSizeSqm(e.target.value)} className="w-full border border-stone-300 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
        </div>

        {/* Readiness §9 — standardized fields (category, price frequency,
            service charge, negotiability, land size unit, furnishing,
            location precision) rather than leaving these to free text. */}
        <div className="border border-stone-200 rounded-xl p-4 space-y-4">
          <div className="text-xs font-semibold text-stone-700">Additional details</div>

          {!isLand && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Property category</label>
              <div className="flex gap-2">
                {(["RESIDENTIAL", "COMMERCIAL"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${category === c ? "bg-emerald-800 text-white border-emerald-800" : "border-stone-300 text-stone-600"}`}
                  >
                    {c === "RESIDENTIAL" ? "Residential" : "Commercial"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "RENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Rent frequency</label>
                <select value={priceFrequency} onChange={(e) => setPriceFrequency(e.target.value as any)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs outline-none">
                  <option value="PER_YEAR">Per year</option>
                  <option value="PER_MONTH">Per month</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Service charge (\u20a6, optional)</label>
                <input type="number" value={serviceChargeNaira} onChange={(e) => setServiceChargeNaira(e.target.value)} placeholder="Separate from rent" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs outline-none" />
              </div>
            </div>
          )}

          {!isLand && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Furnishing</label>
              <select value={furnishing} onChange={(e) => setFurnishing(e.target.value as any)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs outline-none">
                <option value="UNFURNISHED">Unfurnished</option>
                <option value="PARTLY_FURNISHED">Partly furnished</option>
                <option value="FURNISHED">Furnished</option>
              </select>
            </div>
          )}

          {isLand && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Land size unit (label only — size above stays in m\u00b2)</label>
              <select value={landSizeUnit} onChange={(e) => setLandSizeUnit(e.target.value as any)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-xs outline-none">
                <option value="SQM">Square meters</option>
                <option value="PLOTS">Plots</option>
                <option value="ACRES">Acres</option>
                <option value="HECTARES">Hectares</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-1.5">Location precision</label>
            <div className="flex gap-2">
              {(["APPROXIMATE", "EXACT"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setLocationPrecision(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${locationPrecision === p ? "bg-emerald-800 text-white border-emerald-800" : "border-stone-300 text-stone-600"}`}
                >
                  {p === "EXACT" ? "Exact address on request" : "Approximate area only"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
            Price is negotiable
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Property features</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {featuresForKind(type).map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={features.includes(f.key)}
                  onChange={(e) => setFeatures((cur) => (e.target.checked ? [...cur, f.key] : cur.filter((k) => k !== f.key)))}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Photos {isLand ? "" : "— tag by room where it helps buyers"} ({photos.length}/{maxImages})
          </label>
          <div className="grid grid-cols-4 gap-3 mb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.previewUrl} alt="" className="w-full h-20 object-cover rounded-lg border border-stone-200" />
                <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-900 text-white rounded-full flex items-center justify-center">
                  <X size={11} />
                </button>
                {!isLand && (
                  <select
                    value={p.roomType ?? ""}
                    onChange={(e) => setPhotos((ph) => ph.map((x, idx) => (idx === i ? { ...x, roomType: (e.target.value || undefined) as any } : x)))}
                    className="mt-1 w-full text-[10px] border border-stone-200 rounded px-1 py-0.5"
                  >
                    <option value="">Untagged</option>
                    {ROOM_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {photos.length < maxImages && (
              <label className="h-20 border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center cursor-pointer text-stone-500">
                <Upload size={16} />
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
          <p className="text-[11px] text-stone-500">JPEG, PNG, or WebP · max 5MB each · clear, well-lit photos only</p>
        </div>

        {!isLand && (
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Video (optional)</label>
            {video ? (
              <div className="flex items-center gap-3 border border-stone-200 rounded-xl p-3">
                <Film size={16} className="text-emerald-800" />
                <span className="text-xs text-stone-700 flex-1 truncate">{video.name}</span>
                <button onClick={() => setVideo(null)} className="text-stone-500"><X size={14} /></button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-stone-300 rounded-xl p-4 flex items-center gap-3 cursor-pointer text-stone-500">
                <Film size={16} />
                <span className="text-xs">A short, clear walkthrough clip</span>
                <input type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <p className="text-[11px] text-stone-500 mt-1">MP4 or MOV · max 50MB · not available for land listings</p>
          </div>
        )}

        {myDevelopments && myDevelopments.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Part of a development (optional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={developmentId} onChange={(e) => setDevelopmentId(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Not part of a development</option>
                {myDevelopments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {developmentId && (
                <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} maxLength={20} placeholder="Unit number, e.g. A-12" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {developmentId ? "Designer, builder, developer and year are taken from the development unless you fill them in below." : (<>Need a new one? <Link href="/dashboard/developments" className="underline">Create a development</Link>.</>)}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Property film on YouTube (optional)</label>
          <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="Paste your YouTube link" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-800" />
          {youtubeUrl.trim() && !youtubeId && <p className="text-[11px] text-red-700 mt-1">That isn't a YouTube link. Use a watch, youtu.be or Shorts link.</p>}
          {youtubeId && (
            <div className="flex items-center gap-3 mt-2">
              <img src={youTubeThumbnailUrl(youtubeId)} alt="Video preview" className="w-28 h-16 object-cover rounded-lg border border-stone-200" />
              <span className="text-[11px] text-stone-500">Buyers will see this video on the listing page.</span>
            </div>
          )}
          <p className="text-[11px] text-stone-500 mt-1">Upload to your own YouTube channel first. ULTRA shows it; it doesn't host it.</p>
        </div>

        {!isLand && (
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">3D model (optional)</label>
            {modelFile ? (
              <div className="flex items-center gap-3 border border-stone-200 rounded-xl p-3">
                <span className="text-xs text-stone-700 flex-1 truncate">{modelFile.name}</span>
                <button onClick={() => setModelFile(null)} className="text-stone-500"><X size={14} /></button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-stone-300 rounded-xl p-4 flex items-center gap-3 cursor-pointer text-stone-500">
                <span className="text-xs">Upload a .glb model of the building</span>
                <input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <p className="text-[11px] text-stone-500 mt-1">.glb only · max 25MB · from your architect or a 3D visualisation studio. Links to other sites aren't accepted.</p>
          </div>
        )}

        {!isLand && (
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Project information (optional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={architect} onChange={(e) => setArchitect(e.target.value)} maxLength={80} placeholder="Designed by" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
              <input value={builder} onChange={(e) => setBuilder(e.target.value)} maxLength={80} placeholder="Built by" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
              <input value={developer} onChange={(e) => setDeveloper(e.target.value)} maxLength={80} placeholder="Developed by" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
              <input type="number" value={completionYear} onChange={(e) => setCompletionYear(e.target.value)} min={1950} max={new Date().getFullYear()} placeholder="Year completed" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">Only add credits you can stand behind. They're shown as supplied by you and aren't independently verified by ULTRA.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">Statement from the owner or developer (optional)</label>
          <textarea value={ownerStatement} onChange={(e) => setOwnerStatement(e.target.value)} rows={4} maxLength={1500} placeholder="In a few sentences: the vision for the property and what makes it special." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-800" />
          {ownerStatement.trim() && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <select value={statementRole} onChange={(e) => setStatementRole(e.target.value as typeof statementRole)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Who is this from? (required)</option>
                <option value="OWNER">The owner</option>
                <option value="DEVELOPER">The developer</option>
                <option value="AUTHORISED_REPRESENTATIVE">An authorised representative</option>
              </select>
              <input value={statementName} onChange={(e) => setStatementName(e.target.value)} maxLength={80} placeholder="Name (optional)" className="border border-stone-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          )}
          <p className="text-[11px] text-stone-500 mt-1">Buyers will see who the statement is from, so it's never mistaken for the owner's words when it isn't.</p>
        </div>

        {uploadError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{uploadError}</div>}

        {/* Readiness §4E — completeness score, missing-field summary, and
            moderation expectations, all shown before submit rather than
            discovered after. */}
        <div className="border border-stone-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-700">Listing completeness</span>
            <span className={`text-xs font-mono ${completeness === 100 ? "text-emerald-700" : "text-amber-700"}`}>{completeness}%</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full ${completeness === 100 ? "bg-emerald-700" : "bg-amber-500"}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <div className="space-y-1">
            {checks.filter((c) => !c.done).map((c) => (
              <div key={c.label} className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-stone-300" /> {c.label}
              </div>
            ))}
            {checks.every((c) => c.done) && <div className="text-[11px] text-emerald-700">Everything's filled in.</div>}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPreview((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"
        >
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPreview ? "Hide preview" : "Preview how this looks to buyers"}
        </button>

        {showPreview && (
          <div className="border border-stone-200 rounded-2xl overflow-hidden max-w-xs">
            <div className="h-32 bg-gradient-to-br from-emerald-800 to-stone-900 relative">
              <span className="absolute top-2 left-2 text-[10px] font-mono px-2 py-1 rounded-full bg-white/90 text-stone-800">
                {type === "SALE" ? "For Sale" : type === "RENT" ? "For Rent" : "Land"}
              </span>
            </div>
            <div className="p-3">
              <div className="text-base font-semibold text-stone-900">
                {priceNaira ? `\u20a6${Number(priceNaira).toLocaleString()}` : "\u2014"}
              </div>
              <div className="text-sm font-semibold text-stone-900 mt-0.5 line-clamp-1">{title || "Untitled listing"}</div>
              <div className="text-xs text-stone-500 mt-0.5">{area || "Area not set"}, Abuja</div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500 font-mono">
                {!isLand && bedrooms && <span>{bedrooms} bd</span>}
                {!isLand && bathrooms && <span>{bathrooms} ba</span>}
                {sizeSqm && <span>{sizeSqm}m\u00b2</span>}
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-3">
          After submitting: an in-band price is checked against our standard verification steps and usually goes live within
          a few hours. A price outside the typical range for the area is flagged for a closer admin review, which can take
          1–3 business days.
        </div>

        <button
          onClick={handleSubmit}
          disabled={uploading || !title || !description || !priceNaira || !area || !sizeSqm}
          className="w-full bg-emerald-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading && <Loader2 size={15} className="animate-spin" />}
          {uploading ? "Uploading\u2026" : "Submit listing"}
        </button>
      </div>
    </main>
  );
}
