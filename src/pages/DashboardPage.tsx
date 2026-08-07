import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Briefcase,
  Star,
  Send,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useResource } from '@/hooks/use-resource';
import {
  getDashboardStats,
  getJobsBySourceChart,
  getApplicationsByStatusChart,
  listJobs,
  listActivities,
} from '@/services';
import type { Activity } from '@/types';
import { getMatchScoreBadgeStyle, getJobStatusBadgeStyle } from '@/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActivityDotColor(type: Activity['type']): string {
  switch (type) {
    case 'job_discovered':
      return 'bg-blue-500';
    case 'application_sent':
      return 'bg-emerald-500';
    case 'interview_scheduled':
      return 'bg-amber-500';
    case 'status_changed':
      return 'bg-violet-500';
    case 'ai_analysis':
      return 'bg-cyan-500';
    default:
      return 'bg-muted-foreground';
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip for charts
// ---------------------------------------------------------------------------

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
      <p className="text-sm font-medium text-foreground">{label ?? payload[0].payload?.name}</p>
      <p className="text-sm text-muted-foreground">
        {payload[0].value} {payload[0].value === 1 ? 'job' : 'jobs'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar color palette for pipeline chart
// ---------------------------------------------------------------------------

const pipelineColors = [
  'hsl(217, 91%, 60%)',  // Preparing – blue
  'hsl(217, 91%, 53%)',  // Applied – blue
  'hsl(200, 80%, 50%)',  // Questionnaire – sky
  'hsl(45, 93%, 47%)',   // Interview – amber
  'hsl(262, 60%, 55%)',  // Assignment – violet
  'hsl(152, 60%, 45%)',  // Offer – emerald
  'hsl(0, 72%, 51%)',    // Rejected – red
];

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useResource(
    getDashboardStats,
    [],
  );
  const { data: jobsBySource, isLoading: sourceLoading } = useResource(
    getJobsBySourceChart,
    [],
  );
  const { data: applicationsByStatus, isLoading: statusLoading } = useResource(
    getApplicationsByStatusChart,
    [],
  );
  const { data: jobs, isLoading: jobsLoading } = useResource(listJobs, []);
  const { data: activities, isLoading: activitiesLoading } = useResource(
    listActivities,
    [],
  );

  const isLoading =
    statsLoading ||
    sourceLoading ||
    statusLoading ||
    jobsLoading ||
    activitiesLoading;

  if (isLoading || !stats || !jobsBySource || !applicationsByStatus) {
    return <LoadingState label="Loading dashboard…" />;
  }

  const recentJobs = (jobs ?? []).slice(0, 5);
  const sortedActivities = [...(activities ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const statCards = [
    {
      label: 'Total Jobs',
      value: stats.totalJobs,
      icon: Briefcase,
      extra: '+12 this week',
      extraColor: 'text-emerald-600',
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

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your job search progress
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Stats Cards                                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="bg-muted p-2 rounded-lg">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                {stat.extra && (
                  <p className={`text-xs mt-1 ${stat.extraColor}`}>{stat.extra}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Charts Row                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Source – Horizontal bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs by Source</CardTitle>
            <CardDescription>Where your opportunities are coming from</CardDescription>
          </CardHeader>
          <CardContent>
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
                    tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
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
          </CardContent>
        </Card>

        {/* Application Pipeline – Vertical bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Pipeline</CardTitle>
            <CardDescription>Current status of all your applications</CardDescription>
          </CardHeader>
          <CardContent>
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
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {applicationsByStatus.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={pipelineColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Bottom Section: Recent Opportunities + Activity                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Opportunities Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Opportunities</CardTitle>
            <CardDescription>Latest jobs matching your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-center">Match</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Posted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to={ROUTES.jobDetail(job.id)}
                        className="flex items-center gap-2.5 font-medium hover:underline"
                      >
                        {job.companyLogo && (
                          <img
                            src={job.companyLogo}
                            alt={job.company}
                            className="h-6 w-6 rounded object-contain"
                          />
                        )}
                        {job.company}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link to={ROUTES.jobDetail(job.id)} className="hover:text-foreground transition-colors">
                        {job.position}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getMatchScoreBadgeStyle(job.matchScore)}>
                        {job.matchScore}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getJobStatusBadgeStyle(job.status)}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      {format(new Date(job.postedAt), 'MMM d')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Your latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {sortedActivities.map((activity, index) => {
                const isLast = index === sortedActivities.length - 1;

                return (
                  <div key={activity.id} className="relative flex gap-3 pb-6 last:pb-0">
                    {/* Connecting line */}
                    {!isLast && (
                      <div className="absolute left-[7px] top-4 bottom-0 w-px bg-border" />
                    )}

                    {/* Dot */}
                    <div className="relative z-10 mt-1.5 flex-shrink-0">
                      <div
                        className={`h-[14px] w-[14px] rounded-full border-2 border-background ${getActivityDotColor(activity.type)}`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
