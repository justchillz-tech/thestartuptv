export function extractGoogleDriveFileId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    if (!url.hostname.endsWith("google.com") && !url.hostname.endsWith("googleusercontent.com")) {
      return null;
    }

    const filePathMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (filePathMatch?.[1]) return filePathMatch[1];

    const idParam = url.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  } catch {
    return null;
  }

  return null;
}

export function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();

  if (!input) return null;

  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];

      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }

      return null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const videoId = url.searchParams.get("v");

      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }

      const embedMatch = url.pathname.match(
        /^\/embed\/([a-zA-Z0-9_-]{11})/
      );

      if (embedMatch?.[1]) return embedMatch[1];

      const shortsMatch = url.pathname.match(
        /^\/shorts\/([a-zA-Z0-9_-]{11})/
      );

      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}