/**
 * Phase 5E — read-only production readiness probes (no secrets printed).
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

async function mgmt(token, method, apiPath, body) {
  const res = await fetch(`https://api.supabase.com/v1${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const project = 'xzzoznhmezmaarcvavpr';
  if (!token) throw new Error('missing token');

  const backups = await mgmt(token, 'GET', `/projects/${project}/database/backups`);
  console.log('BACKUPS_STATUS', backups.status);
  const b = backups.json || {};
  const p = b.physical_backup_data || null;
  console.log(
    JSON.stringify(
      {
        pitr_enabled: b.pitr_enabled,
        walg_enabled: b.walg_enabled,
        region: b.region,
        backups_len: Array.isArray(b.backups) ? b.backups.length : null,
        backup_keys: b && typeof b === 'object' ? Object.keys(b) : [],
        physical_backup_data: p
          ? {
              keys: Object.keys(p),
              status: p.status ?? null,
              earliest: p.earliest_physical_backup_date_unix ?? p.earliest_physical_backup_date ?? null,
              latest: p.latest_physical_backup_date_unix ?? p.latest_physical_backup_date ?? null,
            }
          : null,
      },
      null,
      2,
    ),
  );

  const addons = await mgmt(token, 'GET', `/projects/${project}/billing/addons`);
  console.log('ADDONS_STATUS', addons.status);
  const addonList = Array.isArray(addons.json)
    ? addons.json
    : addons.json?.selected_addons || addons.json?.addons || addons.json;
  console.log(
    JSON.stringify(
      {
        addon_summary: Array.isArray(addonList)
          ? addonList.map((a) => ({
              type: a.type || a.addon_type || a.name,
              variant: a.variant?.identifier || a.variant || a.id,
            }))
          : typeof addons.json,
      },
      null,
      2,
    ),
  );

  const migrations = await mgmt(token, 'POST', `/projects/${project}/database/query`, {
    query: `select version, name from supabase_migrations.schema_migrations order by version;`,
  });
  console.log('MIGRATIONS');
  console.log(JSON.stringify(migrations.json, null, 2));

  const fks = await mgmt(token, 'POST', `/projects/${project}/database/query`, {
    query: `
select tc.table_name, kcu.column_name, ccu.table_name as foreign_table,
       ccu.column_name as foreign_column, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and (ccu.table_name = 'users' or kcu.column_name = 'user_id' or ccu.table_schema = 'auth')
order by tc.table_name, kcu.column_name;
`,
  });
  console.log('USER_FKS');
  console.log(JSON.stringify(fks.json, null, 2));

  const tables = await mgmt(token, 'POST', `/projects/${project}/database/query`, {
    query: `
select table_name
from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
order by table_name;
`,
  });
  console.log('PUBLIC_TABLES');
  console.log(JSON.stringify(tables.json, null, 2));

  const auth = await mgmt(token, 'GET', `/projects/${project}/config/auth`);
  console.log('AUTH_STATUS', auth.status);
  const a = auth.json || {};
  console.log(
    JSON.stringify(
      {
        mailer_autoconfirm: a.mailer_autoconfirm,
        external_email_enabled: a.external_email_enabled,
        site_url: a.site_url ? '[set]' : null,
        uri_allow_list_len: a.uri_allow_list
          ? String(a.uri_allow_list).split(',').filter(Boolean).length
          : null,
        disable_signup: a.disable_signup,
        enable_signup: a.enable_signup,
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
