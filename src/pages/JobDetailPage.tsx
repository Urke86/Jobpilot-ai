import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookmarkPlus,
  Briefcase,
  Calendar,
  DollarSign,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { JobFormDialog } from '@/components/jobs/JobFormDialog';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/constants/routes';
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  REMOTE_SCOPE_LABELS,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  createApplication,
  deleteJob,
  formatSalary,
  getAnalysisMetadata,
  getApplicationByJobId,
  getJobById,
  getLatestJobAnalysis,
  listCompanies,
  parseAnalysisGaps,
  parseAnalysisRisks,
  parseAnalysisStrengths,
  requestJobAnalysis,
  setJobStatus,
  updateJob,
  type CreateJobInput,
  type JobAnalysis,
} from '@/services';
import type { Enums } from '@/types/database';
import {
  getJobStatusStyle,
  getScoreColor,
  getScoreRingBorderColor,
} from '@/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRecommendationStyle(
  recommendation: Enums<'analysis_recommendation'>,
): string {
  const styles: Record<Enums<'analysis_recommendation'>, string> = {
    apply: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    consider: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    skip: 'bg-red-100 text-red-700 border-red-200',
  };
  return styles[recommendation];
}

function AnalysisPanel({
  analysis,
  analyzing,
  onReanalyze,
}: {
  analysis: JobAnalysis;
  analyzing: boolean;
  onReanalyze: () => void;
}) {
  const strengths = parseAnalysisStrengths(analysis.strengths);
  const gaps = parseAnalysisGaps(analysis.gaps);
  const risks = parseAnalysisRisks(analysis.risks);
  const meta = getAnalysisMetadata(analysis);
  const score = analysis.overall_match_score;
  const cvFocus = meta.cv_focus ?? [];
  const interviewFocus = meta.interview_focus ?? [];
  const recommendationReason = meta.recommendation_reason;

  return (
    <Card className="relative overflow-hidden border-blue-200 dark:border-blue-800">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" />
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Fit Analysis</CardTitle>
              <CardDescription className="text-xs">
                {formatDate(analysis.created_at)}
                {meta.model ? ` · ${meta.model}` : ''}
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={analyzing}
            onClick={onReanalyze}
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-analyze
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] ${getScoreRingBorderColor(score)}`}
          >
            <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
              {score}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">Overall match</p>
            <Badge
              variant="outline"
              className={`mt-1 capitalize ${getRecommendationStyle(analysis.recommendation)}`}
            >
              {analysis.recommendation}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {analysis.product_fit_score != null && (
            <span>Product: {analysis.product_fit_score}</span>
          )}
          {analysis.technical_fit_score != null && (
            <span>Technical: {analysis.technical_fit_score}</span>
          )}
          {analysis.ai_tools_fit_score != null && (
            <span>AI tools: {analysis.ai_tools_fit_score}</span>
          )}
          {analysis.remote_fit_score != null && (
            <span>Remote: {analysis.remote_fit_score}</span>
          )}
          {analysis.experience_fit_score != null && (
            <span>Experience: {analysis.experience_fit_score}</span>
          )}
        </div>

        <Separator />

        {strengths.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Strengths
            </h4>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{s.title}</p>
                  <p className="mt-0.5 leading-relaxed">{s.evidence}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {gaps.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Gaps
            </h4>
            <ul className="space-y-2">
              {gaps.map((g, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-foreground">{g.title}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {g.severity}
                    </Badge>
                  </div>
                  <p className="mt-0.5 leading-relaxed">{g.evidence}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {risks.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
              <XCircle className="h-4 w-4" />
              Risks
            </h4>
            <ul className="space-y-2">
              {risks.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="mt-0.5 leading-relaxed">{r.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        <div>
          <h4 className="mb-2 text-sm font-semibold">Recommendation</h4>
          {recommendationReason && (
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              {recommendationReason}
            </p>
          )}
          {analysis.reasoning_summary && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {analysis.reasoning_summary}
            </p>
          )}
        </div>

        {cvFocus.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">CV focus</h4>
            <ul className="space-y-1.5">
              {cvFocus.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {interviewFocus.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Interview focus</h4>
            <ul className="space-y-1.5">
              {interviewFocus.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const {
    data: job,
    isLoading,
    refetch,
  } = useResource(
    () => (id ? getJobById(id) : Promise.resolve(null)),
    [id],
  );

  const {
    data: analysis,
    isLoading: analysisLoading,
    refetch: refetchAnalysis,
  } = useResource(
    () => (id ? getLatestJobAnalysis(id) : Promise.resolve(null)),
    [id],
  );

  const { data: existingApp, refetch: refetchApp } = useResource(
    () => (id ? getApplicationByJobId(id) : Promise.resolve(null)),
    [id],
  );

  const { data: companies } = useResource(listCompanies, []);

  const handleAnalyze = async () => {
    if (!job || analyzing) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      await requestJobAnalysis(job.id);
      toast.success('Analysis complete');
      refetchAnalysis();
      refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const runStatus = async (status: Enums<'job_status'>, label: string) => {
    if (!job) return;
    setBusy(true);
    try {
      await setJobStatus(job.id, status);
      toast.success(label);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    if (!window.confirm('Delete this job permanently?')) return;
    setBusy(true);
    try {
      await deleteJob(job.id);
      toast.success('Job deleted');
      navigate(ROUTES.jobs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  };

  const handleCreateApplication = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const app = await createApplication({ jobId: job.id });
      toast.success('Application created');
      refetch();
      refetchApp();
      navigate(ROUTES.applicationDetail(app.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not create application',
      );
      setBusy(false);
    }
  };

  const handleEditSubmit = async (input: CreateJobInput) => {
    if (!job) return;
    try {
      await updateJob(job.id, {
        job_title: input.jobTitle.trim(),
        company_id: input.companyId ?? job.company_id,
        company_name_snapshot: input.companyName.trim(),
        job_url: input.jobUrl ?? null,
        source: input.source ?? null,
        location: input.location ?? null,
        remote_scope: input.remoteScope ?? job.remote_scope,
        salary_min: input.salaryMin ?? null,
        salary_max: input.salaryMax ?? null,
        salary_currency: input.salaryCurrency ?? 'EUR',
        employment_type: input.employmentType ?? job.employment_type,
        job_description: input.jobDescription ?? null,
        deadline: input.deadline ?? null,
      });
      toast.success('Job updated');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
      throw err;
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading job…" />;
  }

  if (!job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Job not found"
        description="The job you're looking for doesn't exist or has been removed."
        actionLabel="Back to Jobs"
        onAction={() => navigate(ROUTES.jobs)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={ROUTES.jobs}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            {job.company_name_snapshot}
          </h2>
          <Badge
            variant="outline"
            className={getJobStatusStyle(job.status)}
          >
            {JOB_STATUS_LABELS[job.status]}
          </Badge>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">{job.job_title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {job.location}
            </span>
          )}
          <Badge variant="secondary" className="text-xs">
            <Wifi className="mr-1 h-3 w-3" />
            {REMOTE_SCOPE_LABELS[job.remote_scope]}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            {formatSalary(job)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Discovered {formatDate(job.date_discovered)}
          </span>
          {job.job_url && (
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Open listing
            </a>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              {job.job_description ? (
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {job.job_description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description saved yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium">{job.source || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Employment</p>
                <p className="font-medium">
                  {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Deadline</p>
                <p className="font-medium">
                  {job.deadline ? formatDate(job.deadline) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{JOB_STATUS_LABELS[job.status]}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {analysisLoading ? (
            <LoadingState label="Loading analysis…" className="py-10" />
          ) : analyzing && !analysis ? (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-base">AI Fit Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <LoadingState
                  label="Analyzing job against your profile…"
                  className="border-0 py-8"
                />
              </CardContent>
            </Card>
          ) : analysis ? (
            <AnalysisPanel
              analysis={analysis}
              analyzing={analyzing}
              onReanalyze={handleAnalyze}
            />
          ) : (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-base">AI Fit Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisError ? (
                  <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-sm font-medium text-destructive">
                      Analysis failed
                    </p>
                    <p className="text-xs text-muted-foreground">{analysisError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={analyzing}
                      onClick={handleAnalyze}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No analysis yet"
                    description="Compare this job to your profile, master CV, and preferences."
                    actionLabel="Analyze Job"
                    onAction={handleAnalyze}
                    className="border-0 py-8"
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {existingApp ? (
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  onClick={() =>
                    navigate(ROUTES.applicationDetail(existingApp.id))
                  }
                >
                  <Send className="h-4 w-4" />
                  View Application
                </Button>
              ) : (
                <Button
                  className="w-full justify-start gap-2"
                  disabled={busy}
                  onClick={handleCreateApplication}
                >
                  <Send className="h-4 w-4" />
                  Create Application
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={busy}
                onClick={() => runStatus('shortlisted', 'Job shortlisted')}
              >
                <BookmarkPlus className="h-4 w-4" />
                Shortlist
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={busy}
                onClick={() => runStatus('skipped', 'Job skipped')}
              >
                <SkipForward className="h-4 w-4" />
                Skip
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={busy}
                onClick={() => runStatus('archived', 'Job archived')}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <JobFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={job}
        companies={companies ?? []}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}
