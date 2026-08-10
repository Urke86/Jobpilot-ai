/**
 * Phase 5D — controlled non-destructive concurrency smoke.
 * Hits Edge rate-limit / auth paths without burning OpenAI spend when possible.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = {};
  const p = path.join(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const base = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!base || !anon) throw new Error('missing supabase url/anon');

  const headers = {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  };

  // 10 parallel unauthenticated analyze-job calls → expect 401, no hang
  const n = 10;
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const t0 = Date.now();
      const res = await fetch(`${base}/functions/v1/analyze-job`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId: '00000000-0000-0000-0000-000000000000' }),
      });
      let body = '';
      try {
        body = await res.text();
      } catch {
        body = '';
      }
      return {
        i,
        status: res.status,
        ms: Date.now() - t0,
        ok: res.status === 401 || res.status === 403 || res.status === 400,
        len: body.length,
      };
    }),
  );
  const elapsed = Date.now() - started;
  const statuses = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log(
    JSON.stringify(
      {
        parallel_analyze_unauth: n,
        wall_ms: elapsed,
        statuses,
        max_ms: Math.max(...results.map((r) => r.ms)),
        all_settled: results.every((r) => r.status > 0),
        expected_auth_fail: results.every(
          (r) => r.status === 401 || r.status === 403 || r.status === 400,
        ),
      },
      null,
      2,
    ),
  );

  // Parallel gmail-sync without user JWT
  const gmail = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const t0 = Date.now();
      const res = await fetch(`${base}/functions/v1/gmail-sync`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      return { status: res.status, ms: Date.now() - t0 };
    }),
  );
  console.log(
    JSON.stringify(
      {
        parallel_gmail_unauth: gmail.length,
        statuses: gmail.reduce((a, r) => {
          a[r.status] = (a[r.status] || 0) + 1;
          return a;
        }, {}),
        max_ms: Math.max(...gmail.map((r) => r.ms)),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
