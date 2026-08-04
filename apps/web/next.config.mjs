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
  ...(cdnHost ? [{ protocol: "https", hostname: cdnHost }] : [])
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
