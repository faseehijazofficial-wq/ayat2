"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isIP } = require("node:net");

const EXCLUDED_SEO_DIRECTORIES = new Set(["assets", "node_modules", "scripts", "styles", "tests"]);

function validateOrigin(value) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error("Provide the production site's HTTPS origin, for example https://www.example.com");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The site origin must be a valid public HTTPS origin.");
  }

  const hostname = url.hostname.toLowerCase();
  const reservedSuffixes = [".example", ".test", ".invalid", ".localhost", ".local"];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !hostname.includes(".") ||
    isIP(hostname) ||
    hostname === "localhost" ||
    reservedSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Use a public HTTPS origin only (no path, query, credentials, IP address, or reserved placeholder domain).");
  }

  return url.origin;
}

function findHtmlPages(directory) {
  const pages = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && !EXCLUDED_SEO_DIRECTORIES.has(entry.name)) {
      pages.push(...findHtmlPages(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      pages.push(entryPath);
    }
  }
  return pages;
}

function getRoute(projectRoot, htmlPath) {
  const relativePath = path.relative(projectRoot, htmlPath).split(path.sep).join("/");
  const directoryPath = relativePath.replace(/(^|\/)index\.html$/, "$1");
  return "/" + directoryPath;
}

function configureSeo(projectRoot, requestedOrigin) {
  const origin = validateOrigin(requestedOrigin);
  const homePath = path.join(projectRoot, "index.html");
  const pagePaths = findHtmlPages(projectRoot).sort((first, second) =>
    getRoute(projectRoot, first).localeCompare(getRoute(projectRoot, second))
  );
  if (!pagePaths.includes(homePath)) {
    throw new Error("Could not locate index.html in the site's page files.");
  }

  const homeHtml = fs.readFileSync(homePath, "utf8");
  const canonical = homeHtml.match(/<link rel="canonical" href="(https:\/\/[^/" ]+)\/">/);
  if (!canonical) {
    throw new Error("Could not locate the site's root canonical URL in index.html.");
  }

  const robotsMeta = /<meta name="robots" content="[^"]+">/;
  const canonicalTag = /<link rel="canonical" href="[^"]+">/;
  const openGraphUrl = /<meta property="og:url" content="[^"]+">/;
  const previousOrigin = canonical[1];
  const configuredPages = pagePaths.map((htmlPath) => {
    const html = fs.readFileSync(htmlPath, "utf8");
    if (!robotsMeta.test(html) || !canonicalTag.test(html) || !openGraphUrl.test(html)) {
      throw new Error("Could not locate canonical, robots, and Open Graph URL metadata in " + path.relative(projectRoot, htmlPath) + ".");
    }

    const pageUrl = origin + getRoute(projectRoot, htmlPath);
    const configuredHtml = html
      .split(previousOrigin).join(origin)
      .replace(robotsMeta, '<meta name="robots" content="index, follow">')
      .replace(canonicalTag, `<link rel="canonical" href="${pageUrl}">`)
      .replace(openGraphUrl, `<meta property="og:url" content="${pageUrl}">`);
    return { htmlPath, configuredHtml, pageUrl };
  });

  for (const page of configuredPages) {
    fs.writeFileSync(page.htmlPath, page.configuredHtml, "utf8");
  }
  fs.writeFileSync(
    path.join(projectRoot, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(projectRoot, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${configuredPages.map((page) => `  <url><loc>${page.pageUrl}</loc></url>`).join("\n")}\n</urlset>\n`,
    "utf8"
  );

  return origin;
}

if (require.main === module) {
  const requestedOrigin = process.argv[2];
  try {
    if (!requestedOrigin) {
      throw new Error("Usage: npm run configure-seo -- https://your-public-domain.com");
    }
    const origin = configureSeo(path.join(__dirname, ".."), requestedOrigin);
    console.log(`Configured production SEO URLs for ${origin}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { configureSeo, getRoute, validateOrigin };
