# Ayat Hair Oil storefront

A responsive multi-page static storefront built with plain HTML, CSS, and JavaScript. No backend, datastore, authentication, or application API is used.

The site has dedicated Home, Products, Why Ayat, How to order, FAQs, and Contact pages. The homepage features a separate product card below the hero slideshow; the product page lists only the confirmed 150 ml bottle at PKR 1,200. Additional sizes and unconfirmed stock details are referred to Ayat rather than invented.

The supplied Ayat Hair Oil emblem is used in the header, footer, favicon, and social preview. The visual theme uses deep green-black surfaces, warm gold accents, and readable ivory text to complement the logo.

## Run locally

```sh
npm start
```

Open `http://localhost:4173`.

## Deploy to Vercel

Import the repository in Vercel and keep the project Root Directory at the repository root. The root `vercel.json` points Vercel to this static storefront's output directory; no build command is required. Deploy or redeploy the project, then open the deployment's root URL.

## Validate

```sh
npm test
```

## Configure production SEO

The local preview pages are intentionally `noindex, nofollow`, and its `robots.txt` blocks crawlers. Once the public domain is confirmed, configure the site using its HTTPS origin:

```sh
npm run configure-seo -- https://your-public-domain.com
```

The command rejects non-HTTPS, local, reserved placeholder, and non-root URLs. It updates canonical, Open Graph, Twitter, and JSON-LD URLs across all HTML pages, changes robots metadata to `index, follow`, and generates a sitemap containing each page plus a crawlable `robots.txt`. Re-run it if the production domain changes. Do not deploy the placeholder-domain preview as an indexable production site.

WhatsApp order links are embedded directly in the HTML, so the order CTA works before or without JavaScript. They open a prefilled message to the confirmed number `923455367679` and include the product name, bottle size, and confirmed price. Instagram is a secondary outbound link.

The hero is a full-width carousel built from all three supplied campaign photos. It displays each full 1800 × 900 composition without cropping, rotates every three seconds, and includes pause and manual navigation controls. Reduced-motion preferences disable autoplay.

The social preview, page surfaces, and accents use the original deep-green-and-gold theme. A fixed, subtle white "AYAT" wordmark sits behind page content.

The page uses system fonts, has no third-party runtime scripts or font requests, and keeps JavaScript deferred. Sticky surfaces use solid backgrounds instead of scroll-time backdrop blur.

Unknown ingredient, efficacy, delivery, payment, return, and review details are intentionally not stated as facts. FAQs direct customers to contact Ayat when details have not been confirmed. The customer-stories section does not publish fabricated testimonials.

The navigation collapses into a dropdown below 1000 px; the hero and content sections adapt for tablet and mobile layouts. Friendly directory URLs such as `/products/` are served using each section's `index.html`. The navigation and footer link every page together.

The site has no HTML form: ordering and enquiries are handled through direct WhatsApp and telephone links. The local preview server accepts only GET/HEAD requests, confines file access to the storefront directory, and returns basic browser security headers.
