import type { Express } from "express";
import { serverEnv } from "./lib/env";

function readTrimmedEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Base publique canonique du site (pas de slash final). */
export function publicSiteOrigin(): string {
  const configured = readTrimmedEnv("APP_BASE_URL")?.replace(/\/+$/, "");
  if (configured) return configured;
  const port = serverEnv.PORT;
  return `http://127.0.0.1:${port}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Routes indexables uniquement (évite doubles avec les redirections SPA). */
const SITEMAP_ENTRIES: readonly {
  path: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: number;
}[] = [
  { path: "/", changefreq: "weekly", priority: 1 },
  { path: "/legal-notice", changefreq: "yearly", priority: 0.35 },
  { path: "/terms", changefreq: "yearly", priority: 0.45 },
  { path: "/privacy", changefreq: "yearly", priority: 0.45 },
];

/**
 * `robots.txt` + `sitemap.xml` avec URLs absolues basées sur `APP_BASE_URL`
 * (prod). En dev, fallback sur `http://127.0.0.1:PORT` si absent.
 */
export function registerSeoRoutes(app: Express): void {
  app.get("/robots.txt", (_req, res) => {
    const origin = publicSiteOrigin();
    const body = [
      "# https://developers.google.com/search/docs/crawling-indexing/robots/intro",
      "User-agent: *",
      "Allow: /",
      "Disallow: /app",
      "Disallow: /admin",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /onboarding",
      "Disallow: /settings",
      "Disallow: /billing",
      "Disallow: /support-client",
      "Disallow: /v1",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n");
    res.status(200).type("text/plain; charset=utf-8").send(body);
  });

  app.get("/sitemap.xml", (_req, res) => {
    const origin = publicSiteOrigin();
    const today = new Date().toISOString().slice(0, 10);
    const urls = SITEMAP_ENTRIES.map(({ path, changefreq, priority }) => {
      const loc = escapeXml(`${origin}${path}`);
      const pr = priority.toFixed(1);
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${pr}</priority>
  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    res
      .status(200)
      .type("application/xml; charset=utf-8")
      .send(xml);
  });
}
