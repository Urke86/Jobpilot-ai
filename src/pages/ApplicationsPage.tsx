import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Building2,
  Calendar,
  DollarSign,
  FileText,
  LayoutGrid,
  List,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { ROUTES } from '@/constants/routes';
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGES,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  formatSalary,
  listApplications,
  listJobs,
  setApplicationStage,
  type ApplicationRecord,
  type JobRecord,
} from '@/services';
import type { Enums } from '@/types/database';
import {
  getColumnBorderClass,
  getColumnHeaderClass,
  getStageBadgeClass,
} from '@/utils';

type AppWithJob = ApplicationRecord & {
  company: string;
  position: string;
  salary: string;
};

function enrichApps(
  applications: ApplicationRecord[],
  jobs: JobRecord[],
): AppWithJob[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  return applications.map((app) => {
    const job = jobMap.get(app.job_id);
    return {
      ...app,
      company: job?.company_name_snapshot ?? 'Unknown company',
      position: job?.job_title ?? 'Unknown role',
      salary: job ? formatSalary(job) : 'Not specified',
    };
  });
}

function KanbanView({
  applications,
  onStageChange,
}: {
  applications: AppWithJob[];
  onStageChange: (id: string, stage: Enums<'application_stage'>) => void;
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
        {APPLICATION_STAGES.map((stage) => {
          const apps = applications.filter((a) => a.stage === stage);

          return (
            <div
              key={stage}
              className={`flex min-w-[280px] flex-col rounded-xl border border-t-4 bg-muted/30 ${getColumnBorderClass(stage)}`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${getColumnHeaderClass(stage)}`}
                >
                  {APPLICATION_STAGE_LABELS[stage]}
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {apps.length}
                </span>
              </div>

              <div className="flex flex-col gap-3 px-3 pb-3">
                {apps.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No applications
                  </p>
                )}

                {apps.map((app) => (
                  <Card
                    key={app.id}
                    className="shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CardContent className="space-y-3 p-4">
                      <Link to={ROUTES.applicationDetail(app.id)}>
                        <div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">
                              {app.company}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold leading-snug hover:text-primary">
                            {app.position}
                          </p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-xs">{app.salary}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-xs">
                          Applied{' '}
                          {format(new Date(app.application_date), 'MMM d, yyyy')}
                        </span>
                      </div>

                      <Select
                        value={app.stage}
                        onValueChange={(v) =>
                          onStageChange(app.id, v as Enums<'application_stage'>)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApplicationsTableView({
  applications,
  onStageChange,
}: {
  applications: AppWithJob[];
  onStageChange: (id: string, stage: Enums<'application_stage'>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All Applications</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Applied Date</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <Link
                    to={ROUTES.applicationDetail(app.id)}
                    className="font-medium hover:underline"
                  >
                    {app.company}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to={ROUTES.applicationDetail(app.id)}>
                    {app.position}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={getStageBadgeClass(app.stage)}>
                      {APPLICATION_STAGE_LABELS[app.stage]}
                    </Badge>
                    <Select
                      value={app.stage}
                      onValueChange={(v) =>
                        onStageChange(app.id, v as Enums<'application_stage'>)
                      }
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
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
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {app.salary}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(app.application_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(app.updated_at), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type ViewMode = 'kanban' | 'table';

export default function ApplicationsPage() {
  const [view, setView] = useState<ViewMode>('kanban');
  const {
    data: applications,
    isLoading: appsLoading,
    refetch,
  } = useResource(listApplications, []);
  const { data: jobs, isLoading: jobsLoading } = useResource(listJobs, []);

  const enriched = useMemo(
    () => enrichApps(applications ?? [], jobs ?? []),
    [applications, jobs],
  );

  const handleStageChange = async (
    id: string,
    stage: Enums<'application_stage'>,
  ) => {
    try {
      await setApplicationStage(id, stage);
      toast.success(`Moved to ${APPLICATION_STAGE_LABELS[stage]}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update stage');
    }
  };

  if (appsLoading || jobsLoading) {
    return <LoadingState label="Loading applications…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Track and manage your job applications across every stage.
          </p>
        </div>

        <div className="flex items-center rounded-lg border bg-muted/50 p-1">
          <Button
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('kanban')}
            className="gap-1.5"
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
            className="gap-1.5"
          >
            <List className="h-4 w-4" />
            Table
          </Button>
        </div>
      </div>

      {enriched.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Create an application from a job detail page to start tracking."
        />
      ) : view === 'kanban' ? (
        <KanbanView
          applications={enriched}
          onStageChange={handleStageChange}
        />
      ) : (
        <ApplicationsTableView
          applications={enriched}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}
