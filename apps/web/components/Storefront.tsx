"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  ChevronRight,
  Clock3,
  Coffee,
  Droplets,
  Heart,
  Leaf,
  PackageCheck,
  Pause,
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Wheat
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Catalog,
  Category,
  Product,
  fallbackCatalog,
  fetchCatalog,
  formatMoney,
  resolveMediaUrl
} from "../lib/catalog";
import { useCart } from "./CartContext";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useWishlist } from "./WishlistContext";

type Shelf = "new" | "trending";

function uniqueProducts(products: Product[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

function campaignHref(href: string) {
  if (href === "#tracking") return "/track-order";
  if (href === "#newly-launched") return "#discover";
  if (href === "#checkout" || href === "#shop") return "/shop";
  if (href === "#top-selling") return "#popular";
  return href;
}

export function Storefront({ initialCatalog = fallbackCatalog }: { initialCatalog?: Catalog }) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [activeBanner, setActiveBanner] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const [shelf, setShelf] = useState<Shelf>("new");
  const { addItem } = useCart();

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(() => undefined);
  }, []);

  const campaigns = useMemo(() => {
    const source = catalog.banners.length ? catalog.banners : fallbackCatalog.banners;
    const fallbackImages = [
      "/images/grocery-hero.png",
      "/images/packing-story.png",
      "/images/auth-pantry.png"
    ];
    return source.map((item, index) => ({
      ...item,
      imageUrl: resolveMediaUrl(item.imageUrl) || fallbackImages[index % fallbackImages.length]
    }));
  }, [catalog.banners]);

  useEffect(() => {
    if (activeBanner >= campaigns.length) setActiveBanner(0);
  }, [activeBanner, campaigns.length]);

  useEffect(() => {
    if (bannerPaused || campaigns.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % campaigns.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [bannerPaused, campaigns.length]);

  const popularProducts = useMemo(() => {
    return uniqueProducts([...catalog.topSellingProducts, ...catalog.justForYou]).slice(0, 8);
  }, [catalog.justForYou, catalog.topSellingProducts]);

  const discoveryProducts = useMemo(() => {
    const used = new Set(popularProducts.map((product) => product.id));
    const primary = shelf === "new" ? catalog.newlyLaunched : catalog.trendingProducts;
    return uniqueProducts([...primary, ...catalog.justForYou])
      .filter((product) => !used.has(product.id))
      .slice(0, 4);
  }, [
    catalog.justForYou,
    catalog.newlyLaunched,
    catalog.trendingProducts,
    popularProducts,
    shelf
  ]);

  const banner = campaigns[activeBanner] ?? campaigns[0];
  const combo = catalog.comboDeals[0];
  const activeSections = useMemo(
    () => (catalog.homeSections ?? fallbackCatalog.homeSections)
      .filter((item) => item.isActive)
      .sort((a, b) => a.priority - b.priority),
    [catalog.homeSections]
  );
  const section = (key: string) => activeSections.find((item) => item.key === key);
  const trustSection = section("trust");
  const categorySection = section("categories");
  const popularSection = section("popular");
  const comboSection = section("combo");
  const discoverSection = section("discover");
  const categoryShowcaseSection = section("category-showcase");
  const brandSection = section("brands");
  const testimonialSection = section("testimonials");
  const customerStories = (catalog.testimonials ?? []).filter((item) => item.isActive);

  function moveBanner(direction: number) {
    setActiveBanner((current) =>
      (current + direction + campaigns.length) % campaigns.length
    );
  }

  return (
    <main className="home-page">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} home />

      <section
        className="modern-home-hero"
        aria-labelledby="hero-title"
      >
        <img
          className="modern-hero-image"
          src={banner.imageUrl ?? "/images/grocery-hero.png"}
          alt=""
        />
        <div className="modern-hero-copy">
          <p className="eyebrow">{banner.eyebrow ?? "Everyday pantry market"}</p>
          <h1 id="hero-title">{banner.title}</h1>
          <p>{banner.subtitle}</p>
          <div className="modern-hero-actions">
            <a className="primary-action" href={campaignHref(banner.ctaHref)}>
              {banner.ctaLabel}
              <ArrowRight size={18} />
            </a>
            <a className="text-link" href={categorySection ? "#categories" : "/shop"}>
              Browse categories
              <ChevronRight size={17} />
            </a>
          </div>
          {campaigns.length > 1 ? (
            <div className="modern-hero-controls" aria-label="Campaign controls">
              <button type="button" onClick={() => moveBanner(-1)} aria-label="Previous campaign">
                <ArrowLeft size={17} />
              </button>
              <div className="modern-hero-dots" aria-label="Choose campaign">
                {campaigns.map((campaign, index) => (
                  <button
                    key={campaign.id}
                    type="button"
                    className={index === activeBanner ? "active" : ""}
                    onClick={() => setActiveBanner(index)}
                    aria-label={`Show campaign ${index + 1}: ${campaign.title}`}
                    aria-current={index === activeBanner ? "true" : undefined}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setBannerPaused((current) => !current)}
                aria-label={bannerPaused ? "Play campaign slideshow" : "Pause campaign slideshow"}
              >
                {bannerPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button type="button" onClick={() => moveBanner(1)} aria-label="Next campaign">
                <ArrowRight size={17} />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {trustSection ? (
        <section className="modern-service-strip" aria-label="Store benefits">
          {(trustSection.metadata?.items ?? [
            { title: "Carefully selected", detail: "Everyday products from trusted suppliers" },
            { title: "Flexible delivery", detail: "Choose the method that fits your day" },
            { title: "Order visibility", detail: "Follow each step from packing to arrival" }
          ]).slice(0, 3).map((item, index) => (
            <ServiceItem
              key={item.title}
              icon={index === 0 ? <ShieldCheck size={20} /> : index === 1 ? <Truck size={20} /> : <PackageCheck size={20} />}
              title={item.title}
              text={item.detail}
            />
          ))}
        </section>
      ) : null}

      {categorySection ? <section className="modern-category-section" id="categories">
        <SectionHeading
          eyebrow={categorySection.eyebrow ?? "Browse the pantry"}
          title={categorySection.title}
          text={categorySection.subtitle ?? undefined}
          action={categorySection.ctaLabel && categorySection.ctaHref ? { label: categorySection.ctaLabel, href: categorySection.ctaHref } : undefined}
        />
        <div className="modern-category-grid">
          {catalog.categories.filter((item) => item.isActive !== false).map((category) => (
            <a href={`/shop?category=${category.slug}`} key={category.id}>
              <CategoryIcon category={category} />
              <span>
                <strong>{category.name}</strong>
                <small>Explore products</small>
              </span>
              <ChevronRight size={17} />
            </a>
          ))}
        </div>
      </section> : null}

      {popularSection ? <section className="modern-product-section" id="popular">
        <SectionHeading
          eyebrow="Best sellers"
          title={popularSection.title}
          text={popularSection.subtitle ?? undefined}
          action={popularSection.ctaLabel && popularSection.ctaHref ? { label: popularSection.ctaLabel, href: popularSection.ctaHref } : undefined}
        />
        <div className="modern-product-grid">
          {popularProducts.slice(0, popularSection.productLimit || 4).map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
          ))}
        </div>
      </section> : null}

      {combo && comboSection ? (
        <section className="modern-promo" id="combo-deals">
          <div className="modern-promo-copy">
            <p className="eyebrow">{comboSection.eyebrow ?? "Bundle and save"}</p>
            <h2>{comboSection.title}</h2>
            <p>{comboSection.subtitle}</p>
            <a className="primary-action" href={`/products/${combo.slug}`}>
              {comboSection.ctaLabel ?? `Explore ${combo.name}`}
              <ArrowRight size={18} />
            </a>
          </div>
          <a className="modern-promo-product" href={`/products/${combo.slug}`}>
            <ProductArt product={combo} />
            <span>
              <small>{combo.badge ?? "Combo offer"}</small>
              <strong>{combo.name}</strong>
              <b>{formatMoney(combo.price)}</b>
            </span>
          </a>
        </section>
      ) : null}

      {discoverSection ? <section className="modern-product-section" id="discover">
        <div className="modern-section-toolbar">
          <SectionHeading
            eyebrow={discoverSection.eyebrow ?? "Discover something useful"}
            title={shelf === "new" ? discoverSection.title : "Trending this week"}
            text={discoverSection.subtitle ?? undefined}
          />
          <div className="modern-segmented" aria-label="Product collection">
            <button className={shelf === "new" ? "active" : ""} type="button" onClick={() => setShelf("new")}>
              New arrivals
            </button>
            <button className={shelf === "trending" ? "active" : ""} type="button" onClick={() => setShelf("trending")}>
              Trending
            </button>
          </div>
        </div>
        <div className="modern-product-grid">
          {discoveryProducts.slice(0, discoverSection.productLimit || 8).map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
          ))}
        </div>
      </section> : null}

      {categoryShowcaseSection && catalog.categoryShowcase.length ? (
        <section className="home-category-showcase" id="all-categories">
          <SectionHeading
            eyebrow={categoryShowcaseSection.eyebrow ?? "A look through every aisle"}
            title={categoryShowcaseSection.title}
            text={categoryShowcaseSection.subtitle ?? undefined}
            action={categoryShowcaseSection.ctaLabel && categoryShowcaseSection.ctaHref
              ? { label: categoryShowcaseSection.ctaLabel, href: categoryShowcaseSection.ctaHref }
              : undefined}
          />
          <div className="home-category-shelves">
            {catalog.categoryShowcase
              .filter((entry) => entry.products.length)
              .map((entry) => (
                <section className="home-category-shelf" key={entry.category.id}>
                  <header>
                    <span><CategoryIcon category={entry.category} /></span>
                    <div>
                      <h3>{entry.category.name}</h3>
                      <p>{entry.totalProducts} {entry.totalProducts === 1 ? "product" : "products"} available</p>
                    </div>
                    <a href={`/shop?category=${entry.category.slug}`}>
                      View category <ArrowRight size={15} />
                    </a>
                  </header>
                  <div className="modern-product-grid category-preview-grid">
                    {entry.products
                      .slice(0, categoryShowcaseSection.productLimit || 4)
                      .map((product) => (
                        <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
                      ))}
                  </div>
                </section>
              ))}
          </div>
        </section>
      ) : null}

      {brandSection && catalog.brands.filter((item) => item.isActive !== false).length ? (
        <section className="modern-brand-section" id="brands">
          <div>
            <p className="eyebrow">{brandSection.eyebrow ?? "Trusted makers"}</p>
            <h2>{brandSection.title}</h2>
            <p>{brandSection.subtitle}</p>
          </div>
          <div className="modern-brand-grid">
            {catalog.brands.filter((item) => item.isActive !== false).slice(0, 6).map((brand) => (
              <a href={`/shop?brand=${brand.id}`} key={brand.id}>
                {brand.logoUrl ? <img src={brand.logoUrl} alt={`${brand.name} logo`} /> : <BadgeCheck size={22} />}
                <strong>{brand.name}</strong>
                <ChevronRight size={16} />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {testimonialSection && customerStories.length ? (
        <section className="modern-testimonial-section">
          <SectionHeading
            eyebrow={testimonialSection.eyebrow ?? "From our customers"}
            title={testimonialSection.title}
            text={testimonialSection.subtitle ?? undefined}
          />
          <div className="modern-testimonial-grid">
            {customerStories.map((story) => (
              <article key={story.id}>
                <div className="modern-review-score" aria-label={`${story.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star size={15} key={index} fill={index < story.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <blockquote>{story.quote}</blockquote>
                <footer>
                  {story.avatarUrl ? <img src={story.avatarUrl} alt="" /> : <BadgeCheck size={20} />}
                  <span><strong>{story.name}</strong><small>{story.role ?? "Customer"}</small></span>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <PageFooter categories={catalog.categories} siteSettings={catalog.siteSettings} />
    </main>
  );
}

function ServiceItem({
  icon,
  title,
  text
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      {icon}
      <span><strong>{title}</strong><small>{text}</small></span>
    </div>
  );
}

function CategoryIcon({ category }: { category: Category }) {
  const slug = category.slug;
  const icon =
    slug.includes("honey") || slug.includes("oil") ? <Droplets /> :
    slug.includes("rice") || slug.includes("flour") ? <Wheat /> :
    slug.includes("beverage") ? <Coffee /> :
    slug.includes("combo") ? <Boxes /> :
    slug.includes("date") ? <Clock3 /> :
    slug.includes("spice") ? <Sparkles /> :
    <Leaf />;
  return <span className="modern-category-icon">{icon}</span>;
}

function SectionHeading({
  eyebrow,
  title,
  text,
  action
}: {
  eyebrow: string;
  title: string;
  text?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="modern-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {action ? <a href={action.href}>{action.label}<ArrowRight size={16} /></a> : null}
    </div>
  );
}

function ProductCard({
  product,
  onAdd
}: {
  product: Product;
  onAdd: () => void;
}) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.slug);

  return (
    <article className="modern-product-card">
      <div className="modern-card-head">
        <span>{product.badge || (product.isNew ? "New" : product.category?.name ?? "Pantry")}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <a className="modern-product-art" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <ProductArt product={product} />
      </a>
      <div className="modern-product-meta">
        <small>{product.brand?.name ?? product.category?.name ?? "My Ecom"}</small>
        <h3><a href={`/products/${product.slug}`}>{product.name}</a></h3>
        <div className="price-row">
          <strong>{formatMoney(product.price)}</strong>
          {product.compareAt ? <small>{formatMoney(product.compareAt)}</small> : null}
        </div>
      </div>
      {product.variants?.length ? (
        <QuickVariantAdd product={product} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={onAdd}>
          <ShoppingBag size={17} />
          {product.inventory ? "Add to bag" : "Out of stock"}
        </button>
      )}
    </article>
  );
}
