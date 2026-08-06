import createNextIntlPlugin from "next-intl/plugin";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * Cloudflare-hosted media. Kept as an explicit allowlist rather than opening
 * `hostname: "**"` to every path — that would turn the image optimiser into a
 * resizing proxy for arbitrary origins.
 *
 * Set NEXT_PUBLIC_CDN_HOST to add an R2 custom domain (e.g. cdn.example.com)
 * without editing this file.
 */
const cdnHost = process.env.NEXT_PUBLIC_CDN_HOST?.trim();
const cloudflarePatterns = [
  // R2 public buckets
  { protocol: "https", hostname: "**.r2.dev" },
  // Cloudflare Images
  { protocol: "https", hostname: "imagedelivery.net" },
  // Cloudflare Stream thumbnails and MP4 downloads
  { protocol: "https", hostname: "**.cloudflarestream.com" },
  { protocol: "https", hostname: "videodelivery.net" },
  ...(cdnHost ? [{ protocol: "https", hostname: cdnHost }] : []),

  /*
   * Consumer storage services, for merchants without a CDN. Share links are
   * rewritten to their direct-file form on save (see api/ecommerce/media-url),
   * so these are the hosts those rewritten URLs actually resolve to.
   */
  { protocol: "https", hostname: "drive.google.com" },
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  { protocol: "https", hostname: "**.dropbox.com" },
  { protocol: "https", hostname: "**.dropboxusercontent.com" },
  { protocol: "https", hostname: "raw.githubusercontent.com" },
  { protocol: "https", hostname: "cdn.jsdelivr.net" },
  { protocol: "https", hostname: "i.imgur.com" },
  { protocol: "https", hostname: "**.cloudinary.com" },
  { protocol: "https", hostname: "**.supabase.co" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`
      },
      {
        source: "/uploads/:path*",
        destination: `${apiBase}/uploads/:path*`
      }
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**"
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "4000",
        pathname: "/uploads/**"
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/uploads/**"
      },
      ...cloudflarePatterns
    ]
  }
};

export default withNextIntl(nextConfig);
