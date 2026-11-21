"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { configureSeo, getRoute, validateOrigin } = require("../scripts/configure-seo.js");
const { createStorefrontServer, decodeRequestPath, resolveStaticFile } = require("../scripts/serve.js");

const root = path.join(__dirname, "..");
const pageRoutes = ["", "products", "why-ayat", "how-to-order", "faqs", "contact"];
const pages = pageRoutes.map((route) => {
  const filePath = route ? path.join(root, route, "index.html") : path.join(root, "index.html");
  return { route, filePath, html: fs.readFileSync(filePath, "utf8") };
});
const homeHtml = pages[0].html;
const allHtml = pages.map((page) => page.html).join("\n");
const css = fs.readFileSync(path.join(root, "styles", "styles.css"), "utf8");
const javascript = fs.readFileSync(path.join(root, "scripts", "main.js"), "utf8");

function makeRequest(port, requestPath, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port, path: requestPath, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function contrastRatio(foreground, background) {
  function luminance(color) {
    const channels = color.match(/[0-9a-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4));
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }

  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("shows all full hero images and rotates them accessibly", () => {
  const heroImages = [...homeHtml.matchAll(/<img\b[^>]*class="hero-slide-image"[^>]*>/g)].map(([image]) => image);
  assert.equal(heroImages.length, 3);
  for (const image of heroImages) {
    assert.match(image, /width="1800" height="900"/);
    assert.match(image, /\balt="[^"]+"/);
  }
  assert.match(heroImages[0], /fetchpriority="high"/);
  assert.match(heroImages[1], /fetchpriority="low"/);
  assert.match(heroImages[2], /fetchpriority="low"/);
  assert.match(homeHtml, /aria-roledescription="carousel"/);
  assert.match(homeHtml, /data-carousel-previous/);
  assert.match(homeHtml, /data-carousel-next/);
  assert.match(homeHtml, /data-carousel-pause/);
  assert.match(css, /\.hero-slide-image\s*\{[^}]*object-fit:\s*contain/);
  assert.match(javascript, /const rotationDelay = 3000;/);
  assert.match(javascript, /prefers-reduced-motion/);
  for (const name of ["ayat-hair-oil-hero.jpg", "ayat-hair-oil-hero-2.jpg", "ayat-hair-oil-hero-3.jpg"]) {
    assert.ok(fs.statSync(path.join(root, "assets", name)).size < 200000, name + " is too large");
  }
});

test("shows a separate visual listing for the confirmed 150 ml product", () => {
  const productPage = pages.find((page) => page.route === "products").html;
  assert.match(homeHtml, /class="featured-product-card"/);
  assert.match(homeHtml, /ayat-hair-oil-product-150ml\.jpg/);
  assert.match(productPage, /class="catalog-card"/);
  assert.match(productPage, /150 ml/);
  assert.match(productPage, /PKR 1,200/);
  assert.match(productPage, /confirm what is currently available/);
  const productImage = fs.readFileSync(path.join(root, "assets", "ayat-hair-oil-product-150ml.jpg"));
  assert.deepEqual([...productImage.subarray(0, 2)], [255, 216]);
  assert.ok(productImage.length < 100000);
});

test("keeps dark-and-gold brand styling and accessible contrast", () => {
  const brass = css.match(/--brass:\s*(#[\da-f]{6})/i);
  const focus = css.match(/--focus:\s*(#[\da-f]{6})/i);
  const deep = css.match(/--espresso-deep:\s*(#[\da-f]{6})/i);
  const logo = fs.readFileSync(path.join(root, "assets", "ayat-hair-oil-logo.png"));
  assert.ok(brass && focus && deep);
  assert.ok(contrastRatio(brass[1], "#09120d") >= 4.5);
  assert.ok(contrastRatio(focus[1], "#0a110c") >= 3);
  assert.ok(contrastRatio(deep[1], brass[1]) >= 4.5);
  assert.match(css, /--espresso-deep:\s*#050806/i);
  assert.match(css, /--brass:\s*#d4af37/i);
  assert.match(css, /main > section > \.hero-gallery\s*\{\s*position:\s*absolute;\s*z-index:\s*0;\s*\}/);
  assert.match(homeHtml, /<meta name="theme-color" content="#080c09">/);
  assert.match(homeHtml, /<p class="hero-tagline">A little ritual\. A lot of care\.<\/p>/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(homeHtml, /<div class="page-watermark" aria-hidden="true">AYAT<\/div>/);
  assert.match(css, /\.page-watermark\s*\{[^}]*position:\s*fixed[^}]*color:\s*rgba\(255,\s*255,\s*255/);
  assert.match(homeHtml, /<img class="brand-logo"[^>]*ayat-hair-oil-logo\.png[^>]*alt="Ayat Hair Oil logo"/);
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("points Vercel to the complete storefront output", () => {
  const projectRoot = path.resolve(root, "..", "..");
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "vercel.json"), "utf8"));
  const outputDirectory = path.resolve(projectRoot, config.outputDirectory);

  assert.equal(config.outputDirectory, path.relative(projectRoot, root).split(path.sep).join("/"));
  for (const relativePath of ["index.html", "products/index.html", "assets/ayat-hair-oil-logo.png"]) {
    assert.ok(fs.existsSync(path.join(outputDirectory, relativePath)), "missing Vercel output file: " + relativePath);
  }
});

test("has dedicated crawlable pages with unique metadata and working navigation", () => {
  const titles = new Set();
  const canonicalUrls = new Set();
  for (const page of pages) {
    const title = page.html.match(/<title>([^<]+)<\/title>/);
    const description = page.html.match(/<meta name="description" content="([^"]+)">/);
    const canonical = page.html.match(/<link rel="canonical" href="([^"]+)">/);
    assert.ok(title, page.filePath + " has no title");
    assert.ok(description, page.filePath + " has no description");
    assert.ok(canonical, page.filePath + " has no canonical URL");
    assert.ok(!titles.has(title[1]), "duplicate title: " + title[1]);
    assert.ok(!canonicalUrls.has(canonical[1]), "duplicate canonical URL: " + canonical[1]);
    titles.add(title[1]);
    canonicalUrls.add(canonical[1]);
    assert.match(page.html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(page.html, /<meta property="og:url" content="[^"]+">/);
    assert.equal((page.html.match(/<h1\b/g) || []).length, 1, "expected one H1 on " + page.filePath);
    assert.match(page.html, /aria-current="page"/, page.filePath + " has no active page indicator");
  }

  for (const page of pages) {
    const ids = new Set([...page.html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
    const hrefs = [...page.html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(([, href]) => href);
    assert.ok(hrefs.length > 10, page.filePath + " has too few links");
    for (const href of hrefs) {
      assert.notEqual(href, "#");
      assert.ok(!href.startsWith("javascript:"), "unsafe placeholder link: " + href);
      if (href.startsWith("#")) {
        assert.ok(ids.has(decodeURIComponent(href.slice(1))), "missing fragment: " + href);
      } else if (href.startsWith("/") && !href.startsWith("//")) {
        const pathname = new URL(href, "https://ayathairoil.example").pathname;
        const target = pathname === "/"
          ? path.join(root, "index.html")
          : path.join(root, pathname, "index.html");
        assert.ok(fs.existsSync(target), "missing page or asset target: " + href);
      }
    }
  }
});

test("provides direct WhatsApp and telephone links without requiring JavaScript", () => {
  const orderAnchors = allHtml.match(/<a\b[^>]*href="https:\/\/wa\.me\/[^"]+"[^>]*>/g) || [];
  assert.ok(orderAnchors.length >= 12);
  for (const anchor of orderAnchors) {
    const href = anchor.match(/\bhref="([^"]+)"/);
    const url = new URL(href[1]);
    assert.equal(url.origin + url.pathname, "https://wa.me/923455367679");
    assert.match(url.searchParams.get("text"), /Ayat Hair Oil/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
  assert.match(allHtml, /href="tel:\+923455367679"/);
  assert.match(allHtml, /instagram\.com\/ayathairoil/);
});

test("serves clean directory URLs and keeps static requests safe", async (t) => {
  const server = createStorefrontServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const { port } = server.address();

  const home = await makeRequest(port, "/");
  assert.equal(home.statusCode, 200);
  assert.match(home.headers["content-type"], /^text\/html; charset=utf-8/);
  assert.equal(home.headers["x-content-type-options"], "nosniff");
  assert.equal(home.headers["x-frame-options"], "DENY");
  for (const route of ["/products/", "/products", "/why-ayat/", "/how-to-order/", "/faqs/", "/contact/"]) {
    const response = await makeRequest(port, route);
    assert.equal(response.statusCode, 200, route);
    assert.match(response.body, /<html lang="en">/, route);
  }
  const productImage = await makeRequest(port, "/assets/ayat-hair-oil-product-150ml.jpg");
  assert.equal(productImage.statusCode, 200);
  assert.equal(productImage.headers["content-type"], "image/jpeg");
  const missing = await makeRequest(port, "/not-a-real-page/");
  assert.equal(missing.statusCode, 404);
  const malformed = await makeRequest(port, "/%E0%A4%A");
  assert.equal(malformed.statusCode, 400);
  const unsupportedMethod = await makeRequest(port, "/", "POST");
  assert.equal(unsupportedMethod.statusCode, 405);
  assert.equal(unsupportedMethod.headers.allow, "GET, HEAD");
  assert.equal((await makeRequest(port, "/", "HEAD")).body, "");
});

test("confines static path resolution to the storefront root", () => {
  assert.equal(resolveStaticFile(root, "/index.html"), path.join(root, "index.html"));
  assert.equal(resolveStaticFile(root, "/products/"), path.join(root, "products", "index.html"));
  assert.equal(resolveStaticFile(root, "/products"), path.join(root, "products", "index.html"));
  assert.equal(resolveStaticFile(root, "/../../outside.txt"), null);
  const encodedTraversal = decodeRequestPath("/assets%2f..%2f..%2foutside.txt");
  assert.equal(encodedTraversal, "/assets/../../outside.txt");
  assert.equal(resolveStaticFile(root, encodedTraversal), null);
  assert.equal(decodeRequestPath("/bad%ZZpath"), null);
  assert.equal(decodeRequestPath("/bad%00path"), null);
});

test("uses appropriate page-specific structured data and visible FAQ answers", () => {
  const expectedTypes = ["LocalBusiness", "Product", "AboutPage", "HowTo", "FAQPage", "ContactPage"];
  pages.forEach((page, index) => {
    const jsonLd = page.html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    assert.ok(jsonLd, page.filePath + " is missing JSON-LD");
    const data = JSON.parse(jsonLd[1]);
    assert.equal(data["@type"], expectedTypes[index]);
  });
  const faqPage = pages.find((page) => page.route === "faqs").html;
  const faqJson = JSON.parse(faqPage.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
  for (const question of faqJson.mainEntity) {
    assert.ok(faqPage.includes(question.name), "FAQ question missing from the visible page: " + question.name);
    assert.ok(faqPage.includes(question.acceptedAnswer.text), "FAQ answer differs from the visible page: " + question.name);
  }
});

test("keeps the local preview out of search and provides every referenced image", () => {
  assert.match(fs.readFileSync(path.join(root, "robots.txt"), "utf8"), /Disallow: \//);
  assert.ok(!fs.existsSync(path.join(root, "sitemap.xml")));
  for (const page of pages) {
    for (const [imageTag, src] of page.html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/g)) {
      assert.ok(fs.existsSync(path.join(root, src.replace(/^\//, ""))), "missing image asset: " + src);
      assert.match(imageTag, /\balt="[^"]*"/);
    }
  }
  const socialImage = fs.readFileSync(path.join(root, "assets", "ayat-hair-oil-social.png"));
  assert.deepEqual([...socialImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
});

test("configures canonical metadata and sitemap URLs for every page", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ayat-seo-"));
  const placeholder = "https://ayathairoil.example";
  fs.mkdirSync(path.join(temporaryRoot, "products"));
  const pageTemplate = (route) => `<meta name="robots" content="noindex, nofollow"><link rel="canonical" href="${placeholder}${route}"><meta property="og:url" content="${placeholder}${route}"><script>{"@id":"${placeholder}/#business"}</script>`;
  fs.writeFileSync(path.join(temporaryRoot, "index.html"), pageTemplate("/"), "utf8");
  fs.writeFileSync(path.join(temporaryRoot, "products", "index.html"), pageTemplate("/products/"), "utf8");

  try {
    assert.equal(configureSeo(temporaryRoot, "https://www.ayat.pk"), "https://www.ayat.pk");
    const configuredHome = fs.readFileSync(path.join(temporaryRoot, "index.html"), "utf8");
    const configuredProduct = fs.readFileSync(path.join(temporaryRoot, "products", "index.html"), "utf8");
    assert.match(configuredHome, /<meta name="robots" content="index, follow">/);
    assert.match(configuredHome, /<link rel="canonical" href="https:\/\/www\.ayat\.pk\/">/);
    assert.match(configuredProduct, /<link rel="canonical" href="https:\/\/www\.ayat\.pk\/products\/">/);
    assert.match(configuredProduct, /<meta property="og:url" content="https:\/\/www\.ayat\.pk\/products\/">/);
    assert.ok(!configuredProduct.includes(placeholder));
    assert.match(fs.readFileSync(path.join(temporaryRoot, "robots.txt"), "utf8"), /Allow: \//);
    const sitemap = fs.readFileSync(path.join(temporaryRoot, "sitemap.xml"), "utf8");
    assert.match(sitemap, /<loc>https:\/\/www\.ayat\.pk\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/www\.ayat\.pk\/products\/<\/loc>/);
    assert.equal(configureSeo(temporaryRoot, "https://ayat.pk"), "https://ayat.pk");
    assert.ok(fs.readFileSync(path.join(temporaryRoot, "products", "index.html"), "utf8").includes("https://ayat.pk/products/"));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("rejects insecure, placeholder, or non-origin SEO domains", () => {
  for (const invalidOrigin of [
    "http://ayat.pk",
    "https://localhost",
    "https://ayat.example",
    "https://ayat.pk/catalog",
    "https://ayat.pk/?preview=1",
    "https://user:pass@ayat.pk",
    "https://127.0.0.1"
  ]) {
    assert.throws(() => validateOrigin(invalidOrigin), /public HTTPS origin/);
  }
});

test("maps page files to clean sitemap routes", () => {
  assert.equal(getRoute(root, path.join(root, "index.html")), "/");
  assert.equal(getRoute(root, path.join(root, "products", "index.html")), "/products/");
});
