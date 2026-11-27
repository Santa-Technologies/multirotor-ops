export type KnownDistributorHost = {
  hostKey: string;
  name: string;
  /** China-origin hosts stay unapproved (China-free gate). */
  approved: boolean;
  country: string | null;
};

const HOST_MAP: Record<string, KnownDistributorHost> = {
  "digikey.de": {
    hostKey: "digikey.de",
    name: "Digi-Key",
    approved: true,
    country: "DE",
  },
  "www.digikey.de": {
    hostKey: "digikey.de",
    name: "Digi-Key",
    approved: true,
    country: "DE",
  },
  "digikey.com": {
    hostKey: "digikey.com",
    name: "Digi-Key",
    approved: true,
    country: "US",
  },
  "www.digikey.com": {
    hostKey: "digikey.com",
    name: "Digi-Key",
    approved: true,
    country: "US",
  },
  "lcsc.com": {
    hostKey: "lcsc.com",
    name: "LCSC",
    approved: false,
    country: "CN",
  },
  "www.lcsc.com": {
    hostKey: "lcsc.com",
    name: "LCSC",
    approved: false,
    country: "CN",
  },
};

/**
 * Maps a BOM Link hostname to a known distributor directory entry.
 * Does not scrape product pages — hostname only.
 */
export function distributorFromHost(hostname: string): KnownDistributorHost | null {
  const key = hostname.trim().toLowerCase().replace(/^www\./, "");
  const withWww = hostname.trim().toLowerCase();
  return HOST_MAP[withWww] ?? HOST_MAP[key] ?? HOST_MAP[`www.${key}`] ?? null;
}

/** Parses a product URL and returns host + distributor mapping when known. */
export function parseProductLink(url: string): {
  url: string;
  hostKey: string | null;
  distributor: KnownDistributorHost | null;
  manufacturerSlug: string | null;
} {
  try {
    const parsed = new URL(url.trim());
    const hostKey = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const distributor = distributorFromHost(parsed.hostname);
    return {
      url: parsed.toString(),
      hostKey: distributor?.hostKey ?? hostKey,
      distributor,
      manufacturerSlug: manufacturerFromDigiKeyPath(parsed.pathname),
    };
  } catch {
    return {
      url: url.trim(),
      hostKey: null,
      distributor: null,
      manufacturerSlug: null,
    };
  }
}

/**
 * Digi-Key paths look like `/de/products/detail/{mfr-slug}/{mpn}/{id}`.
 * Returns a displayable manufacturer guess from the slug when present.
 */
export function manufacturerFromDigiKeyPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const detailIdx = parts.findIndex((p) => p.toLowerCase() === "detail");
  if (detailIdx < 0 || !parts[detailIdx + 1]) return null;
  const slug = parts[detailIdx + 1]!;
  if (!slug || slug.length < 2) return null;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
