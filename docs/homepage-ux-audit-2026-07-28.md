# Homepage UX Audit

Date: 2026-07-28  
Page: `http://localhost:3000/`  
Scope: Homepage hierarchy, shopping journeys, responsive behavior, accessibility, content architecture, and perceived performance.

## Executive Summary

The homepage has a strong ecommerce foundation: search is prominent, products expose useful buying information, category and product data are dynamic, and mobile navigation exists. The primary weakness is not missing functionality. It is that too many discovery mechanisms compete for attention.

The best redesign direction is a quieter, task-led homepage:

1. Help customers find a product immediately.
2. Offer one clear category route.
3. Show a concise best-seller collection.
4. Present one meaningful promotion.
5. Provide genuinely distinct new or trending products.
6. Close with trust evidence and customer reviews.

The highest-value work is performance optimization, carousel accessibility, removing repeated navigation, and correcting product-section overlap.

## Current Page Snapshot

- 4 hero campaigns.
- 8 categories, including one empty category.
- 13 products are eligible for the current popular rail.
- Only 2 products remain in the New arrivals view after cross-section deduplication.
- Only 3 products remain in the Trending view.
- 4 brands, 1 featured review, and 4 testimonials.
- Server-rendered HTML is approximately 214-215 KB in the development environment.
- The homepage catalog response is approximately 89 KB.
- The 4 hero PNG files total approximately 8.0 MB.
- The rendered page contains 58 buttons, 79 links, and 4 `h1` elements.

## What Already Works

### Product Finding

- Search is centrally positioned and supports products, categories, recent searches, and keyboard arrows.
- The category navigation remains available while scrolling.
- Product cards expose price, savings, stock, delivery, reviews, wishlist, and cart actions.
- Product images are lazy-loaded below the hero.
- Variant selection uses an accessible modal pattern instead of expanding the product rail.

### Shopping Confidence

- The trust strip communicates selection quality, delivery, and order tracking.
- Stock levels and delivery estimates appear before a customer opens a product.
- Verified customer reviews and product-specific review links provide useful social proof.
- Cart, saved products, account, and tracking are reachable from the global navigation.

### Responsive Foundation

- Product, category, brand, and review rails adapt their item width.
- A dedicated mobile bottom navigation is available.
- The quick-option selector becomes a bottom sheet on small screens.
- Reduced-motion CSS removes carousel animations.

## Priority Findings

### P1: Hero Media Is Too Expensive

All four hero images are rendered as ordinary eager `<img>` elements. Their current PNG sizes are approximately 1.9-2.1 MB each, for roughly 8 MB before product imagery. Only one campaign is visible, but all four are requested.

Impact:

- Slower first meaningful paint, especially on mobile data.
- Higher bandwidth cost.
- Greater chance that the hero appears late or changes after loading.

Recommendation:

- Deliver WebP or AVIF versions with responsive `srcset` sizes.
- Load only the active hero eagerly.
- Preload the first hero and lazy-load the next campaign after the page becomes interactive.
- Set explicit image dimensions or aspect ratio to prevent layout movement.
- Target a first hero asset below 250 KB on mobile and below 450 KB on desktop.

Code reference: `apps/web/components/Storefront.tsx:188`

### P1: Carousel Semantics and Keyboard Focus Need Correction

Every campaign renders an `h1` and two links. Inactive slides use `aria-hidden` and `pointer-events: none`, but their links can remain in the keyboard tab order. The page therefore renders four top-level headings and can expose invisible focus targets.

Impact:

- Keyboard users may tab into content they cannot see.
- The document hierarchy is noisy for assistive technology and search engines.
- Automatic content changes can interrupt reading.

Recommendation:

- Render only the active campaign content, or apply `inert` to inactive slides.
- Keep one stable page `h1`; use lower-level headings for subsequent campaign content.
- Pause rotation while the hero contains keyboard focus or pointer hover.
- Disable automatic rotation when `prefers-reduced-motion` is enabled.
- Announce user-initiated slide changes without announcing every automatic change.

Code reference: `apps/web/components/Storefront.tsx:201`

### P1: Product Collections Compete With Each Other

The popular collection combines top sellers with the full Just for you list. The discovery collection then removes every product already used by popular. With current data, Popular can show 13 products while New arrivals has only 2 and Trending has only 3.

Impact:

- The page becomes top-heavy.
- Later sections look incomplete.
- New and trending headings promise more variety than they deliver.
- Long rails increase browsing effort without improving choice quality.

Recommendation:

- Limit Popular to 6-8 true best sellers.
- Keep personalized products in a separate For you collection when customer data supports it.
- Let New arrivals and Trending use their own ranked datasets.
- Deduplicate only within a collection, not across the entire homepage.
- Hide any collection with fewer than 4 useful products or replace it with a compact editorial feature.

Code reference: `apps/web/components/Storefront.tsx:99`

### P1: Mobile Navigation Is Duplicated

On mobile, the header can show Shop, Track, Account, Saved, and Cart icons while the bottom navigation repeats Home, Shop, Saved, Account, and Cart. A category navigation row is also present.

Impact:

- The first viewport is dominated by navigation.
- Duplicate controls create visual noise without adding capability.
- Small screens have less room for search and actual products.

Recommendation:

- Keep only logo, search, and cart in the mobile header.
- Keep Home, Shop, Saved, Account, and Cart in the bottom navigation.
- Move Track order into Account and the cart drawer, or replace a lower-priority bottom item if usage data supports it.
- Use a single category entry point on mobile rather than a persistent extra row.

Code reference: `apps/web/components/PageChrome.tsx:45`

### P2: The Homepage Repeats Category Discovery

Customers encounter global category navigation, a category rail, and a selected-category product shelf. The category-showcase configuration exists as a separate admin section, but its title and subtitle are not displayed.

Impact:

- The page repeats the same decision in different visual forms.
- Admin configuration does not fully match customer-visible content.
- Empty categories such as Rice appear as disabled controls.

Recommendation:

- Use one compact category grid or rail near the top.
- Follow it directly with products from the selected category only if data shows customers use category previews.
- Otherwise, send category choices directly to filtered shop results.
- Hide empty categories instead of rendering disabled cards.
- Either display the category-showcase title/subtitle or remove the redundant configuration.

Code reference: `apps/web/components/Storefront.tsx:287`

### P2: Product Cards Carry Too Much Information

Cards can show a badge, brand, title, price, compare price, saving percentage, rating count, stock status, delivery estimate, wishlist, and one or two purchase controls.

Impact:

- Scanning becomes slower.
- Product name and price lose visual priority.
- Repeated delivery text adds vertical noise to every card.

Recommendation:

- Prioritize image, name, effective price, rating, and one purchase action.
- Show urgent stock messaging only when stock is low.
- Move the standard delivery promise to the section heading or trust strip.
- Keep savings as one restrained label rather than showing both compare price and percentage when space is tight.
- Preserve fixed card dimensions so selecting a variant never changes rail height.

Code reference: `apps/web/components/Storefront.tsx:544`

### P2: Add-to-Cart Feedback Is Easy to Miss

Adding a simple product updates the cart count and floating cart, but there is no dedicated success announcement or inline confirmation. Screen-reader users do not receive an add-to-cart status update.

Recommendation:

- Show a short non-blocking confirmation with product name and quantity.
- Add an `aria-live="polite"` status region.
- Avoid automatically opening the drawer after every add.
- On desktop, choose either the header cart or floating cart as the dominant persistent cart control.

Code reference: `apps/web/components/CartContext.tsx:216`

### P2: Search Accessibility Is Incomplete

The predictive search relies on placeholder text without a persistent label. It uses `role="combobox"` but does not expose listbox/option roles or `aria-activedescendant` for the highlighted result.

Recommendation:

- Add an accessible label such as `aria-label="Search products"`.
- Implement the complete combobox/listbox relationship.
- Associate the active suggestion through `aria-activedescendant`.
- Announce loading and no-result states politely.

Code reference: `apps/web/components/SearchAutocomplete.tsx:88`

### P2: The Mobile Hero Delays Shopping

The mobile hero is 610-640 px tall before accounting for the announcement, two-row header, and category navigation. Customers may see no product or category content in the first viewport.

Recommendation:

- Reduce mobile hero height to roughly 440-500 px.
- Use one primary action and one subtle secondary link.
- Leave a visible hint of the category section below the hero.
- Prefer a stable campaign over rotation on narrow screens.

### P3: Metadata Is Generic

The homepage description is “A calm, modern ecommerce experience with order tracking.” No canonical URL or Open Graph image was found in the rendered homepage metadata.

Recommendation:

- Describe the actual pantry/grocery offer and service area.
- Add canonical, Open Graph, and social-sharing metadata.
- Use the brand and retail category in the homepage title and description.

Code reference: `apps/web/app/layout.tsx:20`

## Recommended Homepage Structure

1. Announcement: one short delivery or promotion message.
2. Header: brand, prominent search, account/saved/cart on desktop.
3. Hero: one campaign, one primary CTA, one category shortcut.
4. Category navigator: 6-8 active categories, no empty states.
5. Best sellers: 6-8 products, preferably a visible grid on desktop.
6. Promotional feature: one bundle or seasonal offer with the real product image.
7. New or trending: one tabbed collection with at least 4 distinct products per tab.
8. Trust strip: delivery, quality, returns, and order visibility.
9. Customer reviews: 3 concise verified reviews with linked products.
10. Brands and footer: compact brand links followed by support information.

For signed-in returning customers, place Buy again above Best sellers when order history exists.

## Visual Direction

- Keep the restrained operational ecommerce character.
- Use product photography and category imagery to carry visual interest.
- Reduce the amount of beige-filled UI and reserve blue for active states and links.
- Use fewer, stronger section boundaries instead of giving every content group equal visual weight.
- Keep heading sizes fixed by breakpoint instead of scaling continuously with viewport width.
- On desktop, use grids for the first 6-8 products and rails only when browsing beyond that set.
- On touch devices, prioritize swipe with a visible next-card preview; remove persistent left/right arrow columns.

## Delivery Plan

### Phase 1: Journey and Performance

- Correct carousel focus and heading behavior.
- Optimize hero images and avoid loading all campaigns eagerly.
- Remove the duplicate client catalog request after server rendering.
- Rebalance product collection queries.
- Hide empty categories.

### Phase 2: Information Architecture

- Consolidate category discovery.
- Simplify product-card content.
- Reduce mobile navigation duplication.
- Shorten the mobile hero.
- Add clear add-to-cart feedback.

### Phase 3: Refinement

- Complete search combobox semantics.
- Improve homepage metadata.
- Add returning-customer Buy again content.
- Run desktop/mobile visual regression and keyboard testing.

## Success Metrics

- Hero transfer size below 500 KB on desktop and 300 KB on mobile.
- Largest Contentful Paint below 2.5 seconds on a representative mobile connection.
- At least 4 distinct products in every visible discovery collection.
- Increased search usage, category click-through, and product-card click-through.
- Reduced homepage exit rate before the first product interaction.
- Improved add-to-cart completion and fewer repeated add clicks.
- No invisible keyboard focus targets and one meaningful homepage `h1`.

## Validation Notes

The running page and catalog API were inspected successfully. The in-app visual browser was unavailable during this audit, so viewport screenshots, layout overlap checks, color-contrast measurements, and real-device touch behavior remain required before implementation is considered complete.
