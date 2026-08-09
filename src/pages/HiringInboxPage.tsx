import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  Inbox,
  Link2,
  Loader2,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import { APPLICATION_STAGE_LABELS } from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  acceptStageFromEmail,
  createInterviewCalendarEvent,
  getExtractedData,
  getGoogleIntegrationStatus,
  getJobEmailById,
  linkEmailToApplication,
  listApplications,
  listJobEmails,
  listJobs,
  markEmailProcessed,
  syncGmail,
  type JobEmailRecord,
} from '@/services';
import type { Enums } from '@/types/database';

const CLASS_LABELS: Record<string, string> = {
  recruiter_outreach: 'Recruiter',
  application_confirmation: 'Confirmation',
  questionnaire: 'Questionnaire',
  assessment: 'Assessment',
  interview_invitation: 'Interview',
  interview_followup: 'Interview follow-up',
  rejection: 'Rejection',
  offer: 'Offer',
  general_hiring_message: 'Hiring',
  unrelated: 'Unrelated',
  pending: 'Pending',
};

type FilterKey =
  | 'all'
  | 'needs_action'
  | 'interview'
  | 'questionnaire'
  | 'rejection'
  | 'offer'
  | 'unmatched';

function buildEventPreview(email: JobEmailRecord) {
  const extracted = getExtractedData(email);
  const interview = (extracted.interview ?? {}) as Record<string, unknown>;
  const company =
    typeof extracted.company_name === 'string'
      ? extracted.company_name
      : 'Company';
  const role =
    typeof extracted.job_title === 'string' ? extracted.job_title : 'Role';
  const date = typeof interview.date === 'string' ? interview.date : '';
  const start = typeof interview.start_time === 'string' ? interview.start_time : '10:00';
  const end = typeof interview.end_time === 'string' ? interview.end_time : '11:00';
  const tz =
    typeof interview.timezone === 'string' && interview.timezone
      ? interview.timezone
      : '';
  const ambiguous = interview.timezone_ambiguous === true || !tz;
  const starts_at = date ? `${date}T${start.length === 5 ? `${start}:00` : start}` : '';
  const ends_at = date ? `${date}T${end.length === 5 ? `${end}:00` : end}` : '';
  return {
    title: `Interview — ${company} — ${role}`,
    starts_at,
    ends_at,
    timezone: tz || 'ambiguous',
    meeting_url:
      typeof interview.meeting_url === 'string' ? interview.meeting_url : null,
    notes: email.subject,
    application_id: email.application_id,
    ambiguous,
  };
}

export default function HiringInboxPage() {
  const navigate = useNavigate();
  const {
    data: emails,
    isLoading,
    error,
    refetch,
  } = useResource(listJobEmails, []);
  const { data: apps } = useResource(listApplications, []);
  const { data: jobs } = useResource(listJobs, []);
  const { data: google } = useResource(getGoogleIntegrationStatus, []);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobEmailRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkAppId, setLinkAppId] = useState('');
  const [eventPreview, setEventPreview] = useState<ReturnType<
    typeof buildEventPreview
  > | null>(null);
  const [tzOverride, setTzOverride] = useState('Europe/Belgrade');

  const filtered = useMemo(() => {
    const list = emails ?? [];
    return list.filter((e) => {
      if (filter === 'needs_action') return e.needs_action;
      if (filter === 'interview')
        return (
          e.classification === 'interview_invitation' ||
          e.classification === 'interview_followup'
        );
      if (filter === 'questionnaire') return e.classification === 'questionnaire';
      if (filter === 'rejection') return e.classification === 'rejection';
      if (filter === 'offer') return e.classification === 'offer';
      if (filter === 'unmatched') return e.match_status === 'unmatched';
      return true;
    });
  }, [emails, filter]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setEventPreview(null);
    const row = await getJobEmailById(id);
    setDetail(row);
    setLinkAppId(row?.application_id ?? '');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGmail();
      toast.success(
        `Synced: imported ${result.imported} / fetched ${result.fetched}`,
      );
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleLink = async () => {
    if (!detail || !linkAppId) return;
    setBusy(true);
    try {
      const updated = await linkEmailToApplication(detail.id, linkAppId);
      setDetail(updated);
      toast.success('Linked to application');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptStage = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const extracted = getExtractedData(detail);
      const stage = extracted.suggested_application_stage as string | undefined;
      await acceptStageFromEmail(detail.id, stage);
      toast.success('Application stage updated');
      const row = await getJobEmailById(detail.id);
      setDetail(row);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stage update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleIgnore = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await markEmailProcessed(detail.id, true);
      toast.message('Suggestion ignored');
      const row = await getJobEmailById(detail.id);
      setDetail(row);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!detail || !eventPreview) return;
    setBusy(true);
    try {
      const tz = eventPreview.ambiguous ? tzOverride : eventPreview.timezone;
      const result = await createInterviewCalendarEvent(detail.id, {
        ...eventPreview,
        timezone: tz,
      });
      toast.success('Calendar event created');
      if (result.html_link) {
        window.open(result.html_link, '_blank', 'noopener,noreferrer');
      }
      setEventPreview(null);
      const row = await getJobEmailById(detail.id);
      setDetail(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Calendar create failed');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading hiring inbox…" />;
  if (error) {
    return (
      <EmptyState
        icon={Inbox}
        title="Could not load inbox"
        description={error.message}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const extracted = detail ? getExtractedData(detail) : {};
  const suggestedStage =
    typeof extracted.suggested_application_stage === 'string'
      ? extracted.suggested_application_stage
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hiring Inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Application-related Gmail messages — classify, link, and act with
            your approval. Not a full email client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`${ROUTES.settings}?tab=integrations`}>Integrations</Link>
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing || !google?.connected}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Gmail
          </Button>
        </div>
      </div>

      {!google?.connected && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Connect Google under Settings → Integrations to sync Gmail. Tokens
          never appear in this UI.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as FilterKey)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="needs_action">Needs action</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="questionnaire">Questionnaire</SelectItem>
            <SelectItem value="rejection">Rejection</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} messages</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border bg-card">
          {(emails ?? []).length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Inbox}
                title="No hiring emails yet"
                description="Sync Gmail after connecting Google, or wait for relevant messages in the last 14 days."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden md:table-cell">Class</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((email) => (
                  <TableRow
                    key={email.id}
                    className={`cursor-pointer ${selectedId === email.id ? 'bg-muted/50' : ''}`}
                    onClick={() => openDetail(email.id)}
                  >
                    <TableCell className="max-w-[140px] truncate font-medium">
                      {email.sender_name || email.sender_email || '—'}
                      {email.needs_action && (
                        <Badge className="ml-2" variant="outline">
                          Action
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {email.subject || '(no subject)'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {CLASS_LABELS[email.classification] ?? email.classification}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {email.received_at
                        ? new Date(email.received_at).toLocaleString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-5">
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Select a message to review classification, link an application,
              and approve actions.
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{detail.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  {detail.sender_name} &lt;{detail.sender_email}&gt; ·{' '}
                  {detail.received_at
                    ? new Date(detail.received_at).toLocaleString()
                    : '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {CLASS_LABELS[detail.classification]}
                </Badge>
                <Badge variant="outline">
                  confidence {detail.confidence_score ?? '—'}
                </Badge>
                <Badge variant="outline">{detail.match_status}</Badge>
              </div>
              <Textarea
                readOnly
                value={detail.body_text || detail.snippet || ''}
                rows={10}
                className="text-sm"
              />

              {typeof extracted.suggested_action === 'string' && (
                <p className="text-sm">
                  <span className="font-medium">Suggested: </span>
                  {extracted.suggested_action}
                </p>
              )}

              <div className="space-y-2">
                <Label>Link application</Label>
                <div className="flex gap-2">
                  <Select value={linkAppId} onValueChange={setLinkAppId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select application" />
                    </SelectTrigger>
                    <SelectContent>
                      {(apps ?? []).map((app) => {
                        const job = (jobs ?? []).find((j) => j.id === app.job_id);
                        const label = job
                          ? `${job.company_name_snapshot} — ${job.job_title}`
                          : `Application ${app.id.slice(0, 8)}…`;
                        return (
                          <SelectItem key={app.id} value={app.id}>
                            {label} · {app.stage}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={busy || !linkAppId}
                    onClick={handleLink}
                    className="gap-1"
                  >
                    <Link2 className="h-4 w-4" />
                    Link
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {suggestedStage && detail.application_id && (
                  <Button
                    disabled={busy}
                    onClick={handleAcceptStage}
                    className="gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Accept stage:{' '}
                    {APPLICATION_STAGE_LABELS[
                      suggestedStage as Enums<'application_stage'>
                    ] ?? suggestedStage}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleIgnore}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Ignore
                </Button>
                {detail.application_id &&
                  detail.classification === 'questionnaire' && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(ROUTES.applicationDetail(detail.application_id!))
                      }
                    >
                      Open Artifact Toolkit
                    </Button>
                  )}
                {(detail.classification === 'interview_invitation' ||
                  (extracted.interview as { detected?: boolean } | undefined)
                    ?.detected) && (
                  <Button
                    variant="secondary"
                    className="gap-1"
                    onClick={() => setEventPreview(buildEventPreview(detail))}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Create interview event
                  </Button>
                )}
              </div>

              {eventPreview && (
                <div className="space-y-3 rounded-md border p-3 text-sm">
                  <h3 className="font-medium">Calendar preview (confirm)</h3>
                  <p>
                    <strong>Title:</strong> {eventPreview.title}
                  </p>
                  <p>
                    <strong>Start:</strong> {eventPreview.starts_at || '—'}
                  </p>
                  <p>
                    <strong>End:</strong> {eventPreview.ends_at || '—'}
                  </p>
                  {eventPreview.ambiguous ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="tz">Confirm timezone (required)</Label>
                      <Input
                        id="tz"
                        value={tzOverride}
                        onChange={(e) => setTzOverride(e.target.value)}
                        placeholder="Europe/Belgrade"
                      />
                      <p className="text-xs text-muted-foreground">
                        Source timezone was ambiguous — event creation is blocked
                        until you confirm.
                      </p>
                    </div>
                  ) : (
                    <p>
                      <strong>Timezone:</strong> {eventPreview.timezone}
                    </p>
                  )}
                  {eventPreview.meeting_url && (
                    <p>
                      <strong>Meeting:</strong> {eventPreview.meeting_url}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={
                        busy ||
                        !eventPreview.starts_at ||
                        (eventPreview.ambiguous && !tzOverride.trim())
                      }
                      onClick={handleCreateEvent}
                    >
                      Confirm create
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEventPreview(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
