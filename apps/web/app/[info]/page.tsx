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

export function generateMetadata({ params }: { params: { info: string } }): Metadata {
  return { title: pageTitles[params.info] ?? "Information" };
}

export default function InformationRoute({ params }: { params: { info: string } }) {
  if (!pages.includes(params.info)) notFound();
  return <InfoPage page={params.info as InfoPageSlug} />;
}
