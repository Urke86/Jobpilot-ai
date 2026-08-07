import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Check,
  Circle,
  DollarSign,
  Calendar,
  Clock,
  ArrowRight,
  Globe,
  Send,
  Sparkles,
  RefreshCw,
  XCircle,
  FileText,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

import { mockApplications } from '../data/mock';
import type { Application, ApplicationStage } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGES: ApplicationStage[] = [
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  preparing: 'Preparing',
  applied: 'Applied',
  questionnaire: 'Questionnaire',
  interview: 'Interview',
  assignment: 'Assignment',
  offer: 'Offer',
  rejected: 'Rejected',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStageBadgeClass(stage: ApplicationStage): string {
  switch (stage) {
    case 'preparing':
      return 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-100';
    case 'applied':
      return 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-100';
    case 'questionnaire':
      return 'border-yellow-300 bg-yellow-100 text-yellow-700 hover:bg-yellow-100';
    case 'interview':
      return 'border-sky-300 bg-sky-100 text-sky-700 hover:bg-sky-100';
    case 'assignment':
      return 'border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-100';
    case 'offer':
      return 'border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'rejected':
      return 'border-red-300 bg-red-100 text-red-700 hover:bg-red-100';
  }
}

/** Returns the index within PIPELINE_STAGES that the application has reached. */
function getCurrentStageIndex(stage: ApplicationStage): number {
  if (stage === 'rejected') return -1; // special case
  return PIPELINE_STAGES.indexOf(stage);
}

// ---------------------------------------------------------------------------
// Timeline Component
// ---------------------------------------------------------------------------

function ApplicationTimeline({ application }: { application: Application }) {
  const isRejected = application.stage === 'rejected';
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
            if (isRejected) {
              // For rejected apps, mark stages up through wherever they got rejected as completed-ish
              // We'll treat all pipeline stages as upcoming/greyed since we don't know exactly where
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
                {/* Vertical line */}
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

                {/* Icon */}
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

                {/* Label */}
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
                    {STAGE_LABELS[stage]}
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

          {/* Rejected indicator (shown separately) */}
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
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Not Found State
// ---------------------------------------------------------------------------

function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Application Not Found</h2>
      <p className="mt-1 text-muted-foreground">
        The application you're looking for doesn't exist or has been removed.
      </p>
      <Button asChild className="mt-6">
        <Link to="/applications">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Applications
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const application = mockApplications.find((a) => a.id === id);

  if (!application) {
    return <NotFoundState />;
  }

  const mockNotesText =
    application.notes ??
    'No notes yet. Add details about this application, interview prep, or follow-up reminders here.';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/applications">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Applications
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {application.company}
          </h1>
          <p className="text-lg text-muted-foreground">
            {application.position}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Badge
              className={`text-sm px-3 py-1 ${getStageBadgeClass(application.stage)}`}
            >
              {STAGE_LABELS[application.stage]}
            </Badge>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Applied {format(new Date(application.appliedAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Two-column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Timeline */}
          <ApplicationTimeline application={application} />

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>
                Keep track of key details and preparation notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[140px] resize-y"
                defaultValue={mockNotesText}
                placeholder="Add notes about this application..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Details */}
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
                <span className="text-sm font-medium">{application.salary}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  Source
                </span>
                <span className="text-sm font-medium">Job Board</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Applied
                </span>
                <span className="text-sm font-medium">
                  {format(new Date(application.appliedAt), 'MMM d, yyyy')}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Last Updated
                </span>
                <span className="text-sm font-medium">
                  {format(new Date(application.updatedAt), 'MMM d, yyyy')}
                </span>
              </div>

              {application.nextStep && (
                <>
                  <Separator />
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                      Next Step
                    </span>
                    <span className="text-right text-sm font-medium text-primary">
                      {application.nextStep}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Send className="h-4 w-4" />
                Send Follow-up
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Sparkles className="h-4 w-4" />
                Prepare for Next Step
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <RefreshCw className="h-4 w-4" />
                Update Status
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4" />
                Withdraw Application
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
