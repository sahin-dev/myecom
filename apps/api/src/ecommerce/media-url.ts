/**
 * Turns "share" links from consumer storage services into direct-file URLs.
 *
 * People naturally paste the link the service's Share button gives them, but
 * that link is an HTML viewer page — a browser cannot render it inside <img>
 * or <video>. Each service exposes a different direct-file form; this maps the
 * common ones so the stored value is always something the browser can load.
 *
 * Normalisation happens on write, so the storefront never needs runtime logic
 * and every stored URL is already in its usable form.
 */

const DRIVE_ID = /(?:\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]{10,})/;

/** Google Drive can serve images, but has no dependable direct video stream. */
export function isGoogleDrive(url: string) {
  return /^https:\/\/(drive|docs)\.google\.com\//i.test(url.trim());
}

export function normalizeMediaUrl(value: string, kind: "image" | "video" = "image") {
  const url = value.trim();
  if (!url) return url;

  // --- Google Drive -------------------------------------------------------
  // The thumbnail endpoint returns image bytes and tolerates hotlinking. The
  // older `uc?export=view` form is left alone because Google now serves an
  // interstitial for larger files rather than the image.
  if (isGoogleDrive(url) && kind === "image") {
    const id = url.match(DRIVE_ID)?.[1];
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
    return url;
  }

  // --- Dropbox ------------------------------------------------------------
  // ?dl=0 renders the preview page; raw=1 streams the file itself.
  if (/^https:\/\/(www\.)?dropbox\.com\//i.test(url)) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete("dl");
      parsed.searchParams.set("raw", "1");
      return parsed.toString();
    } catch {
      return url;
    }
  }

  // --- GitHub -------------------------------------------------------------
  // blob/ is the code viewer; raw.githubusercontent.com is the file.
  const github = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
  if (github) {
    return `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}`;
  }

  return url;
}
