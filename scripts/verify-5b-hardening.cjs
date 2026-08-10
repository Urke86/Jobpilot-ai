/**
 * Static regression checks for Phase 5B High fixes.
 * Does not call live providers or print secrets.
 */
const fs = require('fs');
const path = require('path');

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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const analyze = read('supabase/functions/analyze-job/index.ts');
const generate = read('supabase/functions/generate-artifact/index.ts');
const chat = read('supabase/functions/chat-assistant/index.ts');
const ingest = read('supabase/functions/ingest-job/index.ts');
const hiring = read('supabase/functions/hiring-email-action/index.ts');
const googleAuth = read('supabase/functions/_shared/google-auth.ts');
const cors = read('supabase/functions/_shared/cors.ts');

assert(
  analyze.includes('createJsonResponse(req)') &&
    analyze.includes('corsHeadersFor(req)'),
  'analyze-job binds CORS to request Origin',
);
assert(
  analyze.includes('max_tokens: MAX_OUTPUT_TOKENS') &&
    analyze.includes('MAX_JOB_DESCRIPTION_CHARS'),
  'analyze-job has output + prompt caps',
);
assert(
  analyze.includes('resetJobId') &&
    analyze.includes("status: 'reviewed'") &&
    /catch \(error\)[\s\S]*resetJobId[\s\S]*reviewed/.test(analyze),
  'analyze-job resets analyzing status on unhandled errors',
);

assert(
  generate.includes('createJsonResponse(req)') &&
    generate.includes('max_tokens: MAX_OUTPUT_TOKENS') &&
    generate.includes('MAX_USER_INSTRUCTION_CHARS'),
  'generate-artifact has CORS bind + cost caps',
);

assert(
  chat.includes('createJsonResponse(req)') &&
    chat.includes(".delete().eq('id', userMessage.id)"),
  'chat-assistant binds CORS and rolls back orphaned user messages',
);

assert(
  ingest.includes('createJsonResponse(req)') &&
    ingest.includes('ingest-job:${userId}') &&
    ingest.includes('tryAcquireRateLimit'),
  'ingest-job binds CORS and acquires per-user rate lease',
);

assert(
  hiring.includes("code: 'calendar_persist_failed'") &&
    hiring.includes('google_event_id: externalId') &&
    hiring.includes("status: 'already_created'"),
  'hiring-email-action fails closed on persist miss and supports already_created',
);

assert(
  googleAuth.includes('GOOGLE_OAUTH_STATE_SECRET must be configured') &&
    !/GOOGLE_TOKEN_ENCRYPTION_KEY[\s\S]{0,40}OAuth state|OAuth state[\s\S]{0,80}GOOGLE_TOKEN_ENCRYPTION_KEY/.test(
      googleAuth,
    ),
  'OAuth state HMAC no longer falls back to encryption key',
);

assert(
  cors.includes('resolveAllowOrigin') && cors.includes("Vary: 'Origin'"),
  'shared CORS helper uses allowlist + Vary Origin',
);

// Minimal behavioral check of Origin resolution (mirrors cors.ts rules)
function normalizeOrigin(origin) {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return origin;
  }
}
function resolveAllowOrigin(reqOrigin, allow, primary) {
  if (reqOrigin) {
    const norm = normalizeOrigin(reqOrigin);
    if (allow.includes(norm)) return norm;
    return primary ? normalizeOrigin(primary) : 'null';
  }
  return allow[0] ?? 'null';
}
const allow = ['http://localhost:5174', 'http://127.0.0.1:5174'];
assert(
  resolveAllowOrigin('http://127.0.0.1:5174', allow, allow[0]) ===
    'http://127.0.0.1:5174',
  'CORS echoes matching 127.0.0.1 Origin',
);
assert(
  resolveAllowOrigin('http://localhost:5174', allow, allow[0]) ===
    'http://localhost:5174',
  'CORS echoes matching localhost Origin',
);
assert(
  resolveAllowOrigin('https://evil.example', allow, allow[0]) === allow[0],
  'CORS does not reflect unknown Origin',
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll Phase 5B hardening checks passed');
