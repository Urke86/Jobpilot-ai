import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  Check,
  Circle,
  Clock,
  DollarSign,
  FileText,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ArtifactToolkit } from '@/components/artifacts/ArtifactToolkit';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGES,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  ARTIFACT_TYPE_LABELS,
  artifactPreviewText,
  type ArtifactType,
} from '@/lib/ai/artifact-schemas';
import {
  formatSalary,
  getApplicationById,
  getArtifactMetadata,
  getJobById,
  listArtifactsByApplication,
  setApplicationStage,
  updateApplication,
  type ApplicationRecord,
} from '@/services';
import type { Enums } from '@/types/database';
import { getStageBadgeClass } from '@/utils';

const PIPELINE_STAGES: Enums<'application_stage'>[] = [
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
];

function getCurrentStageIndex(stage: Enums<'application_stage'>): number {
  if (stage === 'rejected' || stage === 'withdrawn') return -1;
  return PIPELINE_STAGES.indexOf(stage);
}

function ApplicationTimeline({
  application,
}: {
  application: ApplicationRecord;
}) {
  const isRejected = application.stage === 'rejected';
  const isWithdrawn = application.stage === 'withdrawn';
  const currentIdx = getCurrentStageIndex(application.stage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
        <CardDescription>
          Application progress through each stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {PIPELINE_STAGES.map((stage, idx) => {
            let status: 'completed' | 'current' | 'upcoming';
            if (isRejected || isWithdrawn) {
              status = 'upcoming';
            } else if (idx < currentIdx) {
              status = 'completed';
            } else if (idx === currentIdx) {
              status = 'current';
            } else {
              status = 'upcoming';
            }

            return (
              <div key={stage} className="relative flex gap-4">
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`absolute left-[15px] top-[32px] h-full w-0.5 ${
                      status === 'completed'
                        ? 'bg-emerald-400'
                        : status === 'current'
                          ? 'bg-gradient-to-b from-primary/60 to-muted'
                          : 'bg-muted'
                    }`}
                  />
                )}

                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                  {status === 'completed' ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : status === 'current' ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/20">
                      <Circle className="h-3 w-3 fill-current" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted bg-background text-muted-foreground">
                      <Circle className="h-3 w-3" />
                    </div>
                  )}
                </div>

                <div className="flex min-h-[56px] flex-col justify-center pb-4">
                  <p
                    className={`text-sm font-medium ${
                      status === 'completed'
                        ? 'text-emerald-600'
                        : status === 'current'
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {APPLICATION_STAGE_LABELS[stage]}
                  </p>
                  {status === 'current' && (
                    <p className="text-xs text-muted-foreground">
                      Current stage
                    </p>
                  )}
                  {status === 'completed' && (
                    <p className="text-xs text-emerald-500">Completed</p>
                  )}
                </div>
              </div>
            );
          })}

          {isRejected && (
            <div className="relative flex gap-4 pt-2">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 ring-4 ring-red-100">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm font-medium text-red-600">Rejected</p>
                <p className="text-xs text-muted-foreground">
                  Application was not successful
                </p>
              </div>
            </div>
          )}

          {isWithdrawn && (
            <div className="relative flex gap-4 pt-2">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm font-medium text-zinc-600">Withdrawn</p>
                <p className="text-xs text-muted-foreground">
                  You withdrew this application
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    data: application,
    isLoading,
    error,
    refetch,
  } = useResource(
    () => (id ? getApplicationById(id) : Promise.resolve(null)),
    [id],
  );

  const { data: job } = useResource(
    () =>
      application?.job_id
        ? getJobById(application.job_id)
        : Promise.resolve(null),
    [application?.job_id],
  );

  const {
    data: artifacts,
    isLoading: artifactsLoading,
    refetch: refetchArtifacts,
  } = useResource(
    () => (id ? listArtifactsByApplication(id) : Promise.resolve([])),
    [id],
  );

  useEffect(() => {
    if (!application) return;
    setNotes(application.notes ?? '');
    setCoverLetter(application.cover_letter ?? '');
    setFollowUp(application.follow_up_date ?? '');
  }, [application]);

  const handleStageChange = async (stage: Enums<'application_stage'>) => {
    if (!application) return;
    try {
      await setApplicationStage(application.id, stage);
      toast.success(`Stage updated to ${APPLICATION_STAGE_LABELS[stage]}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update stage');
    }
  };

  const handleSaveDetails = async () => {
    if (!application) return;
    setSaving(true);
    try {
      await updateApplication(application.id, {
        notes: notes.trim() || null,
        cover_letter: coverLetter.trim() || null,
        follow_up_date: followUp || null,
      });
      toast.success('Application saved');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading application…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Could not load application"
        description={error.message}
        actionLabel="Back to Applications"
        onAction={() => navigate(ROUTES.applications)}
      />
    );
  }

  if (!application) {
    return (
      <EmptyState
        icon={FileText}
        title="Application Not Found"
        description="The application you're looking for doesn't exist or has been removed."
        actionLabel="Back to Applications"
        onAction={() => navigate(ROUTES.applications)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={ROUTES.applications}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Applications
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {job?.company_name_snapshot ?? 'Application'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {job?.job_title ?? 'Linked job'}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Badge
              className={`px-3 py-1 text-sm ${getStageBadgeClass(application.stage)}`}
            >
              {APPLICATION_STAGE_LABELS[application.stage]}
            </Badge>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Applied{' '}
              {format(new Date(application.application_date), 'MMM d, yyyy')}
            </span>
            {job && (
              <Link
                to={ROUTES.jobDetail(job.id)}
                className="text-sm text-primary hover:underline"
              >
                View job
              </Link>
            )}
          </div>
        </div>

        <div className="w-full sm:w-[200px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Stage
          </Label>
          <Select
            value={application.stage}
            onValueChange={(v) =>
              handleStageChange(v as Enums<'application_stage'>)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {APPLICATION_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ApplicationTimeline application={application} />

          <ArtifactToolkit
            applicationId={application.id}
            artifacts={artifacts ?? []}
            onChanged={refetchArtifacts}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes & materials</CardTitle>
              <CardDescription>
                Keep notes, cover letter, and follow-up date in sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  className="min-h-[120px] resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this application..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover">Cover letter</Label>
                <Textarea
                  id="cover"
                  className="min-h-[120px] resize-y"
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Paste or draft your cover letter..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUp">Follow-up date</Label>
                <Input
                  id="followUp"
                  type="date"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveDetails} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved artifacts</CardTitle>
              <CardDescription>
                Version history across all generated materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              {artifactsLoading ? (
                <LoadingState
                  label="Loading artifacts…"
                  className="min-h-[20vh] py-8"
                />
              ) : (artifacts ?? []).length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No artifacts yet"
                  description="Use the AI Application Toolkit above to generate materials."
                  className="border-0 py-8"
                />
              ) : (
                <div className="space-y-3">
                  {(artifacts ?? []).map((artifact) => {
                    const label =
                      ARTIFACT_TYPE_LABELS[
                        artifact.artifact_type as ArtifactType
                      ] ?? artifact.artifact_type.replace(/_/g, ' ');
                    const preview = artifactPreviewText(
                      artifact.artifact_type,
                      artifact.content,
                      getArtifactMetadata(artifact),
                    );
                    return (
                      <div
                        key={artifact.id}
                        className="rounded-lg border p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary">{label}</Badge>
                          <span className="text-xs text-muted-foreground">
                            v{artifact.version}
                          </span>
                        </div>
                        <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                          {preview}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Salary
                </span>
                <span className="text-sm font-medium">
                  {job ? formatSalary(job) : '—'}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Applied
                </span>
                <span className="text-sm font-medium">
                  {format(new Date(application.application_date), 'MMM d, yyyy')}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Last Updated
                </span>
                <span className="text-sm font-medium">
                  {format(new Date(application.updated_at), 'MMM d, yyyy')}
                </span>
              </div>
              {application.follow_up_date && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Follow-up
                    </span>
                    <span className="text-sm font-medium">
                      {format(
                        new Date(application.follow_up_date),
                        'MMM d, yyyy',
                      )}
                    </span>
                  </div>
                </>
              )}
              {application.salary_expectation != null && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Expectation
                    </span>
                    <span className="text-sm font-medium">
                      {application.salary_currency}{' '}
                      {application.salary_expectation.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
