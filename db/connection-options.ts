const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * TLS setting for postgres.js. postgres.js connects without TLS unless the URL
 * has `sslmode`, and Supabase's connection strings don't include it, so remote
 * hosts default to TLS ('require': encrypted, certificate not pinned). An
 * explicit `sslmode` in the URL wins; local databases stay plain.
 */
export function sslOptionFor(databaseUrl: string): "require" | false | undefined {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    // Let postgres.js report the malformed URL itself.
    return undefined;
  }
  if (url.searchParams.has("sslmode")) return undefined;
  return LOCAL_HOSTS.has(url.hostname) ? false : "require";
}
