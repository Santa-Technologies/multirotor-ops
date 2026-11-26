import "server-only";

import { fetchJson } from "./fetch-with-retry";
import type { PriceBreak, PriceProvider, PriceResult } from "./types";

const TOKEN_URL = "https://identity.nexar.com/connect/token";
const GRAPHQL_URL = "https://api.nexar.com/graphql";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

type NexarPrice = {
  quantity?: number;
  price?: number;
  convertedPrice?: number;
  convertedCurrency?: string;
};

type NexarOffer = {
  inventoryLevel?: number | null;
  moq?: number | null;
  factoryLeadDays?: number | null;
  clickUrl?: string | null;
  prices?: NexarPrice[] | null;
};

type NexarSeller = {
  company?: { name?: string | null } | null;
  country?: string | null;
  offers?: NexarOffer[] | null;
};

type NexarPart = {
  mpn?: string | null;
  sellers?: NexarSeller[] | null;
};

type SearchResponse = {
  data?: {
    supSearchMpn?: {
      results?: Array<{ part?: NexarPart | null } | null> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const SEARCH_QUERY = `
query SearchMpn($q: String!) {
  supSearchMpn(q: $q, limit: 3, currency: "EUR") {
    results {
      part {
        mpn
        sellers {
          company { name }
          country
          offers {
            inventoryLevel
            moq
            factoryLeadDays
            clickUrl
            prices {
              quantity
              price
              convertedPrice
              convertedCurrency
            }
          }
        }
      }
    }
  }
}
`;

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Obtains (and caches) a Nexar supply-domain access token. */
async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "supply.domain",
  });

  const token = await fetchJson<TokenResponse>({
    url: TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    label: "Nexar token",
  });

  if (!token.access_token) {
    throw new Error(`Nexar token: ${token.error ?? "missing access_token"}`);
  }

  cachedToken = {
    value: token.access_token,
    expiresAt: now + (token.expires_in ?? 86_400) * 1000,
  };
  return token.access_token;
}

function toBreaks(prices: NexarPrice[] | null | undefined): PriceBreak[] {
  if (!prices) return [];
  const breaks: PriceBreak[] = [];
  for (const p of prices) {
    const qty = p.quantity;
    const unit =
      typeof p.convertedPrice === "number"
        ? p.convertedPrice
        : typeof p.price === "number"
          ? p.price
          : null;
    if (qty == null || qty < 1 || unit == null || unit < 0) continue;
    breaks.push({ qty, unitPrice: unit });
  }
  return breaks.sort((a, b) => a.qty - b.qty);
}

/** Picks the search hit whose MPN matches the query case-insensitively. */
function pickExactPart(results: Array<{ part?: NexarPart | null } | null>, mpn: string) {
  const lower = mpn.toLowerCase();
  const exact = results.find((r) => r?.part?.mpn?.toLowerCase() === lower);
  return exact?.part ?? results[0]?.part ?? null;
}

/**
 * Nexar (Octopart) supply adapter. Requires NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET.
 * Searches one MPN at a time; skips MPNs that return no usable offers.
 */
export function createNexarPriceProvider(options: {
  clientId: string;
  clientSecret: string;
}): PriceProvider {
  return {
    name: "nexar",
    async fetch(mpns: string[]): Promise<PriceResult[]> {
      const token = await getAccessToken(options.clientId, options.clientSecret);
      const out: PriceResult[] = [];
      const fetchedAt = new Date();

      for (const mpn of mpns) {
        try {
          const payload = await fetchJson<SearchResponse>({
            url: GRAPHQL_URL,
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: SEARCH_QUERY,
              variables: { q: mpn },
            }),
            label: `Nexar search ${mpn}`,
          });

          if (payload.errors?.length) {
            console.error("Nexar GraphQL errors", mpn, payload.errors);
            continue;
          }

          const results = payload.data?.supSearchMpn?.results ?? [];
          const part = pickExactPart(results, mpn);
          if (!part?.sellers?.length) continue;

          for (const seller of part.sellers) {
            const distributorName = seller.company?.name?.trim();
            if (!distributorName) continue;
            for (const offer of seller.offers ?? []) {
              const priceBreaks = toBreaks(offer.prices);
              if (priceBreaks.length === 0) continue;
              out.push({
                mpn: part.mpn ?? mpn,
                distributorName,
                country: seller.country ?? null,
                currency: "EUR",
                priceBreaks,
                stock:
                  typeof offer.inventoryLevel === "number" ? offer.inventoryLevel : null,
                factoryLeadDays:
                  typeof offer.factoryLeadDays === "number"
                    ? offer.factoryLeadDays
                    : null,
                lifecycle: null,
                productUrl: offer.clickUrl ?? null,
                fetchedAt,
              });
            }
          }
        } catch (error) {
          console.error("Nexar fetch failed for MPN", mpn, error);
        }
      }

      return out;
    },
  };
}
