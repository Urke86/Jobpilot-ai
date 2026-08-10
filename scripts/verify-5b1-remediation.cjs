/**
 * Phase 5B.1 regression checks for H1 calendar idempotency + H2 URL dedupe.
 * Uses Management API / Edge where credentials exist; never prints secrets.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function toBase32Hex(buf) {
  const alphabet = '0123456789abcdefghijklmnopqrstuv';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function deriveCalendarIds(parts) {
  const material = parts.join('\0');
  const digest = crypto.createHash('sha256').update(material).digest();
  return {
    idempotencyKey: digest.toString('hex'),
    googleEventId: toBase32Hex(digest).slice(0, 32),
  };
}

function normalizeJobUrl(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    url.hash = '';
    for (const key of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
    ]) {
      url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return trimmed.replace(/\s+/g, ' ').trim();
  }
}

// --- static code checks ---
const hiring = fs.readFileSync(
  path.join(root, 'supabase/functions/hiring-email-action/index.ts'),
  'utf8',
);
const ingest = fs.readFileSync(
  path.join(root, 'supabase/functions/ingest-job/index.ts'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260810010000_phase5b1_idempotency_url_dedupe.sql',
  ),
  'utf8',
);
const types = fs.readFileSync(path.join(root, 'src/types/database.ts'), 'utf8');

assert(hiring.includes('id: googleEventId'), 'calendar POST uses deterministic Google event id');
assert(hiring.includes("status: 'already_created'"), 'calendar returns already_created on retry');
assert(hiring.includes('calRes.status === 409'), 'calendar handles Google 409 conflict');
assert(hiring.includes('idempotency_key'), 'calendar persists idempotency_key');
assert(
  ingest.includes(".eq('normalized_job_url', jobUrl)") &&
    !ingest.includes('.limit(200)'),
  'ingest URL dedupe uses indexed normalized_job_url without 200-row scan',
);
assert(
  migration.includes('jobs_user_normalized_url_unique') &&
    migration.includes('application_events_user_idempotency_unique'),
  'migration defines unique indexes for H1/H2',
);
assert(
  types.includes('normalized_job_url') && types.includes('idempotency_key'),
  'generated types include new columns',
);

// --- pure logic checks ---
const a = deriveCalendarIds([
  'jp-cal-v1',
  'user-a',
  'app-1',
  '2026-08-20T10:00:00Z',
  '2026-08-20T11:00:00Z',
  'interview',
]);
const b = deriveCalendarIds([
  'jp-cal-v1',
  'user-a',
  'app-1',
  '2026-08-20T10:00:00Z',
  '2026-08-20T11:00:00Z',
  'interview',
]);
const c = deriveCalendarIds([
  'jp-cal-v1',
  'user-a',
  'app-1',
  '2026-08-21T10:00:00Z',
  '2026-08-21T11:00:00Z',
  'interview',
]);
assert(a.idempotencyKey === b.idempotencyKey, 'same logical calendar input → same idempotency key');
assert(a.googleEventId === b.googleEventId, 'same logical calendar input → same Google id');
assert(a.idempotencyKey !== c.idempotencyKey, 'different interview slot → different key');
assert(/^[0-9a-v]+$/.test(a.googleEventId), 'Google event id is base32hex');
assert(a.googleEventId.length >= 5 && a.googleEventId.length <= 1024, 'Google event id length valid');

const u1 = normalizeJobUrl('https://Example.com/jobs/1/?utm_source=x');
const u2 = normalizeJobUrl('https://example.com/jobs/1');
assert(u1 === u2, 'URL variants normalize to same value');
assert(normalizeJobUrl(null) == null, 'null URL stays null');

async function sql(token, query) {
  const res = await fetch(
    'https://api.supabase.com/v1/projects/xzzoznhmezmaarcvavpr/database/query',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`sql ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  const env = loadEnvLocal();
  if (!env.SUPABASE_ACCESS_TOKEN) {
    console.log('SKIP live DB checks (no SUPABASE_ACCESS_TOKEN)');
    if (failed) process.exit(1);
    console.log('\nPhase 5B.1 static checks passed');
    return;
  }

  const token = env.SUPABASE_ACCESS_TOKEN;
  const one = async (query) => {
    const res = await sql(token, query);
    return Array.isArray(res) ? res[0] : res;
  };

  const jobsCol = await one(
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='normalized_job_url') AS v;`,
  );
  const eventsCol = await one(
    `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='application_events' AND column_name='idempotency_key') AS v;`,
  );
  const jobsUq = await one(
    `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='jobs_user_normalized_url_unique') AS v;`,
  );
  const eventsUq = await one(
    `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='application_events_user_idempotency_unique') AS v;`,
  );
  const mig = await one(
    `SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260810010000') AS v;`,
  );
  const normRow = await one(
    `SELECT public.normalize_job_url('https://Example.com/jobs/1/?utm_source=x') AS db_norm;`,
  );

  assert(jobsCol?.v === true, 'live: jobs.normalized_job_url exists');
  assert(eventsCol?.v === true, 'live: application_events.idempotency_key exists');
  assert(jobsUq?.v === true, 'live: normalized URL unique index exists');
  assert(eventsUq?.v === true, 'live: idempotency unique index exists');
  assert(mig?.v === true, 'live: migration 20260810010000 recorded');
  assert(
    normRow?.db_norm === normalizeJobUrl('https://Example.com/jobs/1/?utm_source=x'),
    'live: SQL normalize_job_url matches Edge semantics for sample URL',
  );

  // Cross-user uniqueness: same normalized URL allowed for two users (constraint is per-user)
  const cross = await sql(
    token,
    `
    SELECT conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='jobs' AND c.contype='u'
    UNION ALL
    SELECT i.relname, pg_get_indexdef(i.oid)
    FROM pg_class i
    JOIN pg_index x ON x.indexrelid = i.oid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='jobs' AND x.indisunique
      AND i.relname='jobs_user_normalized_url_unique';
  `,
  );
  const idxDef = JSON.stringify(cross);
  assert(
    idxDef.includes('user_id') && idxDef.includes('normalized_job_url'),
    'live: unique index is scoped (user_id, normalized_job_url)',
  );

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Phase 5B.1 remediation checks passed');
}

main().catch((err) => {
  console.error('ERROR:', err instanceof Error ? err.message : err);
  process.exit(1);
});
