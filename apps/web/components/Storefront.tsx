"use client";

import Image from "next/image";
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
import { useLocale, useTranslations } from "next-intl";
import {
  Catalog,
  Category,
  Product,
  ProductVariant,
  fallbackCatalog,
  fetchAccountOrders,
  formatMoney,
  selectableProductInventory,
  resolveMediaUrl
} from "../lib/catalog";
import { AppLocale, localeCode, localizeCatalog } from "../lib/i18n";
import { useCart } from "./CartContext";
import { useAuth } from "./AuthContext";
import { HorizontalRail } from "./HorizontalRail";
import { PageFooter, PageHeader } from "./PageChrome";
import { ProductArt } from "./ProductArt";
import { ProductVideo } from "./ProductVideo";
import { QuickVariantAdd } from "./QuickVariantAdd";
import { AdvancePaymentBadge } from "./AdvancePaymentBadge";
import { RatingStars } from "./RatingStars";
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
  const locale = useLocale() as AppLocale;
  const t = useTranslations("HomePage");
  const catalog = useMemo(
    () => localizeCatalog(initialCatalog, locale),
    [initialCatalog, locale],
  );
  const [activeBanner, setActiveBanner] = useState(0);
  const [previousBanner, setPreviousBanner] = useState<number | null>(null);
  const [bannerDirection, setBannerDirection] = useState<SlideDirection>("next");
  const [bannerPaused, setBannerPaused] = useState(false);
  const [bannerInteractionPaused, setBannerInteractionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [shelf, setShelf] = useState<Shelf>("new");
  const [buyAgainProducts, setBuyAgainProducts] = useState<Product[]>([]);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
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
    if (
      bannerPaused ||
      bannerInteractionPaused ||
      prefersReducedMotion ||
      campaigns.length < 2
    ) return;
    const timer = window.setInterval(() => {
      setBannerDirection("next");
      setActiveBanner((current) => {
        setPreviousBanner(current);
        return (current + 1) % campaigns.length;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [bannerInteractionPaused, bannerPaused, campaigns.length, prefersReducedMotion]);

  const popularProducts = useMemo(() => {
    return uniqueProducts([...catalog.topSellingProducts, ...catalog.justForYou]).slice(0, 8);
  }, [catalog.justForYou, catalog.topSellingProducts]);

  const categoryEntries = useMemo(
    () => catalog.categoryShowcase.filter(
      (entry) => entry.category.isActive !== false && entry.products.length > 0
    ),
    [catalog.categoryShowcase]
  );
  const activeBrands = useMemo(
    () => catalog.brands.filter((item) => item.isActive !== false),
    [catalog.brands]
  );
  const catalogProducts = useMemo(
    () => uniqueProducts(catalog.categoryShowcase.flatMap((entry) => entry.products)),
    [catalog.categoryShowcase]
  );

  useEffect(() => {
    if (!user) {
      setBuyAgainProducts([]);
      return;
    }

    setBuyAgainProducts([]);
    let active = true;
    void fetchAccountOrders()
      .then((orders) => {
        if (!active) return;
        const productsById = new Map(catalogProducts.map((product) => [product.id, product]));
        const previousProducts = orders
          .filter((order) => order.status !== "CANCELLED")
          .slice()
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .flatMap((order) => order.items)
          .map((item) => productsById.get(item.productId))
          .filter((product): product is Product => Boolean(product));
        setBuyAgainProducts(uniqueProducts(previousProducts).slice(0, 4));
      })
      .catch(() => {
        if (active) setBuyAgainProducts([]);
      });

    return () => {
      active = false;
    };
  }, [catalogProducts, user?.id]);
  const discoveryProducts = useMemo(() => {
    const primary = shelf === "new" ? catalog.newlyLaunched : catalog.trendingProducts;
    return uniqueProducts([...primary, ...catalog.justForYou])
      .slice(0, 8);
  }, [
    catalog.justForYou,
    catalog.newlyLaunched,
    catalog.trendingProducts,
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
  const brandSection = section("brands");
  const testimonialSection = section("testimonials");
  const customerStories = (catalog.testimonials ?? []).filter((item) => item.isActive);
  const visibleFeaturedReviews = catalog.featuredReviews.slice(0, 3);
  const visibleCustomerStories = customerStories.slice(
    0,
    Math.max(0, 3 - visibleFeaturedReviews.length)
  );
  const activeCampaign = campaigns[activeBanner] ?? campaigns[0];

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
        onMouseEnter={() => setBannerInteractionPaused(true)}
        onMouseLeave={() => setBannerInteractionPaused(false)}
        onFocusCapture={() => setBannerInteractionPaused(true)}
        onBlurCapture={() => setBannerInteractionPaused(false)}
      >
        <div className="modern-hero-media" aria-hidden="true">
          {campaigns.map((campaign, index) => (
            index === activeBanner || index === previousBanner ? (
            <Image
              key={campaign.id}
              className={[
                "modern-hero-image",
                index === activeBanner ? `active slide-${bannerDirection}` : "",
                index === previousBanner ? `exiting exit-${bannerDirection}` : ""
              ].filter(Boolean).join(" ")}
              src={campaign.imageUrl ?? "/images/grocery-hero.png"}
              fill
              sizes="100vw"
              priority={index === activeBanner}
              alt=""
              style={{
                objectPosition: `${campaign.focalX ?? 50}% ${campaign.focalY ?? 50}%`
              } as CSSProperties}
            />
            ) : null
          ))}
        </div>
        <div className="modern-hero-copy">
          <div className="modern-hero-content-stage">
            {activeCampaign ? (
              <div
                className={`modern-hero-content active content-${bannerDirection}`}
                key={activeCampaign.id}
              >
                <p className="eyebrow">{activeCampaign.eyebrow ?? "Everyday pantry market"}</p>
                <h1 id="hero-title">{activeCampaign.title}</h1>
                <p>{activeCampaign.subtitle}</p>
                <div className="modern-hero-actions">
                  <Link className="primary-action" href={campaignHref(activeCampaign.ctaHref)}>
                    {activeCampaign.ctaLabel}
                    <ArrowRight size={18} />
                  </Link>
                  <Link className="text-link" href={categorySection ? "#categories" : "/shop"}>
                    {t("browseCategories")}
                    <ChevronRight size={17} />
                  </Link>
                </div>
              </div>
            ) : null}
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

      {categorySection ? <section className="modern-category-section" id="categories">
        <SectionHeading
          eyebrow={categorySection.eyebrow ?? "Browse the pantry"}
          title={categorySection.title}
          text={categorySection.subtitle ?? undefined}
          action={categorySection.ctaLabel && categorySection.ctaHref ? { label: categorySection.ctaLabel, href: categorySection.ctaHref } : undefined}
        />
        <div className="modern-category-grid">
          {categoryEntries.map((entry) => (
            <Link
              href={`/shop?category=${entry.category.slug}`}
              key={entry.category.id}
            >
              <CategoryIcon category={entry.category} />
              <span>
                <strong>{entry.category.name}</strong>
                <small>{t("products", { count: entry.totalProducts })}</small>
              </span>
              <ChevronRight size={17} />
            </Link>
          ))}
          <Link className="modern-category-all" href="/shop">
            <span><strong>{t("shopAll")}</strong><small>{t("fullPantry")}</small></span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section> : null}

      {buyAgainProducts.length ? (
        <section className="modern-product-section buy-again-section" aria-labelledby="buy-again-title">
          <div className="modern-section-heading">
            <div>
              <p className="eyebrow">{t("welcomeBack")}</p>
              <h2 id="buy-again-title">{t("buyAgain")}</h2>
              <p>{t("buyAgainDetail")}</p>
            </div>
            <Link href="/account">{t("orderHistory")} <ArrowRight size={16} /></Link>
          </div>
          <div className="modern-product-grid" aria-label="Products from recent orders">
            {buyAgainProducts.map((product) => (
              <ProductCard key={product.id} product={product} platformPolicy={catalog.siteSettings.checkoutPolicy} onAdd={() => addItem(product)} />
            ))}
          </div>
        </section>
      ) : null}

      {popularSection ? <section className="modern-product-section" id="popular">
        <SectionHeading
          eyebrow={t("bestSellers")}
          title={popularSection.title}
          text={popularSection.subtitle ?? undefined}
          action={popularSection.ctaLabel && popularSection.ctaHref ? { label: popularSection.ctaLabel, href: popularSection.ctaHref } : undefined}
        />
        <div className="modern-product-grid" aria-label="Best selling products">
          {popularProducts.slice(0, Math.min(Math.max(popularSection.productLimit || 8, 6), 8)).map((product) => (
            <ProductCard key={product.id} product={product} platformPolicy={catalog.siteSettings.checkoutPolicy} onAdd={() => addItem(product)} />
          ))}
        </div>
      </section> : null}

      {combo && comboSection ? (
        <section className="modern-promo" id="combo-deals">
          <div className="modern-promo-copy">
            <p className="eyebrow">{comboSection.eyebrow ?? t("bundle")}</p>
            <h2>{comboSection.title}</h2>
            <p>{comboSection.subtitle}</p>
            <Link className="primary-action" href="/combo-deals">
              {comboSection.ctaLabel ?? t("combo")}
              <ArrowRight size={18} />
            </Link>
          </div>
          <Link className="modern-promo-product" href={`/products/${combo.slug}`}>
            <ProductArt product={combo} />
            <span>
              <small>{combo.badge ?? t("comboOffer")}</small>
              <strong>{combo.name}</strong>
              <b>{formatMoney(combo.price, localeCode(locale))}</b>
            </span>
          </Link>
        </section>
      ) : null}

      {discoverSection ? <section className="modern-product-section" id="discover">
        <div className="modern-section-toolbar">
          <SectionHeading
            eyebrow={discoverSection.eyebrow ?? t("discover")}
            title={shelf === "new" ? discoverSection.title : t("trendingWeek")}
            text={discoverSection.subtitle ?? undefined}
          />
          <div className="modern-segmented" aria-label={t("collection")}>
            <button className={shelf === "new" ? "active" : ""} type="button" onClick={() => setShelf("new")}>
              {t("newArrivals")}
            </button>
            <button className={shelf === "trending" ? "active" : ""} type="button" onClick={() => setShelf("trending")}>
              {t("trending")}
            </button>
          </div>
        </div>
        <div className="modern-product-grid" key={shelf} aria-label={shelf === "new" ? t("newProducts") : t("trendingProducts")}>
          {discoveryProducts.slice(0, Math.min(Math.max(discoverSection.productLimit || 8, 4), 8)).map((product) => (
            <ProductCard key={product.id} product={product} platformPolicy={catalog.siteSettings.checkoutPolicy} onAdd={() => addItem(product)} />
          ))}
        </div>
      </section> : null}

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
          <div className="modern-brand-grid" aria-label="Available brands">
            {activeBrands.map((brand) => {
              const logo = resolveMediaUrl(brand.logoUrl);
              return (
                <Link href={`/shop?brand=${brand.id}`} key={brand.id}>
                  {logo ? <img src={logo} alt={`${brand.name} logo`} /> : <BadgeCheck size={22} />}
                  <strong>{brand.name}</strong>
                  <ChevronRight size={16} />
                </Link>
              );
            })}
          </div>
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
            {visibleFeaturedReviews.map((review) => {
              const avatar = resolveMediaUrl(review.user?.avatarUrl);
              return (
                <article className="modern-review-card customer" key={review.id}>
                  <div className="modern-review-score" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star size={15} key={index} fill={index < review.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <blockquote>{review.comment}</blockquote>
                  <footer>
                    {avatar ? <img src={avatar} alt="" /> : <BadgeCheck size={20} />}
                    <span>
                      <strong>{review.user?.name ?? "Customer"}</strong>
                      <small>{review.isVerified ? "Verified purchase" : "Customer review"}</small>
                    </span>
                  </footer>
                  {review.product ? <Link href={`/products/${review.product.slug}`}>{review.product.name}</Link> : null}
                </article>
              );
            })}
            {visibleCustomerStories.map((story) => {
              const avatar = resolveMediaUrl(story.avatarUrl);
              return (
                <article key={story.id}>
                  <div className="modern-review-score" aria-label={`${story.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star size={15} key={index} fill={index < story.rating ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <blockquote>{story.quote}</blockquote>
                  <footer>
                    {avatar ? <img src={avatar} alt="" /> : <BadgeCheck size={20} />}
                    <span><strong>{story.name}</strong><small>{story.role ?? "Customer"}</small></span>
                  </footer>
                </article>
              );
            })}
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
  platformPolicy,
  onAdd
}: {
  product: Product;
  platformPolicy?: Catalog["siteSettings"]["checkoutPolicy"];
  onAdd: () => void;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Product");
  const common = useTranslations("Common");
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
        <span>{product.badge || (product.isNew ? t("new") : product.category?.name ?? t("pantry"))}</span>
        <button type="button" onClick={() => toggle(product)} aria-label={saved ? `Remove ${product.name} from saved products` : `Save ${product.name}`}>
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Link className="modern-product-art" href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <ProductVideo src={product.videoUrl} poster={product.imageUrl} label={t("playPromo")}>
          <ProductArt product={product} />
        </ProductVideo>
      </Link>
      <div className="modern-product-meta">
        <small>{product.brand?.name ?? product.category?.name ?? "My Ecom"}</small>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <div className="price-row">
          <strong>{formatMoney(displayPrice, localeCode(locale))}</strong>
          {savings ? <em>Save {savings}%</em> : null}
        </div>
        <div className="product-card-facts">
          {product.reviewCount ? (
            <RatingStars
              rating={product.rating}
              count={product.reviewCount}
              countLabel={t("reviewCount", { count: product.reviewCount })}
              label={t("ratingReviews", { rating: product.rating ?? 0, count: product.reviewCount })}
              size={13}
            />
          ) : null}
          <span className={availableInventory <= 5 ? "low-stock" : ""}>
            {availableInventory > 5 ? common("inStock") : availableInventory > 0 ? t("onlyLeft", { count: availableInventory }) : common("outOfStock")}
          </span>
        </div>
      </div>
      <AdvancePaymentBadge product={product} policy={platformPolicy} />
      {product.variants?.length ? (
        <QuickVariantAdd product={product} onSelect={setSelectedVariant} />
      ) : (
        <button className="add-button full" type="button" disabled={!product.inventory} onClick={onAdd}>
          <ShoppingBag size={17} />
          {product.inventory ? t("addToBag") : common("outOfStock")}
        </button>
      )}
    </article>
  );
}
