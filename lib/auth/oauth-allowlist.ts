const CLIENT_MAP_ENV = "AUTH_ALLOWED_OAUTH_CLIENTS";
const CENTEROS_DESKTOP_REDIRECT_URIS = new Set([
  "centeros://auth/callback",
  "centeros-staging://auth/callback",
]);

type OAuthAllowlistEnvironment = Record<string, string | undefined>;

export function hasAllowedWebScheme(url: URL): boolean {
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && url.hostname === "localhost")
  );
}

function normalizedOAuthRedirectBase(url: URL): string | null {
  if (hasAllowedWebScheme(url)) return `${url.origin}${url.pathname}`;

  const customSchemeBase = `${url.protocol}//${url.host}${url.pathname}`;
  return CENTEROS_DESKTOP_REDIRECT_URIS.has(customSchemeBase)
    ? customSchemeBase
    : null;
}

export function isCenterOSDesktopRedirectUrl(url: URL): boolean {
  if (url.username || url.password) return false;
  const base = normalizedOAuthRedirectBase(url);
  return base !== null && CENTEROS_DESKTOP_REDIRECT_URIS.has(base);
}

export function normalizedOAuthRedirectUri(value: string): string | null {
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    const normalized = normalizedOAuthRedirectBase(url);
    if (!normalized) return null;
    return value === normalized ? normalized : null;
  } catch {
    return null;
  }
}

export function oauthRedirectBase(value: URL): string | null {
  return normalizedOAuthRedirectBase(value);
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function emptyAllowlist(): Map<string, Set<string>> {
  return new Map<string, Set<string>>();
}

function configuredAllowlist(raw: string): Map<string, Set<string>> {
  if (!raw.trim()) return emptyAllowlist();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyAllowlist();
    }

    const entries = Object.entries(parsed);
    if (!entries.length) return emptyAllowlist();

    const allowlist = new Map<string, Set<string>>();
    const assignedCallbacks = new Set<string>();
    for (const [clientId, callbacks] of entries) {
      if (!clientId || clientId.trim() !== clientId || !Array.isArray(callbacks)) {
        return emptyAllowlist();
      }
      if (!callbacks.length) return emptyAllowlist();

      const normalizedCallbacks = new Set<string>();
      for (const callback of callbacks) {
        if (typeof callback !== "string" || callback.trim() !== callback) {
          return emptyAllowlist();
        }
        const normalized = normalizedOAuthRedirectUri(callback);
        if (!normalized) return emptyAllowlist();
        if (assignedCallbacks.has(normalized)) return emptyAllowlist();
        assignedCallbacks.add(normalized);
        normalizedCallbacks.add(normalized);
      }
      allowlist.set(clientId, normalizedCallbacks);
    }
    return allowlist;
  } catch {
    return emptyAllowlist();
  }
}

function legacySingleClientAllowlist(
  env: OAuthAllowlistEnvironment,
): Map<string, Set<string>> {
  const clients = [...new Set(csv(env.AUTH_ALLOWED_OAUTH_CLIENT_IDS))];
  const callbacks = [...new Set(csv(env.AUTH_ALLOWED_OAUTH_REDIRECT_URIS))];
  if (clients.length !== 1 || callbacks.length !== 1) return emptyAllowlist();

  const callback = normalizedOAuthRedirectUri(callbacks[0]);
  if (!callback) return emptyAllowlist();
  return new Map([[clients[0], new Set([callback])]]);
}

/**
 * Resolve exact OAuth client-to-callback pairs.
 *
 * The legacy two-list configuration is accepted only for one client and one
 * callback so the current single Website Preview remains compatible. Once the
 * JSON map is present it is authoritative; malformed configuration fails
 * closed and never falls back to the legacy variables.
 */
export function allowedOAuthClients(
  env: OAuthAllowlistEnvironment = process.env,
): Map<string, Set<string>> {
  const configured = env[CLIENT_MAP_ENV];
  if (configured !== undefined) return configuredAllowlist(configured);
  return legacySingleClientAllowlist(env);
}

export function allowedOAuthRedirectUris(
  env: OAuthAllowlistEnvironment = process.env,
): Set<string> {
  const callbacks = new Set<string>();
  for (const clientCallbacks of allowedOAuthClients(env).values()) {
    for (const callback of clientCallbacks) callbacks.add(callback);
  }
  return callbacks;
}
