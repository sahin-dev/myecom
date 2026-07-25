import {
  Clock3,
  HeartHandshake,
  Mail,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Truck
} from "lucide-react";
import { fallbackCatalog } from "../lib/catalog";
import { PageFooter, PageHeader } from "./PageChrome";

const pages = {
  about: {
    eyebrow: "Our story",
    title: "A more thoughtful pantry shop",
    intro: "My Ecom brings useful groceries, clear product information, and dependable delivery into one calm shopping experience.",
    icon: <HeartHandshake />,
    points: [
      ["Carefully selected", "We prioritize useful products, transparent details, and reliable availability."],
      ["Built for real routines", "The store is organized around how households actually refill a pantry."],
      ["Clear from cart to door", "Checkout, notifications, and tracking stay understandable throughout."]
    ]
  },
  contact: {
    eyebrow: "Talk to us",
    title: "Help is close by",
    intro: "Questions about an order, product, or delivery? Reach our support team and include your order number when available.",
    icon: <Mail />,
    points: [
      ["Email", "support@myecom.local"],
      ["Phone", "+880 1700 000 000"],
      ["Hours", "Saturday-Thursday, 9:00 AM-8:00 PM"]
    ]
  },
  delivery: {
    eyebrow: "Delivery",
    title: "From our pantry to yours",
    intro: "Orders are checked, packed, and handed to delivery partners with status updates at every major step.",
    icon: <Truck />,
    points: [
      ["Dhaka delivery", "Most orders arrive within 1-2 business days."],
      ["Delivery fee", "Free over \u09F33,000; otherwise \u09F380."],
      ["Tracking", "Use your order number and checkout email on the tracking page."]
    ]
  },
  returns: {
    eyebrow: "Returns",
    title: "Simple help when something is wrong",
    intro: "If an item arrives damaged, incorrect, or unusable, contact us promptly so we can review it.",
    icon: <RefreshCcw />,
    points: [
      ["Report quickly", "Contact support within 48 hours of delivery."],
      ["Keep the packaging", "Photos of the item and original package help us resolve issues."],
      ["Resolution", "Eligible cases receive a replacement, store credit, or refund."]
    ]
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Your information stays purposeful",
    intro: "We collect only the account, order, and delivery information required to operate the store.",
    icon: <ShieldCheck />,
    points: [
      ["Account security", "Passwords are hashed and authentication uses time-limited signed tokens."],
      ["Order information", "Delivery details are used to fulfil and support your purchase."],
      ["Your control", "You may request account corrections or deletion through support."]
    ]
  },
  terms: {
    eyebrow: "Terms",
    title: "Clear expectations for every order",
    intro: "Using My Ecom means providing accurate checkout information and following the store policies listed here.",
    icon: <PackageCheck />,
    points: [
      ["Availability", "Inventory and delivery estimates may change before an order is confirmed."],
      ["Pricing", "The checkout total shown when an order is placed is the applicable amount."],
      ["Responsible use", "Accounts and admin tools must not be accessed without permission."]
    ]
  }
} as const;

export type InfoPageSlug = keyof typeof pages;

export function InfoPage({ page }: { page: InfoPageSlug }) {
  const content = pages[page];

  return (
    <main>
      <PageHeader categories={fallbackCatalog.categories} />
      <section className="info-hero">
        <img src="/images/packing-story.png" alt="Pantry essentials prepared for delivery" />
        <div>
          <span className="info-icon">{content.icon}</span>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </div>
      </section>
      <section className="info-points">
        {content.points.map(([title, text], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="info-cta">
        <Clock3 size={22} />
        <div>
          <strong>Still need help?</strong>
          <span>Our support team can look into your question.</span>
        </div>
        <a className="primary-action" href="/contact">Contact support</a>
      </section>
      <PageFooter categories={fallbackCatalog.categories} />
    </main>
  );
}
