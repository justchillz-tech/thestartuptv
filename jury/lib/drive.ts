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
