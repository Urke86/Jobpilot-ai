/**
 * Patch Auth mailer_autoconfirm=false (Phase 5E config regression fix).
 * Prints booleans only — no secrets.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const project = 'xzzoznhmezmaarcvavpr';
  const get = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const before = await get.json();
  console.log('BEFORE', { mailer_autoconfirm: before.mailer_autoconfirm });

  if (before.mailer_autoconfirm === false) {
    console.log('NO_CHANGE');
    return;
  }

  const patch = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mailer_autoconfirm: false }),
  });
  const afterText = await patch.text();
  let after;
  try {
    after = JSON.parse(afterText);
  } catch {
    after = { raw: afterText.slice(0, 200) };
  }
  console.log('PATCH_STATUS', patch.status);
  console.log('AFTER', { mailer_autoconfirm: after.mailer_autoconfirm });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
