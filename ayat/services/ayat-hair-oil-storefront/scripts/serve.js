"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function decodeRequestPath(requestTarget) {
  try {
    const rawPath = requestTarget.split("?")[0] || "/";
    const pathname = decodeURIComponent(rawPath);
    return pathname.includes("\0") ? null : pathname;
  } catch {
    return null;
  }
}

function resolveStaticFile(root, requestPath) {
  const resolvedRoot = path.resolve(root);
  let resolvedRequestPath = requestPath;
  if (requestPath === "/") {
    resolvedRequestPath = "/index.html";
  } else if (requestPath.endsWith("/") || !path.extname(requestPath)) {
    resolvedRequestPath = path.join(requestPath, "index.html");
  }
  const filePath = path.resolve(resolvedRoot, "." + resolvedRequestPath);
  const relativePath = path.relative(resolvedRoot, filePath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(".." + path.sep) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return filePath;
}

function createStorefrontServer(root = path.resolve(__dirname, "..")) {
  const resolvedRoot = path.resolve(root);

  return http.createServer((request, response) => {
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY"
    };

    function send(statusCode, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
      const bodyBuffer = Buffer.from(body);
      response.writeHead(statusCode, {
        ...securityHeaders,
        "Content-Type": contentType,
        "Content-Length": bodyBuffer.length,
        ...extraHeaders
      });
      response.end(request.method === "HEAD" ? undefined : bodyBuffer);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      send(405, "Method not allowed", "text/plain; charset=utf-8", { Allow: "GET, HEAD" });
      return;
    }

    const requestPath = decodeRequestPath(request.url || "/");
    if (!requestPath) {
      send(400, "Bad request");
      return;
    }

    const filePath = resolveStaticFile(resolvedRoot, requestPath);
    if (!filePath) {
      send(403, "Forbidden");
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EISDIR") {
          send(404, "Not found");
          return;
        }
        console.error("Failed to serve storefront file:", error);
        send(500, "Internal server error");
        return;
      }

      response.writeHead(200, {
        ...securityHeaders,
        "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Content-Length": body.length
      });
      response.end(request.method === "HEAD" ? undefined : body);
    });
  });
}

if (require.main === module) {
  const server = createStorefrontServer();
  server.listen(4173, "127.0.0.1", () => {
    console.log("Storefront available at http://localhost:4173");
  });
}

module.exports = { createStorefrontServer, decodeRequestPath, resolveStaticFile };
