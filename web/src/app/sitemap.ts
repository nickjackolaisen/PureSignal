import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://puresignal.io";
  const routes = ["", "/features", "/pricing", "/security", "/support", "/legal", "/blog", "/dashboard", "/partner"];
  return routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7
  }));
}
