/**
 * Origin allowlist for Edge CORS (Phase 5A.3).
 * Never reflects unknown Origins. Avoids unrestricted `*` when an allowlist exists.
 */
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

export function allowedOrigins(): string[] {
  const primary = Deno.env.get('JOBPILOT_APP_URL')?.trim();
  const extra = Deno.env.get('JOBPILOT_ALLOWED_ORIGINS')?.trim() ?? '';
  const set = new Set<string>();
  if (primary) set.add(normalizeOrigin(primary));
  for (const part of extra.split(',')) {
    const o = normalizeOrigin(part);
    if (o) set.add(o);
  }
  for (const d of DEV_ORIGINS) set.add(d);
  return [...set];
}

/**
 * Resolve Access-Control-Allow-Origin for a request.
 * Unknown origins are not reflected (safe deny for credentialed browser calls).
 */
export function resolveAllowOrigin(req?: Request): string {
  const allow = allowedOrigins();
  const requestOrigin = req?.headers.get('Origin')?.trim();
  if (requestOrigin) {
    const norm = normalizeOrigin(requestOrigin);
    if (allow.includes(norm)) return norm;
    // Unknown origin: do not echo; return primary app URL if set, else empty deny
    const primary = Deno.env.get('JOBPILOT_APP_URL')?.trim();
    return primary ? normalizeOrigin(primary) : 'null';
  }
  if (allow.length > 0) return allow[0];
  return 'null';
}

export function corsHeadersFor(req?: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveAllowOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-jobpilot-ingest-secret',
    Vary: 'Origin',
  };
}

/** Static headers for modules that cannot pass Request at import time. Prefer corsHeadersFor(req). */
export const corsHeaders: Record<string, string> = corsHeadersFor();
