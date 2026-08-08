import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/constants/routes';
import {
  EMPLOYMENT_TYPE_LABELS,
  REMOTE_SCOPE_LABELS,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  getIngestionMeta,
  ingestSingleJob,
  listRecentlyIngestedJobs,
} from '@/services';
import type { Enums } from '@/types/database';

const EXAMPLE_JSON = `{
  "job_title": "Senior Product Manager",
  "company_name": "Acme AI",
  "source": "manual",
  "job_url": "https://example.com/jobs/spm",
  "location": "Remote EU",
  "remote_scope": "remote_europe",
  "employment_type": "full_time",
  "job_description": "Own roadmap for AI tooling…"
}`;

export default function JobImportPage() {
  const navigate = useNavigate();
  const {
    data: recent,
    isLoading,
    error,
    refetch,
  } = useResource(listRecentlyIngestedJobs, []);

  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [submitting, setSubmitting] = useState(false);

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [source, setSource] = useState('manual');
  const [location, setLocation] = useState('');
  const [remoteScope, setRemoteScope] =
    useState<Enums<'remote_scope'>>('unknown');
  const [employmentType, setEmploymentType] =
    useState<Enums<'employment_type'>>('unknown');
  const [description, setDescription] = useState('');
  const [jsonText, setJsonText] = useState(EXAMPLE_JSON);
  const [autoAnalyze, setAutoAnalyze] = useState(false);

  const lastIngestedAt = useMemo(() => {
    const first = recent?.[0];
    if (!first) return null;
    return new Date(first.created_at).toLocaleString();
  }, [recent]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let payload;
      if (mode === 'json') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error('JSON is invalid. Fix the payload and try again.');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('JSON must be a single job object.');
        }
        const obj = parsed as Record<string, unknown>;
        if (
          typeof obj.job_title !== 'string' ||
          typeof obj.company_name !== 'string' ||
          typeof obj.source !== 'string'
        ) {
          throw new Error(
            'JSON requires job_title, company_name, and source strings.',
          );
        }
        payload = obj as {
          job_title: string;
          company_name: string;
          source: string;
          [key: string]: unknown;
        };
      } else {
        if (!jobTitle.trim() || !companyName.trim()) {
          throw new Error('Title and company are required.');
        }
        payload = {
          job_title: jobTitle.trim(),
          company_name: companyName.trim(),
          source: source.trim() || 'manual',
          job_url: jobUrl.trim() || null,
          location: location.trim() || null,
          remote_scope: remoteScope,
          employment_type: employmentType,
          job_description: description.trim() || null,
        };
      }

      const result = await ingestSingleJob(
        {
          job_title: String(payload.job_title),
          company_name: String(payload.company_name),
          source: String(payload.source),
          job_url:
            typeof payload.job_url === 'string' ? payload.job_url : null,
          location:
            typeof payload.location === 'string' ? payload.location : null,
          remote_scope:
            typeof payload.remote_scope === 'string'
              ? payload.remote_scope
              : null,
          employment_type:
            typeof payload.employment_type === 'string'
              ? payload.employment_type
              : null,
          job_description:
            typeof payload.job_description === 'string'
              ? payload.job_description
              : null,
          salary_min:
            typeof payload.salary_min === 'number' ? payload.salary_min : null,
          salary_max:
            typeof payload.salary_max === 'number' ? payload.salary_max : null,
          salary_currency:
            typeof payload.salary_currency === 'string'
              ? payload.salary_currency
              : null,
        },
        { autoAnalyze },
      );

      if (result.status === 'created' && result.job_id) {
        toast.success('Job imported');
        refetch();
        navigate(ROUTES.jobDetail(result.job_id));
        return;
      }
      if (result.status === 'duplicate') {
        toast.message('Duplicate job', {
          description: result.reason ?? 'Already saved.',
        });
        if (result.job_id) navigate(ROUTES.jobDetail(result.job_id));
        return;
      }
      if (result.status === 'potential_duplicate') {
        toast.message('Potential duplicate', {
          description: result.reason ?? 'Not created automatically.',
        });
        if (result.job_id) navigate(ROUTES.jobDetail(result.job_id));
        return;
      }
      toast.error(result.reason ?? 'Import rejected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 gap-1" asChild>
            <Link to={ROUTES.jobs}>
              <ArrowLeft className="h-4 w-4" />
              Jobs
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Import Jobs</h1>
          <p className="mt-1 text-muted-foreground">
            Paste a job manually or review recent automation imports. n8n
            credentials stay outside this app.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Manual import</h2>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={mode === 'form' ? 'default' : 'outline'}
                onClick={() => setMode('form')}
              >
                Form
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'json' ? 'default' : 'outline'}
                onClick={() => setMode('json')}
              >
                JSON
              </Button>
            </div>
          </div>

          {mode === 'form' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Senior Product Manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme AI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="manual / rss / remotive…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="url">Job URL (optional)</Label>
                <Input
                  id="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Remote scope</Label>
                <Select
                  value={remoteScope}
                  onValueChange={(v) =>
                    setRemoteScope(v as Enums<'remote_scope'>)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(REMOTE_SCOPE_LABELS) as Enums<'remote_scope'>[]
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {REMOTE_SCOPE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Employment type</Label>
                <Select
                  value={employmentType}
                  onValueChange={(v) =>
                    setEmploymentType(v as Enums<'employment_type'>)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(
                        EMPLOYMENT_TYPE_LABELS,
                      ) as Enums<'employment_type'>[]
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        {EMPLOYMENT_TYPE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Description (paste — no URL scrape)</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={8}
                  placeholder="Paste the full job description…"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="json">Structured job JSON</Label>
              <Textarea
                id="json"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={16}
                className="font-mono text-xs"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={(e) => setAutoAnalyze(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Run AI job analysis after import (uses OpenAI credits)
          </label>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import job
          </Button>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Automation</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            n8n workflows call the secure <code>ingest-job</code> Edge Function
            with an ingestion secret. Configure workflows in n8n — never paste
            secrets here. See <code>docs/N8N_AUTOMATION.md</code> and{' '}
            <code>automation/n8n/</code>.
          </p>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Ingestion endpoint</span>
              <Badge variant="secondary">ingest-job</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Last imported job</span>
              <span>{lastIngestedAt ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Recent imports shown</span>
              <span>{recent?.length ?? 0}</span>
            </div>
          </div>

          <h3 className="text-sm font-medium">Recently ingested</h3>
          {isLoading ? (
            <LoadingState label="Loading imports…" />
          ) : error ? (
            <EmptyState
              icon={Upload}
              title="Could not load imports"
              description={error.message}
              actionLabel="Retry"
              onAction={refetch}
            />
          ) : !recent?.length ? (
            <p className="text-sm text-muted-foreground">
              No automated or import-tagged jobs yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((job) => {
                const meta = getIngestionMeta(job);
                return (
                  <li key={job.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                      onClick={() => navigate(ROUTES.jobDetail(job.id))}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {job.job_title}
                        </div>
                        <div className="truncate text-muted-foreground">
                          {job.company_name_snapshot}
                          {meta?.source
                            ? ` · ${String(meta.source)}`
                            : job.source
                              ? ` · ${job.source}`
                              : ''}
                        </div>
                      </div>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
