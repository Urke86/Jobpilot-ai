/**
 * Phase 5D — read-only AI + index baseline via Supabase Management API.
 * Never prints secrets.
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

async function mgmtQuery(token, query) {
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
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`mgmt ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

async function main() {
  const env = loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing');

  const ai = await mgmtQuery(
    token,
    `
select feature, count(*)::int as n,
  round(avg(input_tokens)::numeric,1) as avg_in,
  round(avg(output_tokens)::numeric,1) as avg_out,
  round(avg(estimated_cost_usd)::numeric,6) as avg_cost,
  round(percentile_cont(0.95) within group (order by latency_ms)::numeric,0) as p95_ms,
  round(avg(latency_ms)::numeric,0) as avg_ms,
  round(100.0*sum(case when status='success' then 1 else 0 end)/nullif(count(*),0),1) as success_pct,
  sum(case when status<>'success' then 1 else 0 end)::int as failures
from ai_generations
group by feature
order by n desc;
`,
  );
  console.log('AI_BY_FEATURE');
  console.log(JSON.stringify(ai, null, 2));

  const indexes = await mgmtQuery(
    token,
    `
select tablename, indexname
from pg_indexes
where schemaname='public'
  and tablename in (
    'jobs','applications','ai_generations','ai_evaluations',
    'job_emails','ai_messages','job_analyses','application_artifacts','activities'
  )
order by tablename, indexname;
`,
  );
  console.log('INDEXES');
  console.log(JSON.stringify(indexes, null, 2));

  const plans = [];
  for (const [label, sql] of [
    [
      'jobs_list',
      `explain (analyze, buffers, format json)
       select id, job_title, status, source, company_id, date_discovered
       from jobs
       where user_id = (select id from auth.users order by created_at asc limit 1)
       order by date_discovered desc nulls last
       limit 500;`,
    ],
    [
      'applications_list',
      `explain (analyze, buffers, format json)
       select id, stage, job_id, created_at
       from applications
       where user_id = (select id from auth.users order by created_at asc limit 1)
       order by updated_at desc nulls last
       limit 500;`,
    ],
    [
      'job_emails_list',
      `explain (analyze, buffers, format json)
       select id, subject, classification, received_at
       from job_emails
       where user_id = (select id from auth.users order by created_at asc limit 1)
       order by received_at desc nulls last
       limit 50;`,
    ],
  ]) {
    try {
      const plan = await mgmtQuery(token, sql);
      const row = Array.isArray(plan) ? plan[0] : plan;
      const planJson = row?.['QUERY PLAN'] ?? row;
      const top = Array.isArray(planJson) ? planJson[0] : planJson;
      plans.push({
        label,
        planning_ms: top?.['Planning Time'],
        execution_ms: top?.['Execution Time'],
        node: top?.Plan?.['Node Type'],
        rows: top?.Plan?.['Actual Rows'],
        scan: top?.Plan?.['Node Type'],
      });
    } catch (e) {
      plans.push({ label, error: String(e.message || e) });
    }
  }
  console.log('PLANS');
  console.log(JSON.stringify(plans, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
