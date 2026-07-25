import { notFound } from "next/navigation";
import { InfoPage, InfoPageSlug } from "../../components/InfoPage";

const pages = ["about", "contact", "delivery", "returns", "privacy", "terms"];

export default function InformationRoute({ params }: { params: { info: string } }) {
  if (!pages.includes(params.info)) notFound();
  return <InfoPage page={params.info as InfoPageSlug} />;
}
