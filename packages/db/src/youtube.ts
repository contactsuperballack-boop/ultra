// Pure YouTube link handling (ported from the prototype's tested validator).
// ULTRA never hosts property films: the realtor pastes a YouTube link, we
// validate it, keep ONLY the 11-character video ID, and embed via the
// privacy-enhanced domain. Storing the ID (not the pasted URL) means no
// arbitrary string from a realtor ever reaches an iframe src.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be", "www.youtu.be"]);

/** Returns the video ID for a watch / youtu.be / shorts / embed / live link on an allowed YouTube host, else null. */
export function extractYouTubeVideoId(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 300) return null;

  // Bare "youtube.com/..." pastes are fine; any other scheme (javascript:, data:, ftp:) is not.
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(www\.|m\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(trimmed)
      ? `https://${trimmed}`
      : null;
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const seg = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") id = seg[0] ?? null;
  else if (seg[0] === "watch") id = url.searchParams.get("v");
  else if (["embed", "shorts", "live", "v"].includes(seg[0])) id = seg[1] ?? null;

  return id && VIDEO_ID.test(id) ? id : null;
}

export function isValidYouTubeVideoId(id: string | null | undefined): id is string {
  return !!id && VIDEO_ID.test(id);
}

/** Privacy-enhanced embed URL for an already-validated ID. */
export function youTubeEmbedUrl(id: string): string {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid YouTube video ID");
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

export function youTubeThumbnailUrl(id: string): string {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid YouTube video ID");
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youTubeWatchUrl(id: string): string {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid YouTube video ID");
  return `https://www.youtube.com/watch?v=${id}`;
}
