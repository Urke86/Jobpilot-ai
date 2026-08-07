import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  LayoutGrid,
  List,
  Building2,
  Calendar,
  DollarSign,
  ArrowRight,
  FileText,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import {
  APPLICATION_STAGES,
  APPLICATION_STAGE_LABELS,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import { listApplications } from '@/services';
import type { Application } from '@/types';
import {
  getStageBadgeClass,
  getColumnHeaderClass,
  getColumnBorderClass,
} from '@/utils';

// ---------------------------------------------------------------------------
// Kanban View
// ---------------------------------------------------------------------------

function KanbanView({ applications }: { applications: Application[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
        {APPLICATION_STAGES.map((stage) => {
          const apps = applications.filter((a) => a.stage === stage);

          return (
            <div
              key={stage}
              className={`min-w-[280px] flex flex-col rounded-xl border border-t-4 bg-muted/30 ${getColumnBorderClass(stage)}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${getColumnHeaderClass(stage)}`}
                  >
                    {APPLICATION_STAGE_LABELS[stage]}
                  </span>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {apps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3 px-3 pb-3">
                {apps.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No applications
                  </p>
                )}

                {apps.map((app) => (
                  <Link key={app.id} to={ROUTES.applicationDetail(app.id)}>
                    <Card className="cursor-pointer shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                      <CardContent className="p-4 space-y-3">
                        {/* Company & Position */}
                        <div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">
                              {app.company}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold leading-snug">
                            {app.position}
                          </p>
                        </div>

                        {/* Salary */}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="text-xs">{app.salary}</span>
                        </div>

                        {/* Applied Date */}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-xs">
                            Applied{' '}
                            {format(new Date(app.appliedAt), 'MMM d, yyyy')}
                          </span>
                        </div>

                        {/* Next Step */}
                        {app.nextStep && (
                          <div className="flex items-center gap-1.5 rounded-md bg-accent/50 px-2 py-1.5">
                            <ArrowRight className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium text-primary">
                              {app.nextStep}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table View
// ---------------------------------------------------------------------------

function ApplicationsTableView({
  applications,
}: {
  applications: Application[];
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
              <TableHead>Next Step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id} className="cursor-pointer">
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
                  <Badge className={getStageBadgeClass(app.stage)}>
                    {APPLICATION_STAGE_LABELS[app.stage]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {app.salary}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(app.appliedAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(app.updatedAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {app.nextStep ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ViewMode = 'kanban' | 'table';

export default function ApplicationsPage() {
  const [view, setView] = useState<ViewMode>('kanban');
  const { data: applications, isLoading } = useResource(listApplications, []);

  if (isLoading) {
    return <LoadingState label="Loading applications…" />;
  }

  const apps = applications ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Track and manage your job applications across every stage.
          </p>
        </div>

        {/* View Toggle */}
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

      {/* Content */}
      {apps.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Applications you track will appear here across every stage."
        />
      ) : view === 'kanban' ? (
        <KanbanView applications={apps} />
      ) : (
        <ApplicationsTableView applications={apps} />
      )}
    </div>
  );
}
