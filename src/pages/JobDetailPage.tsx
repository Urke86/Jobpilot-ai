import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Wifi,
  DollarSign,
  Calendar,
  CheckCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Send,
  BookmarkPlus,
  FileText,
  MessageSquare,
  Briefcase,
} from 'lucide-react';
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
import { EmptyState, LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { REMOTE_TYPE_LABELS } from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import { getJobById } from '@/services';
import {
  getJobStatusStyle,
  getRecommendationStyle,
  getScoreColor,
  getScoreRingBorderColor,
} from '@/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// AI Analysis data (hardcoded realistic examples)
// ---------------------------------------------------------------------------

const aiStrengths = [
  'Strong TypeScript experience directly matches core technical requirements',
  'Previous work on large-scale SPA architectures aligns with the role scope',
  '5+ years of frontend engineering aligns with the senior level expectation',
];

const aiGaps = [
  'Limited published experience with PostgreSQL internals — may need ramp-up',
  'No open-source maintainer track record listed on profile',
];

const aiRisks = [
  'Salary expectation at the upper end of the range — may require negotiation',
  'Role involves async-first remote culture; prior experience has been hybrid',
];

const aiRecommendationText =
  'This role is an excellent fit based on your frontend architecture background and TypeScript expertise. Your experience building complex editor interfaces closely mirrors the SQL editor work at this company. To strengthen your candidacy, highlight any database-adjacent project work and consider contributing to an open-source project before interviewing. The async remote culture will require strong written communication — prepare examples of successful remote collaboration.';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useResource(
    () => (id ? getJobById(id) : Promise.resolve(null)),
    [id],
  );

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
      {/* Back button */}
      <Link
        to={ROUTES.jobs}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            {job.company}
          </h2>
          <Badge
            variant="outline"
            className={`capitalize ${getJobStatusStyle(job.status)}`}
          >
            {job.status}
          </Badge>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">{job.position}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.location}
          </span>
          <Badge variant="secondary" className="text-xs">
            <Wifi className="mr-1 h-3 w-3" />
            {REMOTE_TYPE_LABELS[job.remoteType]}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            {job.salary}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Posted {formatDate(job.postedAt)}
          </span>
        </div>
      </div>

      <Separator />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Job Description */}
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {job.requirements.map((req, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {req}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {job.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-muted-foreground"
                  >
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* AI Analysis Card */}
          <Card className="relative overflow-hidden border-blue-200 dark:border-blue-800">
            {/* Accent top border */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" />

            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Fit Analysis</CardTitle>
                  <CardDescription className="text-xs">
                    Powered by JobPilot AI
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Match Score */}
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] ${getScoreRingBorderColor(
                    job.matchScore
                  )}`}
                >
                  <span
                    className={`text-2xl font-bold ${getScoreColor(
                      job.matchScore
                    )}`}
                  >
                    {job.matchScore}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">Match Score</p>
                  <Badge
                    variant="outline"
                    className={`mt-1 capitalize ${getRecommendationStyle(
                      job.recommendation
                    )}`}
                  >
                    {job.recommendation} match
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Strengths */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  Strengths
                </h4>
                <ul className="space-y-1.5">
                  {aiStrengths.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gaps */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-yellow-700">
                  <AlertTriangle className="h-4 w-4" />
                  Gaps
                </h4>
                <ul className="space-y-1.5">
                  {aiGaps.map((g, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
                  <XCircle className="h-4 w-4" />
                  Risks
                </h4>
                <ul className="space-y-1.5">
                  {aiRisks.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Recommendation Text */}
              <div>
                <h4 className="mb-2 text-sm font-semibold">Recommendation</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {aiRecommendationText}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button className="w-full justify-start gap-2">
                <Send className="h-4 w-4" />
                Apply Now
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <BookmarkPlus className="h-4 w-4" />
                Save to Shortlist
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Generate Cover Letter
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <MessageSquare className="h-4 w-4" />
                Prepare for Interview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
