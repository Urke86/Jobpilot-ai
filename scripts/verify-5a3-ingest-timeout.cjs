/**
 * Regression checks for Phase 5A.3 ingest→analyze timeout + CORS allowlist.
 */
const fs = require('fs');
const assert = require('assert');

const ingest = fs.readFileSync('supabase/functions/ingest-job/index.ts', 'utf8');
const ft = fs.readFileSync('supabase/functions/_shared/fetch-timeout.ts', 'utf8');
const cors = fs.readFileSync('supabase/functions/_shared/cors.ts', 'utf8');
const oauth = fs.readFileSync(
  'supabase/functions/google-oauth-callback/index.ts',
  'utf8',
);

assert.match(ft, /ANALYZE_PROXY_TIMEOUT_MS\s*=\s*50_000/);
assert.match(ingest, /fetchWithTimeout/);
assert.match(ingest, /ANALYZE_PROXY_TIMEOUT_MS/);
assert.equal((ingest.match(/await fetch\(/g) || []).length, 0, 'no raw fetch in ingest-job');
assert.match(ingest, /Analysis timed out\. Job was saved/);
assert.match(cors, /allowedOrigins/);
assert.doesNotMatch(cors, /'\*'/);
assert.match(oauth, /refresh_preserved/);
assert.match(oauth, /existing\?\.refresh_token_cipher/);

// AbortController micro-behavior (same pattern as fetchWithTimeout)
(async () => {
  const controller = new AbortController();
  const t0 = Date.now();
  const timer = setTimeout(() => controller.abort(), 150);
  let timedOut = false;
  try {
    await fetch('https://httpbin.org/delay/3', { signal: controller.signal });
  } catch {
    timedOut = true;
  } finally {
    clearTimeout(timer);
  }
  const elapsed = Date.now() - t0;
  assert.ok(timedOut, 'expected abort');
  assert.ok(elapsed < 2500, 'elapsed=' + elapsed);
  console.log('PASS ingest_timeout_regression elapsed_ms=' + elapsed);
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
