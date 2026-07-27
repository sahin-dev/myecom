"use client";

import Link from "next/link";
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
import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Catalog,
  Category,
  Product,
  ProductVariant,
  fallbackCatalog,
  fetchCatalog,
  formatMoney,
  selectableProductInventory,
  resolveMediaUrl
} from "../lib/catalog";
import { useCart } from "./CartContext";
import { HorizontalRail } from "./HorizontalRail";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { useWishlist } from "./WishlistContext";

type Shelf = "new" | "trending";
type SlideDirection = "next" | "previous";

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
  const [previousBanner, setPreviousBanner] = useState<number | null>(null);
  const [bannerDirection, setBannerDirection] = useState<SlideDirection>("next");
  const [bannerPaused, setBannerPaused] = useState(false);
  const [shelf, setShelf] = useState<Shelf>("new");
  const [activeCategory, setActiveCategory] = useState(
    initialCatalog.categoryShowcase.find((entry) => entry.products.length)?.category.id ?? ""
  );
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
    if (previousBanner === null) return;
    const timer = window.setTimeout(() => setPreviousBanner(null), 950);
    return () => window.clearTimeout(timer);
  }, [activeBanner, previousBanner]);

  useEffect(() => {
    if (bannerPaused || campaigns.length < 2) return;
    const timer = window.setInterval(() => {
      setBannerDirection("next");
      setActiveBanner((current) => {
        setPreviousBanner(current);
        return (current + 1) % campaigns.length;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [bannerPaused, campaigns.length]);

  const popularProducts = useMemo(() => {
    return uniqueProducts([...catalog.topSellingProducts, ...catalog.justForYou]).slice(0, 16);
  }, [catalog.justForYou, catalog.topSellingProducts]);

  const categoryEntries = useMemo(
    () => catalog.categoryShowcase.filter((entry) => entry.category.isActive !== false),
    [catalog.categoryShowcase]
  );
  const activeBrands = useMemo(
    () => catalog.brands.filter((item) => item.isActive !== false),
    [catalog.brands]
  );
  const selectedCategory = categoryEntries.find(
    (entry) => entry.category.id === activeCategory && entry.products.length
  ) ?? categoryEntries.find((entry) => entry.products.length);

  useEffect(() => {
    if (!selectedCategory) return;
    if (selectedCategory.category.id !== activeCategory) {
      setActiveCategory(selectedCategory.category.id);
    }
  }, [activeCategory, selectedCategory]);

  const discoveryProducts = useMemo(() => {
    const used = new Set(popularProducts.map((product) => product.id));
    const primary = shelf === "new" ? catalog.newlyLaunched : catalog.trendingProducts;
    return uniqueProducts([...primary, ...catalog.justForYou])
      .filter((product) => !used.has(product.id))
      .slice(0, 16);
  }, [
    catalog.justForYou,
    catalog.newlyLaunched,
    catalog.trendingProducts,
    popularProducts,
    shelf
  ]);

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
    setBannerDirection(direction > 0 ? "next" : "previous");
    setActiveBanner((current) => {
      setPreviousBanner(current);
      return (current + direction + campaigns.length) % campaigns.length;
    });
  }

  function chooseBanner(index: number) {
    if (index === activeBanner) return;
    const forward = (index - activeBanner + campaigns.length) % campaigns.length;
    const backward = (activeBanner - index + campaigns.length) % campaigns.length;
    setBannerDirection(forward <= backward ? "next" : "previous");
    setPreviousBanner(activeBanner);
    setActiveBanner(index);
  }

  return (
    <main className="home-page">
      <PageHeader categories={catalog.categories} siteSettings={catalog.siteSettings} home />

      <section
        className="modern-home-hero"
        aria-labelledby="hero-title"
      >
        <div className="modern-hero-media" aria-hidden="true">
          {campaigns.map((campaign, index) => (
            <img
              key={campaign.id}
              className={[
                "modern-hero-image",
                index === activeBanner ? `active slide-${bannerDirection}` : "",
                index === previousBanner ? `exiting exit-${bannerDirection}` : ""
              ].filter(Boolean).join(" ")}
              src={campaign.imageUrl ?? "/images/grocery-hero.png"}
              alt=""
              style={{
                objectPosition: `${campaign.focalX ?? 50}% ${campaign.focalY ?? 50}%`
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="modern-hero-copy">
          <div className="modern-hero-content-stage">
            {campaigns.map((campaign, index) => (
              <div
                className={[
                  "modern-hero-content",
                  index === activeBanner ? `active content-${bannerDirection}` : "",
                  index === previousBanner ? `exiting content-exit-${bannerDirection}` : ""
                ].filter(Boolean).join(" ")}
                key={campaign.id}
                aria-hidden={index !== activeBanner}
              >
                <p className="eyebrow">{campaign.eyebrow ?? "Everyday pantry market"}</p>
                <h1 id={index === activeBanner ? "hero-title" : undefined}>{campaign.title}</h1>
                <p>{campaign.subtitle}</p>
                <div className="modern-hero-actions">
                  <Link className="primary-action" href={campaignHref(campaign.ctaHref)}>
                    {campaign.ctaLabel}
                    <ArrowRight size={18} />
                  </Link>
                  <Link className="text-link" href={categorySection ? "#categories" : "/shop"}>
                    Browse categories
                    <ChevronRight size={17} />
                  </Link>
                </div>
              </div>
            ))}
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
                    onClick={() => chooseBanner(index)}
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
        <HorizontalRail variant="categories" label="product categories">
          {categoryEntries.map((entry) => (
            <button
              className={`category-rail-item ${entry.category.id === selectedCategory?.category.id ? "active" : ""}`}
              type="button"
              role="tab"
              key={entry.category.id}
              disabled={!entry.products.length}
              aria-selected={entry.category.id === selectedCategory?.category.id}
              onClick={() => setActiveCategory(entry.category.id)}
            >
              <CategoryIcon category={entry.category} />
              <span>
                <strong>{entry.category.name}</strong>
                <small>{entry.totalProducts} products</small>
              </span>
            </button>
          ))}
        </HorizontalRail>
        {categoryShowcaseSection && selectedCategory ? (
          <section className="home-category-shelf" key={selectedCategory.category.id}>
            <header>
              <span><CategoryIcon category={selectedCategory.category} /></span>
              <div>
                <h3>{selectedCategory.category.name}</h3>
                <p>{selectedCategory.totalProducts} {selectedCategory.totalProducts === 1 ? "product" : "products"} available</p>
              </div>
              <Link href={`/shop?category=${selectedCategory.category.slug}`}>
                View category <ArrowRight size={15} />
              </Link>
            </header>
            <HorizontalRail variant="products" label={`${selectedCategory.category.name} products`}>
              {selectedCategory.products
                .slice(0, Math.min(Math.max(categoryShowcaseSection.productLimit || 8, 8), 12))
                .map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
                ))}
            </HorizontalRail>
          </section>
        ) : null}
      </section> : null}

      {popularSection ? <section className="modern-product-section" id="popular">
        <SectionHeading
          eyebrow="Best sellers"
          title={popularSection.title}
          text={popularSection.subtitle ?? undefined}
          action={popularSection.ctaLabel && popularSection.ctaHref ? { label: popularSection.ctaLabel, href: popularSection.ctaHref } : undefined}
        />
        <HorizontalRail variant="products" label="best selling products">
          {popularProducts.slice(0, Math.min(Math.max(popularSection.productLimit || 8, 8), 16)).map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
          ))}
        </HorizontalRail>
      </section> : null}

      {combo && comboSection ? (
        <section className="modern-promo" id="combo-deals">
          <div className="modern-promo-copy">
            <p className="eyebrow">{comboSection.eyebrow ?? "Bundle and save"}</p>
            <h2>{comboSection.title}</h2>
            <p>{comboSection.subtitle}</p>
            <Link className="primary-action" href="/combo-deals">
              {comboSection.ctaLabel ?? "Explore combo deals"}
              <ArrowRight size={18} />
            </Link>
          </div>
          <Link className="modern-promo-product" href={`/products/${combo.slug}`}>
            <ProductArt product={combo} />
            <span>
              <small>{combo.badge ?? "Combo offer"}</small>
              <strong>{combo.name}</strong>
              <b>{formatMoney(combo.price)}</b>
            </span>
          </Link>
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
        <HorizontalRail key={shelf} variant="products" label={shelf === "new" ? "new products" : "trending products"}>
          {discoveryProducts.slice(0, Math.min(Math.max(discoverSection.productLimit || 8, 8), 16)).map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
          ))}
        </HorizontalRail>
      </section> : null}

      {brandSection && activeBrands.length ? (
        <section className="modern-brand-section" id="brands">
          <div>
            <p className="eyebrow">{brandSection.eyebrow ?? "Trusted makers"}</p>
            <h2>{brandSection.title}</h2>
            <p>{brandSection.subtitle}</p>
            <Link className="modern-brand-all" href="/shop">
              Browse all {activeBrands.length} brands <ArrowRight size={15} />
            </Link>
          </div>
          <HorizontalRail variant="brands" label="available brands">
            {activeBrands.map((brand) => (
              <Link href={`/shop?brand=${brand.id}`} key={brand.id}>
                {brand.logoUrl ? <img src={brand.logoUrl} alt={`${brand.name} logo`} /> : <BadgeCheck size={22} />}
                <strong>{brand.name}</strong>
                <ChevronRight size={16} />
              </Link>
            ))}
          </HorizontalRail>
        </section>
      ) : null}

      {testimonialSection && (customerStories.length || catalog.featuredReviews.length) ? (
        <section className="modern-testimonial-section">
          <SectionHeading
            eyebrow={testimonialSection.eyebrow ?? "From our customers"}
            title={testimonialSection.title}
            text={testimonialSection.subtitle ?? undefined}
          />
          <HorizontalRail variant="reviews" label="customer reviews">
            {catalog.featuredReviews.map((review) => (
              <article className="modern-review-card customer" key={review.id}>
                <div className="modern-review-score" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star size={15} key={index} fill={index < review.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <blockquote>{review.comment}</blockquote>
                <footer>
                  {review.user?.avatarUrl ? <img src={review.user.avatarUrl} alt="" /> : <BadgeCheck size={20} />}
                  <span>
                    <strong>{review.user?.name ?? "Customer"}</strong>
                    <small>{review.isVerified ? "Verified purchase" : "Customer review"}</small>
                  </span>
                </footer>
                {review.product ? <Link href={`/products/${review.product.slug}`}>{review.product.name}</Link> : null}
              </article>
            ))}
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
          </HorizontalRail>
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
  const image = resolveMediaUrl(category.imageUrl);
  if (image) {
    return (
      <span className="modern-category-icon image">
        <img src={image} alt="" />
      </span>
    );
  }
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
      {action ? <Link href={action.href}>{action.label}<ArrowRight size={16} /></Link> : null}
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
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const saved = isSaved(product.slug);
  const availableInventory = selectedVariant
    ? selectedVariant.inventory
    : selectableProductInventory(product);
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayCompareAt = selectedVariant ? selectedVariant.compareAt : product.compareAt;
  const savings = displayCompareAt && displayCompareAt > displayPrice
    ? Math.round(((displayCompareAt - displayPrice) / displayCompareAt) * 100)
    : 0;

  return (
    <article className="modern-product-card">
      <div className="modern-card-head">
        <span>{product.badge || (product.isNew ? "New" : product.category?.name ?? "Pantry")}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Link className="modern-product-art" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <ProductArt product={product} />
      </Link>
      <div className="modern-product-meta">
        <small>{product.brand?.name ?? product.category?.name ?? "My Ecom"}</small>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <div className="price-row">
          <strong>{formatMoney(displayPrice)}</strong>
          {displayCompareAt ? <small>{formatMoney(displayCompareAt)}</small> : null}
          {savings ? <em>Save {savings}%</em> : null}
        </div>
        <div className="product-card-facts">
          {product.reviewCount ? <span><Star size={12} fill="currentColor" /> {product.rating?.toFixed(1)} ({product.reviewCount})</span> : null}
          <span className={availableInventory <= 5 ? "low-stock" : ""}>
            {availableInventory > 5 ? "In stock" : availableInventory > 0 ? `Only ${availableInventory} left` : "Out of stock"}
          </span>
          <span><Truck size={12} /> 1-2 day delivery</span>
        </div>
      </div>
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={onAdd}>
          <ShoppingBag size={17} />
          {product.inventory ? "Add to bag" : "Out of stock"}
        </button>
      )}
    </article>
  );
}
