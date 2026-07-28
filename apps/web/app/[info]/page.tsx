import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage, InfoPageSlug } from "../../components/InfoPage";

const pages = ["about", "contact", "delivery", "returns", "privacy", "terms"];
const pageTitles: Record<string, string> = {
  about: "About us",
  contact: "Contact us",
  delivery: "Delivery information",
  returns: "Returns and refunds",
  privacy: "Privacy policy",
  terms: "Terms and conditions"
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ info: string }>;
}): Promise<Metadata> {
  const { info } = await params;
  return { title: pageTitles[info] ?? "Information" };
}

export default async function InformationRoute({
  params
}: {
  params: Promise<{ info: string }>;
}) {
  const { info } = await params;
  if (!pages.includes(info)) notFound();
  return <InfoPage page={info as InfoPageSlug} />;
}
