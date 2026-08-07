import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Briefcase,
  Calendar,
  Send,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { JOB_STATUS_LABELS } from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  getDashboardData,
  type ActivityRecord,
} from '@/services';
import { getJobStatusBadgeStyle } from '@/utils';

function getActivityDotColor(type: ActivityRecord['activity_type']): string {
  switch (type) {
    case 'job_discovered':
      return 'bg-blue-500';
    case 'application_created':
      return 'bg-emerald-500';
    case 'application_stage_changed':
      return 'bg-amber-500';
    case 'job_status_changed':
      return 'bg-violet-500';
    case 'analysis_completed':
      return 'bg-cyan-500';
    case 'company_added':
    case 'contact_added':
      return 'bg-indigo-500';
    default:
      return 'bg-muted-foreground';
  }
}

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: { name: string; count: number };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-foreground">
        {label ?? payload[0].payload?.name}
      </p>
      <p className="text-sm text-muted-foreground">
        {payload[0].value}{' '}
        {payload[0].value === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}

const pipelineColors = [
  'hsl(217, 91%, 60%)',
  'hsl(217, 91%, 53%)',
  'hsl(200, 80%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(262, 60%, 55%)',
  'hsl(152, 60%, 45%)',
  'hsl(0, 72%, 51%)',
  'hsl(220, 10%, 50%)',
];

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useResource(getDashboardData, []);

  if (isLoading) {
    return <LoadingState label="Loading dashboard…" />;
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Could not load dashboard"
        description={error?.message ?? 'Something went wrong.'}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const { stats, jobsBySource, applicationsByStatus, recentJobs, activities } =
    data;

  const statCards = [
    {
      label: 'Total Jobs',
      value: stats.totalJobs,
      icon: Briefcase,
    },
    {
      label: 'Shortlisted',
      value: stats.shortlisted,
      icon: Star,
    },
    {
      label: 'Active Applications',
      value: stats.activeApplications,
      icon: Send,
    },
    {
      label: 'Interviews',
      value: stats.interviews,
      icon: Calendar,
    },
    {
      label: 'Response Rate',
      value: `${stats.responseRate}%`,
      icon: TrendingUp,
    },
  ];

  const hasSourceData = jobsBySource.some((d) => d.count > 0);
  const hasPipelineData = applicationsByStatus.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your job search progress
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs by Source</CardTitle>
            <CardDescription>
              Where your opportunities are coming from
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasSourceData ? (
              <EmptyState
                title="No source data yet"
                description="Add jobs with a source to see this chart."
                className="border-0 py-10"
              />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={jobsBySource}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                    barCategoryGap="20%"
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      width={100}
                      tick={{
                        fontSize: 13,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(217, 91%, 53%)"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Pipeline</CardTitle>
            <CardDescription>
              Current status of all your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasPipelineData ? (
              <EmptyState
                title="No applications yet"
                description="Start an application from a job to populate this chart."
                className="border-0 py-10"
              />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={applicationsByStatus}
                    margin={{ top: 0, right: 8, bottom: 0, left: -16 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 12,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tick={{
                        fontSize: 12,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {applicationsByStatus.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={pipelineColors[index % pipelineColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Opportunities</CardTitle>
            <CardDescription>Latest jobs you saved</CardDescription>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No jobs yet"
                description="Add jobs to see recent opportunities here."
                className="border-0 py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Discovered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job) => (
                    <TableRow key={job.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          to={ROUTES.jobDetail(job.id)}
                          className="font-medium hover:underline"
                        >
                          {job.company_name_snapshot}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link
                          to={ROUTES.jobDetail(job.id)}
                          className="transition-colors hover:text-foreground"
                        >
                          {job.job_title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className={getJobStatusBadgeStyle(job.status)}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                        {format(new Date(job.date_discovered), 'MMM d')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Your latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Actions you take will show up in this feed."
                className="border-0 py-10"
              />
            ) : (
              <div className="relative space-y-0">
                {activities.map((activity, index) => {
                  const isLast = index === activities.length - 1;
                  return (
                    <div
                      key={activity.id}
                      className="relative flex gap-3 pb-6 last:pb-0"
                    >
                      {!isLast && (
                        <div className="absolute bottom-0 left-[7px] top-4 w-px bg-border" />
                      )}
                      <div className="relative z-10 mt-1.5 flex-shrink-0">
                        <div
                          className={`h-[14px] w-[14px] rounded-full border-2 border-background ${getActivityDotColor(activity.activity_type)}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {activity.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
