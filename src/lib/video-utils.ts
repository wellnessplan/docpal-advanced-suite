// Helpers to extract YouTube/Vimeo IDs and build embed URLs.

export function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function buildEmbedUrl(sourceType: string, sourceUrl: string, autoplay = true, mute = true): string {
  if (sourceType === "youtube") {
    const id = getYouTubeId(sourceUrl);
    if (!id) return sourceUrl;
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      mute: mute ? "1" : "0",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      loop: "1",
      playlist: id,
      playsinline: "1",
    });
    return `https://www.youtube.com/embed/${id}?${params}`;
  }
  if (sourceType === "vimeo") {
    const id = getVimeoId(sourceUrl);
    if (!id) return sourceUrl;
    return `https://player.vimeo.com/video/${id}?autoplay=${autoplay ? 1 : 0}&muted=${mute ? 1 : 0}&controls=0&loop=1&background=1`;
  }
  return sourceUrl;
}

export function isDirectVideo(sourceType: string): boolean {
  return sourceType === "upload" || sourceType === "url";
}

export function generatePairCode(): string {
  // 6-char readable code (no confusing chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
