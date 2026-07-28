import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage, InfoPageSlug } from "../../components/InfoPage";
import { InfoPageContent } from "../../lib/catalog";

const pages = ["about", "contact", "delivery", "returns", "privacy", "terms"];
const pageTitles: Record<string, string> = {
  about: "About us",
  contact: "Contact us",
  delivery: "Delivery information",
  returns: "Returns and refunds",
  privacy: "Privacy policy",
  terms: "Terms and conditions"
};

export const dynamic = "force-dynamic";

async function infoPageContent(slug: string): Promise<InfoPageContent | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiBase}/api/catalog/info-pages`, { cache: "no-store" });
    if (!response.ok) return null;
    const all = (await response.json()) as InfoPageContent[];
    return all.find((page) => page.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ info: string }> }
): Promise<Metadata> {
  const { info } = await params;
  return { title: pageTitles[info] ?? "Information" };
}

export default async function InformationRoute(
  { params }: { params: Promise<{ info: string }> }
) {
  const { info } = await params;
  if (!pages.includes(info)) notFound();
  const content = await infoPageContent(info);
  return <InfoPage page={info as InfoPageSlug} content={content} />;
}
